/**
 * GitHub scanner for NarrativeScope
 * Tracks new Solana ecosystem repos, star velocity, and dev activity patterns
 */

export interface GHRepo {
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

export interface GHScanResult {
  scannedAt: string;
  queries: string[];
  repos: GHRepo[];
  topicClusters: GHTopicCluster[];
}

export interface GHTopicCluster {
  topic: string;
  repoCount: number;
  totalStars: number;
  avgStars: number;
  topRepos: GHRepo[];
  keyTerms: string[];
}

const SCAN_QUERIES = [
  "solana+agent",
  "solana+privacy",
  "solana+payments",
  "anchor+solana",
  "solana+depin",
  "solana+x402",
  "solana+confidential",
  "solana+restaking",
  "solana+ai",
  "solana+toolkit",
];

export async function scanGitHub(token?: string, sinceDaysAgo = 30): Promise<GHScanResult> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "NarrativeScope/1.0",
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDaysAgo);
  const sinceStr = sinceDate.toISOString().split("T")[0];

  const allRepos: GHRepo[] = [];

  for (const query of SCAN_QUERIES) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+created:>${sinceStr}&sort=stars&order=desc&per_page=30`;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.error(`GitHub API error for "${query}": ${res.status} ${res.statusText}`);
        if (res.status === 403) {
          console.error("Rate limited. Stopping.");
          break;
        }
        continue;
      }

      const data = await res.json() as any;

      for (const repo of data.items ?? []) {
        allRepos.push({
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description ?? "",
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          created: repo.created_at,
          updated: repo.updated_at,
          language: repo.language ?? "unknown",
          url: repo.html_url,
          query,
        });
      }

      // Rate limit courtesy — 10 req/min for unauthenticated
      await new Promise((r) => setTimeout(r, token ? 200 : 6500));
    } catch (e: any) {
      console.error(`Error scanning "${query}":`, e.message);
    }
  }

  // Deduplicate by full_name
  const seen = new Set<string>();
  const deduped = allRepos.filter((r) => {
    if (seen.has(r.fullName)) return false;
    seen.add(r.fullName);
    return true;
  });

  // Filter out obvious spam/forks with no content
  const filtered = deduped.filter((r) => {
    // Must have some description
    if (!r.description || r.description.length < 10) return false;
    // Filter obvious airdrop/scam repos
    if (/airdrop|free.token|claim.now/i.test(r.description)) return false;
    return true;
  });

  filtered.sort((a, b) => b.stars - a.stars);

  const topicClusters = clusterReposByTopic(filtered);

  return {
    scannedAt: new Date().toISOString(),
    queries: SCAN_QUERIES,
    repos: filtered,
    topicClusters,
  };
}

function clusterReposByTopic(repos: GHRepo[]): GHTopicCluster[] {
  const topicPatterns: Record<string, RegExp[]> = {
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

  const clusters: GHTopicCluster[] = [];

  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    const matching = repos.filter((r) => {
      const text = `${r.name} ${r.description} ${r.query}`;
      return patterns.some((p) => p.test(text));
    });

    if (matching.length === 0) continue;

    const totalStars = matching.reduce((sum, r) => sum + r.stars, 0);
    const avgStars = totalStars / matching.length;

    const keyTerms = extractKeyTerms(matching);

    clusters.push({
      topic,
      repoCount: matching.length,
      totalStars,
      avgStars: Math.round(avgStars * 10) / 10,
      topRepos: matching.slice(0, 5),
      keyTerms,
    });
  }

  clusters.sort((a, b) => {
    const scoreA = a.repoCount * 5 + a.totalStars;
    const scoreB = b.repoCount * 5 + b.totalStars;
    return scoreB - scoreA;
  });

  return clusters;
}

function extractKeyTerms(repos: GHRepo[]): string[] {
  const wordFreq = new Map<string, number>();
  const stopWords = new Set([
    "the", "a", "an", "for", "and", "with", "that", "this", "from",
    "solana", "sol", "built", "using", "based",
  ]);

  for (const r of repos) {
    const text = `${r.name} ${r.description}`.toLowerCase();
    const words = text
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
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
  const { writeFileSync, mkdirSync } = await import("fs");
  mkdirSync("narrative-scope/data", { recursive: true });

  console.log("Scanning GitHub for Solana ecosystem repos...");
  const result = await scanGitHub(undefined, 30);
  console.log(`Found ${result.repos.length} repos across ${result.queries.length} queries`);
  console.log(`\nTopic clusters:`);
  for (const c of result.topicClusters) {
    console.log(`  ${c.topic}: ${c.repoCount} repos, ${c.totalStars} total stars`);
    console.log(`    Key terms: ${c.keyTerms.join(", ")}`);
  }
  writeFileSync("narrative-scope/data/github-scan.json", JSON.stringify(result, null, 2));
  console.log("\nSaved to narrative-scope/data/github-scan.json");
}
