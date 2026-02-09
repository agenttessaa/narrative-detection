/**
 * X/Twitter scanner for NarrativeScope
 * Searches for Solana ecosystem tweets, extracts signals, clusters by topic
 */

import { TwitterApi } from "twitter-api-v2";
import { readFileSync, writeFileSync } from "fs";

export interface XSignal {
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

export interface XScanResult {
  scannedAt: string;
  queries: string[];
  signals: XSignal[];
  topicClusters: TopicCluster[];
}

export interface TopicCluster {
  topic: string;
  tweetCount: number;
  avgEngagement: number;
  totalEngagement: number;
  topTweets: XSignal[];
  keyTerms: string[];
  uniqueAuthors: number;
}

// Queries focused on Solana ecosystem emerging narratives
const SCAN_QUERIES = [
  // Core infrastructure
  '"solana" "privacy" -is:retweet lang:en',
  '"solana" "agents" -is:retweet lang:en',
  '"solana" "payments" -is:retweet lang:en',
  '"solana" "depin" -is:retweet lang:en',
  // Emerging
  '"solana" "x402" -is:retweet lang:en',
  '"solana" "confidential" -is:retweet lang:en',
  '"solana" "restaking" -is:retweet lang:en',
  // KOL monitoring
  'from:0xMert_ solana -is:retweet',
  'from:aaboronkov solana -is:retweet',
  'from:rajgokal -is:retweet',
  // Broad emerging signals
  '"built on solana" -is:retweet lang:en',
  '"launching on solana" -is:retweet lang:en',
  '"solana hackathon" -is:retweet lang:en',
];

function computeEngagement(likes: number, rts: number, replies: number): number {
  // Weighted: likes=1, RTs=2 (amplification), replies=1.5 (discussion)
  return likes + rts * 2 + replies * 1.5;
}

export async function scanX(credentialsPath: string, maxPerQuery = 25): Promise<XScanResult> {
  const creds = JSON.parse(readFileSync(credentialsPath, "utf-8"));
  const client = new TwitterApi(creds);

  const allSignals: XSignal[] = [];

  for (const query of SCAN_QUERIES) {
    try {
      const results = await client.v2.search(query, {
        max_results: Math.min(maxPerQuery, 100) as 10 | 25 | 50 | 100,
        sort_order: "relevancy",
        "tweet.fields": ["created_at", "public_metrics", "author_id"],
        "user.fields": ["username"],
        expansions: ["author_id"],
      });

      const users = new Map<string, string>();
      for (const u of results.data.includes?.users ?? []) {
        users.set(u.id, u.username);
      }

      for (const tweet of results.data.data ?? []) {
        const m = tweet.public_metrics;
        if (!m) continue;

        const likes = m.like_count ?? 0;
        const rts = m.retweet_count ?? 0;
        const replies = m.reply_count ?? 0;
        const engagementScore = computeEngagement(likes, rts, replies);

        // Filter: minimum engagement threshold
        if (engagementScore < 20) continue;

        allSignals.push({
          text: tweet.text,
          author: `@${users.get(tweet.author_id ?? "") ?? "unknown"}`,
          authorId: tweet.author_id ?? "",
          likes,
          retweets: rts,
          replies,
          created: tweet.created_at ?? "",
          tweetId: tweet.id,
          query,
          engagementScore,
        });
      }

      // Rate limit courtesy
      await new Promise((r) => setTimeout(r, 200));
    } catch (e: any) {
      if (e.code === 429) {
        console.error(`Rate limited on query: ${query}`);
        break;
      }
      console.error(`Error on query "${query}":`, e.message);
    }
  }

  // Deduplicate by tweet ID
  const seen = new Set<string>();
  const deduped = allSignals.filter((s) => {
    if (seen.has(s.tweetId)) return false;
    seen.add(s.tweetId);
    return true;
  });

  // Sort by engagement
  deduped.sort((a, b) => b.engagementScore - a.engagementScore);

  // Cluster by topic
  const topicClusters = clusterByTopic(deduped);

  return {
    scannedAt: new Date().toISOString(),
    queries: SCAN_QUERIES,
    signals: deduped,
    topicClusters,
  };
}

function clusterByTopic(signals: XSignal[]): TopicCluster[] {
  // Topic keyword patterns — what we're looking for
  const topicPatterns: Record<string, RegExp[]> = {
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

  const clusters: TopicCluster[] = [];

  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    const matching = signals.filter((s) =>
      patterns.some((p) => p.test(s.text))
    );

    if (matching.length === 0) continue;

    const totalEng = matching.reduce((sum, s) => sum + s.engagementScore, 0);
    const avgEng = totalEng / matching.length;

    // Extract key terms from matching tweets
    const keyTerms = extractKeyTerms(matching);

    // Count unique authors for diversity signal
    const uniqueAuthors = new Set(matching.map(s => s.authorId)).size;

    clusters.push({
      topic,
      tweetCount: matching.length,
      avgEngagement: Math.round(avgEng),
      totalEngagement: Math.round(totalEng),
      topTweets: matching.slice(0, 5),
      keyTerms,
      uniqueAuthors,
    });
  }

  // Sort by signal strength (weighted combo of count and engagement)
  clusters.sort((a, b) => {
    const scoreA = a.tweetCount * 10 + a.avgEngagement;
    const scoreB = b.tweetCount * 10 + b.avgEngagement;
    return scoreB - scoreA;
  });

  return clusters;
}

function extractKeyTerms(signals: XSignal[]): string[] {
  const wordFreq = new Map<string, number>();
  const stopWords = new Set([
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

  for (const s of signals) {
    const words = s.text.toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    for (const w of words) {
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
    }
  }

  return [...wordFreq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

// CLI entry point
if (import.meta.main) {
  const result = await scanX("agent/vault/x-credentials.json");
  console.log(`Scanned ${result.signals.length} tweets across ${result.queries.length} queries`);
  console.log(`\nTopic clusters:`);
  for (const c of result.topicClusters) {
    console.log(`  ${c.topic}: ${c.tweetCount} tweets, avg engagement ${c.avgEngagement}`);
    console.log(`    Key terms: ${c.keyTerms.join(", ")}`);
  }
  writeFileSync("narrative-scope/data/x-scan.json", JSON.stringify(result, null, 2));
  console.log("\nSaved to narrative-scope/data/x-scan.json");
}
