#!/usr/bin/env bun
/**
 * NarrativeScope — Main Runner
 * Runs the full pipeline: X scan → GitHub scan → Aggregate → Generate output
 *
 * Usage:
 *   bun narrative-scope/src/run.ts              # full scan (X + GitHub + aggregate + HTML)
 *   bun narrative-scope/src/run.ts --cached      # use cached scan data, just re-aggregate + HTML
 *   bun narrative-scope/src/run.ts --serve       # start web server on port 3456
 */

setTimeout(() => process.exit(0), 120_000); // 2min hard timeout

import { scanX } from "./x-scanner";
import { scanGitHub } from "./github-scanner";
import { aggregateSignals } from "./aggregator";
import { synthesizeAll } from "./llm-synthesis";
import { generateHTML } from "./web-output";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";

const args = process.argv.slice(2);
const useCached = args.includes("--cached");
const serve = args.includes("--serve");

mkdirSync("narrative-scope/data", { recursive: true });
mkdirSync("narrative-scope/public", { recursive: true });

async function main() {
  console.log("=== NarrativeScope ===\n");

  let xResult, ghResult;

  if (useCached) {
    console.log("Using cached scan data...\n");
    try {
      xResult = JSON.parse(readFileSync("narrative-scope/data/x-scan.json", "utf-8"));
      console.log(`  X: ${xResult.signals.length} tweets loaded`);
    } catch {
      console.error("No cached X data. Run without --cached first.");
      process.exit(1);
    }
    try {
      ghResult = JSON.parse(readFileSync("narrative-scope/data/github-scan.json", "utf-8"));
      console.log(`  GitHub: ${ghResult.repos.length} repos loaded`);
    } catch {
      console.error("No cached GitHub data. Run without --cached first.");
      process.exit(1);
    }
  } else {
    // Run X scan
    console.log("Step 1/4: Scanning X for Solana ecosystem signals...");
    const xCredsPath = process.env.X_CREDENTIALS_PATH
      || (existsSync("credentials/x-credentials.json") ? "credentials/x-credentials.json" : "agent/vault/x-credentials.json");
    if (!existsSync(xCredsPath)) {
      console.error(`X credentials not found. Set X_CREDENTIALS_PATH env var or create credentials/x-credentials.json`);
      process.exit(1);
    }
    xResult = await scanX(xCredsPath, 25);
    writeFileSync("narrative-scope/data/x-scan.json", JSON.stringify(xResult, null, 2));
    console.log(`  Found ${xResult.signals.length} tweets, ${xResult.topicClusters.length} clusters\n`);

    // Run GitHub scan
    console.log("Step 2/4: Scanning GitHub for new Solana repos...");
    // Check for optional GitHub token
    let ghToken: string | undefined;
    if (process.env.GITHUB_TOKEN) {
      ghToken = process.env.GITHUB_TOKEN;
    } else {
      for (const p of ["credentials/github-credentials.json", "agent/vault/github-credentials.json"]) {
        try {
          const ghCreds = JSON.parse(readFileSync(p, "utf-8"));
          ghToken = ghCreds.token;
          break;
        } catch {}
      }
      if (!ghToken) console.log("  (no GitHub token found, using unauthenticated — slower rate limits)");
    }
    ghResult = await scanGitHub(ghToken, 30);
    writeFileSync("narrative-scope/data/github-scan.json", JSON.stringify(ghResult, null, 2));
    console.log(`  Found ${ghResult.repos.length} repos, ${ghResult.topicClusters.length} clusters\n`);
  }

  // Aggregate
  console.log("Step 3/5: Aggregating signals and detecting narratives...");
  const narratives = aggregateSignals(xResult, ghResult);
  console.log(`  Detected ${narratives.narratives.length} emerging narratives\n`);

  // LLM Synthesis
  console.log("Step 4/5: LLM synthesis (Claude) for explanations + build ideas...");
  try {
    const synthResults = await synthesizeAll(narratives.narratives);
    for (const n of narratives.narratives) {
      const synth = synthResults.get(n.name);
      if (synth) {
        n.explanation = synth.explanation;
        n.buildIdeas = synth.buildIdeas;
      }
    }
    console.log(`  Synthesized ${synthResults.size} narratives\n`);
  } catch (e) {
    console.error("  LLM synthesis failed, using rule-based fallback:", e);
  }

  writeFileSync("narrative-scope/data/narratives.json", JSON.stringify(narratives, null, 2));

  for (const n of narratives.narratives) {
    const emoji = {
      "pre-narrative": "🔵",
      emergence: "🟢",
      acceleration: "🟡",
      peak: "🟠",
    }[n.stage];
    console.log(`  ${emoji} ${n.name} (${n.stage}, score: ${n.signalScore}, confidence: ${Math.round(n.confidence * 100)}%)`);
    console.log(`     ${n.explanation}`);
    console.log(`     Ideas: ${n.buildIdeas.map((i) => i.title).join(" | ")}`);
    console.log();
  }

  // Generate HTML
  console.log("Step 5/5: Generating web output...");
  const html = generateHTML(narratives);
  writeFileSync("narrative-scope/public/index.html", html);
  console.log("  Saved to narrative-scope/public/index.html\n");

  // Also write a JSON API endpoint
  writeFileSync("narrative-scope/public/api.json", JSON.stringify(narratives, null, 2));
  console.log("  JSON API at narrative-scope/public/api.json\n");

  console.log("=== Done ===");

  if (serve) {
    startServer();
  }
}

function startServer() {
  const port = 3456;
  console.log(`\nStarting server on port ${port}...`);

  Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;

      if (path === "/" || path === "/index.html") {
        try {
          const html = readFileSync("narrative-scope/public/index.html", "utf-8");
          return new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        } catch {
          return new Response("Not generated yet. Run without --serve first.", { status: 404 });
        }
      }

      if (path === "/api.json" || path === "/api") {
        try {
          const json = readFileSync("narrative-scope/public/api.json", "utf-8");
          return new Response(json, {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("{}", { status: 404 });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Server running at http://localhost:${port}`);
  console.log(`  HTML: http://localhost:${port}/`);
  console.log(`  API:  http://localhost:${port}/api.json`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
