/**
 * Convert old flat-array scan data into NarrativeScope's expected format.
 * Reads from agent/tasks/{narrative-scan-data,narrative-scan-topics,github-scan-data}.json
 * Writes to narrative-scope/data/{x-scan,github-scan}.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";

// --- Types ---

interface OldTweet {
  text: string;
  author: string;
  likes: number;
  rts: number;
  replies: number;
  created: string;
  query: string;
}

interface XSignal {
  text: string;
  author: string;
  authorId: string;
  likes: number;
  retweets: number;
  replies: number;
  created: string;
  tweetId: string;
  query: string;
  engagementScore: number;
}

interface TopicCluster {
  topic: string;
  tweetCount: number;
  avgEngagement: number;
  totalEngagement: number;
  topTweets: XSignal[];
  keyTerms: string[];
}

interface OldRepo {
  name: string;
  full_name: string;
  description: string;
  stars: number;
  forks: number;
  created: string;
  updated: string;
  language: string;
  url: string;
  query: string;
}

interface GHRepo {
  name: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  created: string;
  updated: string;
  language: string;
  url: string;
  query: string;
}

interface GHTopicCluster {
  topic: string;
  repoCount: number;
  totalStars: number;
  avgStars: number;
  topRepos: GHRepo[];
  keyTerms: string[];
}

// --- Engagement ---

function computeEngagement(likes: number, rts: number, replies: number): number {
  return likes + rts * 2 + replies * 1.5;
}

// --- Key term extraction (same as scanners) ---

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "and", "but", "or", "nor", "not",
  "so", "yet", "both", "either", "neither", "each", "every", "all",
  "this", "that", "these", "those", "it", "its", "they", "them", "their",
  "we", "us", "our", "you", "your", "he", "him", "his", "she", "her",
  "i", "me", "my", "what", "which", "who", "whom", "how", "when", "where",
  "why", "if", "than", "just", "more", "most", "very", "too", "also",
  "about", "up", "out", "no", "https", "co", "rt", "amp",
]);

function extractTweetKeyTerms(signals: XSignal[]): string[] {
  const freq = new Map<string, number>();
  for (const s of signals) {
    const words = s.text.toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

function extractRepoKeyTerms(repos: GHRepo[]): string[] {
  const freq = new Map<string, number>();
  const repoStops = new Set(["the", "a", "an", "for", "and", "with", "that", "this", "from", "solana", "sol", "built", "using", "based"]);
  for (const r of repos) {
    const text = `${r.name} ${r.description}`.toLowerCase();
    const words = text.replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((w) => w.length > 3 && !repoStops.has(w));
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

// --- Topic clustering (mirrors x-scanner.ts patterns) ---

const X_TOPIC_PATTERNS: Record<string, RegExp[]> = {
  "Privacy & Confidential Computing": [
    /privac/i, /confidential/i, /shielded?/i, /hush/i, /arcium/i,
    /ghost/i, /zero.knowledge/i, /zk/i, /encrypt/i,
  ],
  "AI Agent Infrastructure": [
    /\bagent/i, /autonomous/i, /ai.infra/i, /agent.to.agent/i,
    /openclaw/i, /sendai/i, /skills?\smarket/i,
  ],
  "Agent Commerce & Payments": [
    /x402/i, /agent.pay/i, /machine.to.machine/i, /icpay/i,
    /usdc.*agent/i, /agent.*usdc/i, /payment.*agent/i, /agent.*payment/i,
    /gusto/i, /payroll.*solana/i,
  ],
  "DePIN & Physical Infrastructure": [
    /depin/i, /helium/i, /dabba/i, /physical.infra/i,
    /iot.*solana/i, /solana.*iot/i,
  ],
  "Dev Tooling & AI-Assisted Building": [
    /claude.*solana/i, /solana.*claude/i, /anchor.*ai/i,
    /dev.tool/i, /code.gen/i, /ai.*build/i,
  ],
  "Restaking & Liquid Staking": [
    /restaking/i, /fragmetric/i, /solayer/i, /liquid.stak/i,
    /jito.*sol/i, /lst/i,
  ],
  "Cross-chain & Interoperability": [
    /cross.chain/i, /bridge/i, /interop/i, /wormhole/i,
    /multichain/i, /omnichain/i,
  ],
};

function clusterTweets(signals: XSignal[]): TopicCluster[] {
  const clusters: TopicCluster[] = [];
  for (const [topic, patterns] of Object.entries(X_TOPIC_PATTERNS)) {
    const matching = signals.filter((s) => patterns.some((p) => p.test(s.text)));
    if (matching.length === 0) continue;
    const totalEng = matching.reduce((sum, s) => sum + s.engagementScore, 0);
    clusters.push({
      topic,
      tweetCount: matching.length,
      avgEngagement: Math.round(totalEng / matching.length),
      totalEngagement: Math.round(totalEng),
      topTweets: matching.slice(0, 5),
      keyTerms: extractTweetKeyTerms(matching),
    });
  }
  clusters.sort((a, b) => (b.tweetCount * 10 + b.avgEngagement) - (a.tweetCount * 10 + a.avgEngagement));
  return clusters;
}

// --- GitHub topic clustering (mirrors github-scanner.ts patterns) ---

const GH_TOPIC_PATTERNS: Record<string, RegExp[]> = {
  "AI Agent Infrastructure": [
    /\bagent/i, /autonomous/i, /ai.agent/i, /llm/i,
    /chatbot/i, /assistant/i, /skills?\s/i,
  ],
  "Privacy & Confidential Computing": [
    /privac/i, /confidential/i, /shielded?/i, /encrypt/i,
    /zero.knowledge/i, /zk/i, /noir/i, /arcium/i, /hush/i,
  ],
  "Payments & Commerce": [
    /payment/i, /x402/i, /commerce/i, /usdc/i, /pay/i,
    /invoic/i, /checkout/i, /merchant/i,
  ],
  "DePIN": [
    /depin/i, /iot/i, /sensor/i, /physical/i, /hardware/i,
  ],
  "Dev Tooling": [
    /tool/i, /sdk/i, /config/i, /template/i, /scaffold/i,
    /boilerplate/i, /starter/i, /claude/i,
  ],
  "DeFi & Financial": [
    /defi/i, /swap/i, /lend/i, /borrow/i, /yield/i, /staking/i,
    /restaking/i, /liqui/i, /amm/i, /dex/i,
  ],
};

function clusterRepos(repos: GHRepo[]): GHTopicCluster[] {
  const clusters: GHTopicCluster[] = [];
  for (const [topic, patterns] of Object.entries(GH_TOPIC_PATTERNS)) {
    const matching = repos.filter((r) => {
      const text = `${r.name} ${r.description} ${r.query}`;
      return patterns.some((p) => p.test(text));
    });
    if (matching.length === 0) continue;
    const totalStars = matching.reduce((sum, r) => sum + r.stars, 0);
    clusters.push({
      topic,
      repoCount: matching.length,
      totalStars,
      avgStars: Math.round((totalStars / matching.length) * 10) / 10,
      topRepos: matching.slice(0, 5),
      keyTerms: extractRepoKeyTerms(matching),
    });
  }
  clusters.sort((a, b) => (b.repoCount * 5 + b.totalStars) - (a.repoCount * 5 + a.totalStars));
  return clusters;
}

// --- Main ---

function main() {
  mkdirSync("narrative-scope/data", { recursive: true });

  // --- Convert tweets ---
  const flatTweets: OldTweet[] = JSON.parse(readFileSync("agent/tasks/narrative-scan-data.json", "utf-8"));
  const topicTweets: Record<string, OldTweet[]> = JSON.parse(readFileSync("agent/tasks/narrative-scan-topics.json", "utf-8"));

  // Merge both sources, dedup by text prefix
  const allOld = new Map<string, OldTweet>();
  for (const t of flatTweets) allOld.set(t.text.slice(0, 120), t);
  for (const tweets of Object.values(topicTweets)) {
    for (const t of tweets) allOld.set(t.text.slice(0, 120), t);
  }

  let idCounter = 1;
  const signals: XSignal[] = [];
  for (const t of allOld.values()) {
    const eng = computeEngagement(t.likes, t.rts, t.replies);
    if (eng < 20) continue;
    signals.push({
      text: t.text,
      author: t.author.startsWith("@") ? t.author : `@${t.author}`,
      authorId: `synth_${idCounter}`,
      likes: t.likes,
      retweets: t.rts,
      replies: t.replies,
      created: t.created,
      tweetId: `cache_${idCounter++}`,
      query: t.query,
      engagementScore: eng,
    });
  }

  signals.sort((a, b) => b.engagementScore - a.engagementScore);

  const queries = [...new Set(signals.map((s) => s.query))];
  const topicClusters = clusterTweets(signals);

  const xResult = {
    scannedAt: new Date().toISOString(),
    queries,
    signals,
    topicClusters,
  };

  writeFileSync("narrative-scope/data/x-scan.json", JSON.stringify(xResult, null, 2));
  console.log(`X scan: ${signals.length} signals, ${topicClusters.length} clusters, ${queries.length} queries`);
  for (const c of topicClusters) {
    console.log(`  ${c.topic}: ${c.tweetCount} tweets, avg eng ${c.avgEngagement}, terms: ${c.keyTerms.slice(0, 5).join(", ")}`);
  }

  // --- Convert GitHub repos ---
  const oldRepos: OldRepo[] = JSON.parse(readFileSync("agent/tasks/github-scan-data.json", "utf-8"));

  const repos: GHRepo[] = oldRepos
    .filter((r) => r.description && r.description.length >= 10)
    .filter((r) => !/airdrop|free.token|claim.now/i.test(r.description))
    .map((r) => ({
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      stars: r.stars,
      forks: r.forks,
      created: r.created,
      updated: r.updated,
      language: r.language,
      url: r.url,
      query: r.query,
    }));

  repos.sort((a, b) => b.stars - a.stars);

  const ghQueries = [...new Set(repos.map((r) => r.query))];
  const ghClusters = clusterRepos(repos);

  const ghResult = {
    scannedAt: new Date().toISOString(),
    queries: ghQueries,
    repos,
    topicClusters: ghClusters,
  };

  writeFileSync("narrative-scope/data/github-scan.json", JSON.stringify(ghResult, null, 2));
  console.log(`\nGitHub scan: ${repos.length} repos, ${ghClusters.length} clusters, ${ghQueries.length} queries`);
  for (const c of ghClusters) {
    console.log(`  ${c.topic}: ${c.repoCount} repos, ${c.totalStars} stars, terms: ${c.keyTerms.slice(0, 5).join(", ")}`);
  }
}

main();
