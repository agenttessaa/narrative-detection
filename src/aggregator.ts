/**
 * Signal Aggregator for NarrativeScope
 * Combines X social signals + GitHub dev signals → emerging narrative detection
 *
 * Key insight: emerging narratives show up in BOTH social AND dev activity.
 * Single-source signals are weaker. Cross-source correlation is the edge.
 */

import type { XScanResult, TopicCluster } from "./x-scanner";
import type { GHScanResult, GHTopicCluster } from "./github-scanner";

export interface DetectedNarrative {
  name: string;
  confidence: number; // 0-1
  stage: "pre-narrative" | "emergence" | "acceleration" | "peak";
  explanation: string;
  signalScore: number;
  signals: {
    social: {
      tweetCount: number;
      avgEngagement: number;
      totalEngagement: number;
      uniqueAuthors: number;
      topTweets: Array<{ text: string; author: string; likes: number; url: string }>;
      keyTerms: string[];
    };
    developer: {
      repoCount: number;
      totalStars: number;
      avgStars: number;
      topRepos: Array<{ name: string; description: string; stars: number; url: string }>;
      keyTerms: string[];
    };
  };
  buildIdeas: BuildIdea[];
}

export interface BuildIdea {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
}

export interface AggregatorResult {
  generatedAt: string;
  period: string;
  narratives: DetectedNarrative[];
  methodology: string;
}

// Topic mapping — aligning X and GitHub cluster names
const TOPIC_ALIGNMENT: Record<string, string[]> = {
  "Privacy Infrastructure": [
    "Privacy & Confidential Computing",
    "Privacy & Confidential Computing",
  ],
  "AI Agent Economy": [
    "AI Agent Infrastructure",
    "AI Agent Infrastructure",
  ],
  "Agent Commerce": [
    "Agent Commerce & Payments",
    "Payments & Commerce",
  ],
  "DePIN Growth": [
    "DePIN & Physical Infrastructure",
    "DePIN",
  ],
  "Dev Tooling for Solana": [
    "Dev Tooling & AI-Assisted Building",
    "Dev Tooling",
  ],
  "Restaking & LSTs": [
    "Restaking & Liquid Staking",
    "DeFi & Financial",
  ],
  "Cross-chain": [
    "Cross-chain & Interoperability",
    "", // no GitHub cluster
  ],
};

export function aggregateSignals(
  xResult: XScanResult,
  ghResult: GHScanResult
): AggregatorResult {
  const narratives: DetectedNarrative[] = [];
  const periodEnd = new Date();
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - 14);

  for (const [narrativeName, [xClusterName, ghClusterName]] of Object.entries(TOPIC_ALIGNMENT)) {
    const xCluster = xResult.topicClusters.find((c) => c.topic === xClusterName);
    const ghCluster = ghResult.topicClusters.find((c) => c.topic === ghClusterName);

    // Need at least one signal source
    if (!xCluster && !ghCluster) continue;

    const social = xCluster
      ? {
          tweetCount: xCluster.tweetCount,
          avgEngagement: xCluster.avgEngagement,
          totalEngagement: xCluster.totalEngagement,
          uniqueAuthors: xCluster.uniqueAuthors ?? 0,
          topTweets: xCluster.topTweets.slice(0, 3).map((t) => ({
            text: t.text.slice(0, 200),
            author: t.author,
            likes: t.likes,
            url: `https://x.com/i/status/${t.tweetId}`,
          })),
          keyTerms: xCluster.keyTerms,
        }
      : { tweetCount: 0, avgEngagement: 0, totalEngagement: 0, uniqueAuthors: 0, topTweets: [], keyTerms: [] };

    const developer = ghCluster
      ? {
          repoCount: ghCluster.repoCount,
          totalStars: ghCluster.totalStars,
          avgStars: ghCluster.avgStars,
          topRepos: ghCluster.topRepos.slice(0, 3).map((r) => ({
            name: r.fullName,
            description: r.description.slice(0, 200),
            stars: r.stars,
            url: r.url,
          })),
          keyTerms: ghCluster.keyTerms,
        }
      : { repoCount: 0, totalStars: 0, avgStars: 0, topRepos: [], keyTerms: [] };

    // Signal scoring
    const signalScore = computeSignalScore(social, developer);

    // Determine stage
    const stage = determineStage(social, developer);

    // Compute confidence
    const confidence = computeConfidence(social, developer);

    // Skip very weak signals
    if (signalScore < 15) continue;

    // Generate build ideas based on narrative
    const buildIdeas = generateBuildIdeas(narrativeName, social.keyTerms, developer.keyTerms);

    // Generate explanation
    const explanation = generateExplanation(narrativeName, social, developer, stage);

    narratives.push({
      name: narrativeName,
      confidence,
      stage,
      explanation,
      signalScore,
      signals: { social, developer },
      buildIdeas,
    });
  }

  // Sort by signal score
  narratives.sort((a, b) => b.signalScore - a.signalScore);

  return {
    generatedAt: new Date().toISOString(),
    period: `${periodStart.toISOString().split("T")[0]} to ${periodEnd.toISOString().split("T")[0]}`,
    narratives,
    methodology: METHODOLOGY,
  };
}

function computeSignalScore(
  social: DetectedNarrative["signals"]["social"],
  developer: DetectedNarrative["signals"]["developer"]
): number {
  // Social score (0-40)
  const socialVolume = Math.min(social.tweetCount * 2.5, 15);
  const socialEngagement = Math.min(social.avgEngagement / 60, 20);
  // Source diversity: many unique authors = organic signal, not one person shilling
  const diversityRatio = social.tweetCount > 0
    ? social.uniqueAuthors / social.tweetCount
    : 0;
  const diversityBonus = Math.min(diversityRatio * social.uniqueAuthors, 5);
  const socialScore = socialVolume + socialEngagement + diversityBonus;

  // Developer score (0-40)
  const devVolume = Math.min(developer.repoCount * 2, 15);
  const devQuality = Math.min(developer.totalStars / 10, 20);
  // Repo diversity: stars spread across repos = healthy ecosystem
  const devDiversity = developer.repoCount > 0 && developer.avgStars > 0
    ? Math.min(developer.repoCount * Math.log2(developer.avgStars + 1), 5)
    : 0;
  const devScore = devVolume + devQuality + devDiversity;

  // Cross-source bonus: having BOTH social + dev signals is worth extra (0-20)
  // Scaled by the strength of each source, not binary
  let crossSourceBonus = 0;
  if (social.tweetCount > 0 && developer.repoCount > 0) {
    const socialStrength = Math.min(socialScore / 30, 1);
    const devStrength = Math.min(devScore / 30, 1);
    crossSourceBonus = 10 + Math.round(socialStrength * devStrength * 10);
  }

  return Math.min(Math.round(socialScore + devScore + crossSourceBonus), 100);
}

function determineStage(
  social: DetectedNarrative["signals"]["social"],
  developer: DetectedNarrative["signals"]["developer"]
): DetectedNarrative["stage"] {
  const hasStrongSocial = social.tweetCount >= 5 && social.avgEngagement >= 100;
  const hasStrongDev = developer.repoCount >= 5 && developer.totalStars >= 20;
  const hasAnySocial = social.tweetCount > 0;
  const hasAnyDev = developer.repoCount > 0;

  // Peak: very high engagement across multiple diverse sources
  if (hasStrongSocial && hasStrongDev && social.avgEngagement >= 500 && social.uniqueAuthors >= 8) {
    return "peak";
  }

  // Acceleration: strong signals from both sources
  if (hasStrongSocial && hasStrongDev && social.avgEngagement >= 200) {
    return "acceleration";
  }

  // Emergence: strong in at least one source
  if (hasStrongSocial || hasStrongDev) return "emergence";

  // Pre-narrative: dev-only signals (building but no buzz yet)
  if (hasAnyDev && !hasAnySocial) return "pre-narrative";

  // Social-only signals still count as emergence
  if (hasAnySocial) return "emergence";

  return "pre-narrative";
}

function computeConfidence(
  social: DetectedNarrative["signals"]["social"],
  developer: DetectedNarrative["signals"]["developer"]
): number {
  let confidence = 0.25; // base

  // Volume signals
  if (social.tweetCount >= 3) confidence += 0.08;
  if (social.tweetCount >= 10) confidence += 0.07;

  // Engagement quality
  if (social.avgEngagement >= 100) confidence += 0.08;
  if (social.avgEngagement >= 300) confidence += 0.05;

  // Source diversity — most important social signal
  // High diversity = organic, not astroturfed
  if (social.uniqueAuthors >= 3) confidence += 0.08;
  if (social.uniqueAuthors >= 8) confidence += 0.07;

  // Dev signals
  if (developer.repoCount >= 3) confidence += 0.08;
  if (developer.repoCount >= 10) confidence += 0.07;
  if (developer.totalStars >= 50) confidence += 0.05;

  // Cross-source confirmation = big confidence boost
  if (social.tweetCount > 0 && developer.repoCount > 0) {
    confidence += 0.12;
  }

  return Math.min(Math.round(confidence * 100) / 100, 0.95);
}

function generateExplanation(
  name: string,
  social: DetectedNarrative["signals"]["social"],
  developer: DetectedNarrative["signals"]["developer"],
  stage: string
): string {
  const parts: string[] = [];

  if (social.tweetCount > 0) {
    parts.push(
      `${social.tweetCount} tweets detected with ${social.avgEngagement} avg engagement`
    );
  }

  if (developer.repoCount > 0) {
    parts.push(
      `${developer.repoCount} new repos (${developer.totalStars} total stars)`
    );
  }

  const stageDesc = {
    "pre-narrative": "Early stage — dev activity detected before social buzz",
    emergence: "Emerging — growing social discussion and/or dev activity",
    acceleration: "Accelerating — high engagement and active development",
    peak: "Peaking — widespread awareness, may be late for new builds",
  };

  return `${stageDesc[stage as keyof typeof stageDesc]}. ${parts.join(". ")}.`;
}

function generateBuildIdeas(
  narrative: string,
  socialTerms: string[],
  devTerms: string[]
): BuildIdea[] {
  // Rule-based build idea generation per narrative
  // This will be replaced by LLM synthesis when we have the API key
  const ideas: Record<string, BuildIdea[]> = {
    "Privacy Infrastructure": [
      {
        title: "Private DeFi Aggregator",
        description: "DEX aggregator that shields transaction details using Solana's confidential transfer extensions. Users swap tokens without revealing amounts or counterparties on-chain.",
        difficulty: "hard",
        category: "DeFi",
      },
      {
        title: "Confidential DAO Voting",
        description: "On-chain governance where votes are encrypted until the voting period ends, preventing bandwagon effects and last-minute vote manipulation.",
        difficulty: "medium",
        category: "Governance",
      },
      {
        title: "Privacy-Preserving Analytics Dashboard",
        description: "Tool that lets protocols analyze user behavior patterns without exposing individual wallet addresses. Uses ZK proofs to generate aggregate stats.",
        difficulty: "hard",
        category: "Analytics",
      },
      {
        title: "Shielded Token Launchpad",
        description: "Fair launch platform where participation amounts are hidden during the sale period, preventing whales from intimidating smaller participants.",
        difficulty: "medium",
        category: "Launchpad",
      },
    ],
    "AI Agent Economy": [
      {
        title: "Agent Reputation System",
        description: "On-chain reputation scores for AI agents based on their transaction history, success rates, and peer reviews. Think credit scores for agents.",
        difficulty: "medium",
        category: "Infrastructure",
      },
      {
        title: "Agent Skill Marketplace",
        description: "Platform where agents can discover, purchase, and integrate new capabilities. Skills are NFTs with usage licenses and version tracking.",
        difficulty: "medium",
        category: "Marketplace",
      },
      {
        title: "Multi-Agent Orchestration Framework",
        description: "Coordination layer for multiple AI agents to collaborate on complex tasks with escrow-based payment splitting and dispute resolution.",
        difficulty: "hard",
        category: "Infrastructure",
      },
      {
        title: "Agent Activity Monitor",
        description: "Real-time dashboard tracking what AI agents are doing on Solana — transactions, interactions, resource usage. The 'etherscan for agents'.",
        difficulty: "easy",
        category: "Analytics",
      },
    ],
    "Agent Commerce": [
      {
        title: "x402 Payment Gateway",
        description: "Middleware that adds pay-per-use billing to any API using the x402 protocol. Developers add one line of code to monetize their services for agents.",
        difficulty: "medium",
        category: "Payments",
      },
      {
        title: "Agent-to-Agent Invoice System",
        description: "Smart contract system where agents can create, send, and settle invoices automatically. Includes dispute resolution and payment terms.",
        difficulty: "medium",
        category: "Commerce",
      },
      {
        title: "Autonomous Service Directory",
        description: "Registry where AI agents list their services with pricing, SLAs, and reviews. Other agents can discover and contract services programmatically.",
        difficulty: "easy",
        category: "Discovery",
      },
    ],
    "DePIN Growth": [
      {
        title: "DePIN Network Aggregator",
        description: "Dashboard comparing all DePIN projects on Solana — device counts, revenue, coverage maps, token performance. One place to evaluate the sector.",
        difficulty: "easy",
        category: "Analytics",
      },
      {
        title: "DePIN Device Staking Platform",
        description: "Stake tokens on specific DePIN devices/locations. Higher-performing devices earn more yield. Creates a market for network quality.",
        difficulty: "hard",
        category: "DeFi",
      },
      {
        title: "Cross-DePIN Data Marketplace",
        description: "Platform where DePIN networks can sell their data to each other and to traditional businesses. Weather data meets WiFi coverage meets delivery routes.",
        difficulty: "medium",
        category: "Data",
      },
    ],
    "Dev Tooling for Solana": [
      {
        title: "AI Audit Copilot for Anchor",
        description: "Tool that reviews Anchor programs for common vulnerabilities, suggests fixes, and generates test cases. Trained on known Solana exploits.",
        difficulty: "hard",
        category: "Security",
      },
      {
        title: "Solana Program Template Generator",
        description: "CLI that generates production-ready Anchor programs from natural language descriptions. Includes tests, deployment scripts, and documentation.",
        difficulty: "medium",
        category: "Developer Experience",
      },
      {
        title: "On-chain Error Decoder",
        description: "Tool that translates cryptic Solana transaction errors into human-readable explanations with suggested fixes. Works across all major protocols.",
        difficulty: "easy",
        category: "Developer Experience",
      },
    ],
    "Restaking & LSTs": [
      {
        title: "LST Yield Optimizer",
        description: "Automatically rotates between liquid staking tokens on Solana based on yield, risk, and liquidity. Like a robo-advisor for SOL staking.",
        difficulty: "medium",
        category: "DeFi",
      },
      {
        title: "Restaking Risk Dashboard",
        description: "Real-time monitoring of restaking positions — slashing risk, operator performance, reward rates. Early warning system for restaking participants.",
        difficulty: "easy",
        category: "Analytics",
      },
    ],
    "Cross-chain": [
      {
        title: "Cross-chain Agent Router",
        description: "Agents on different chains can transact through a unified routing layer. Solana agent pays an Ethereum agent via automatic bridging.",
        difficulty: "hard",
        category: "Infrastructure",
      },
    ],
  };

  return ideas[narrative] ?? [
    {
      title: "Narrative Tracker",
      description: `Build a focused tracking tool for the ${narrative} space — monitoring key metrics, projects, and developments specific to this narrative.`,
      difficulty: "easy",
      category: "Analytics",
    },
  ];
}

const METHODOLOGY = `NarrativeScope detects emerging narratives in the Solana ecosystem by combining multiple signal sources:

1. **Social Signal Detection (X/Twitter):** Searches 12+ queries targeting Solana ecosystem topics. Measures tweet volume, engagement rates (likes, RTs, replies with weighted scoring), and clusters tweets by topic using keyword pattern matching.

2. **Developer Signal Detection (GitHub):** Tracks new repository creation with Solana-related keywords. Measures star velocity (how fast repos gain stars), repo count per topic, and clusters repos by development category.

3. **Cross-Source Correlation:** The key differentiator. Narratives that appear in BOTH social discussion AND developer activity receive a 15-point signal boost. This filters out hype-only narratives (lots of tweets but no one building) and stealth-mode projects (building but no buzz yet).

4. **Stage Classification:** Each narrative is classified by its lifecycle stage:
   - Pre-narrative: Dev activity detected before social buzz
   - Emergence: Growing social discussion and/or dev activity
   - Acceleration: High engagement + active development
   - Peak: Widespread awareness, diminishing novelty

5. **Signal Scoring:** Composite score (0-100) combining social volume (tweet count), social quality (engagement rate), developer volume (repo count), developer quality (stars), and cross-source bonus.

6. **Build Idea Generation:** For each detected narrative, generates 3-5 concrete product ideas with difficulty ratings, targeting practical opportunities for builders.

Data sources: X API v2 (7-day search window), GitHub Search API (30-day repo creation window). Refresh frequency: fortnightly.`;

// CLI entry point
if (import.meta.main) {
  const { readFileSync, writeFileSync, mkdirSync } = await import("fs");

  // Load pre-scanned data or run fresh scans
  let xResult: XScanResult;
  let ghResult: GHScanResult;

  try {
    xResult = JSON.parse(readFileSync("narrative-scope/data/x-scan.json", "utf-8"));
    console.log("Loaded cached X scan data");
  } catch {
    console.log("No cached X data found. Run x-scanner.ts first.");
    process.exit(1);
  }

  try {
    ghResult = JSON.parse(readFileSync("narrative-scope/data/github-scan.json", "utf-8"));
    console.log("Loaded cached GitHub scan data");
  } catch {
    console.log("No cached GitHub data found. Run github-scanner.ts first.");
    process.exit(1);
  }

  const result = aggregateSignals(xResult, ghResult);

  console.log(`\nDetected ${result.narratives.length} narratives:\n`);
  for (const n of result.narratives) {
    console.log(`${n.name} (${n.stage}, confidence: ${n.confidence}, score: ${n.signalScore})`);
    console.log(`  ${n.explanation}`);
    console.log(`  Build ideas: ${n.buildIdeas.map((i) => i.title).join(", ")}`);
    console.log();
  }

  mkdirSync("narrative-scope/data", { recursive: true });
  writeFileSync("narrative-scope/data/narratives.json", JSON.stringify(result, null, 2));
  console.log("Saved to narrative-scope/data/narratives.json");
}
