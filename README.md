# NarrativeScope

Detects emerging narratives in the Solana ecosystem by combining social signals (X/Twitter) with developer activity (GitHub). Surfaces narratives at the **emergence stage** — after builders start but before mainstream awareness — and generates concrete product ideas for each.

## What makes this different

Most narrative tracking tools (Santiment, LunarCrush, AIXBT) have one or more of these problems:
- Track **known** narratives (pre-defined categories), don't discover new ones
- Use a **single data source** (social OR on-chain, never both)
- No **actionable output** (trend names without build ideas)
- Not **Solana-specific** (generic crypto tools)

NarrativeScope is built to solve all four:
1. **Cross-source correlation** — the core edge. It compares what people are **talking about** on X with what developers are **building** on GitHub. Narratives with both social buzz AND active development score higher than hype-only or stealth-mode signals
2. **Source diversity analysis** — counts unique authors per narrative to distinguish organic discussion from one person shilling
3. **Stage classification** — tells you WHERE a narrative is in its lifecycle (pre-narrative → emergence → acceleration → peak), so you know if you're early or late
4. **Concrete build ideas** — each narrative comes with 3-5 actionable product ideas with difficulty ratings, not just a trend name

## How it works

```
X API (7-day search)                        GitHub API (30-day repos)
├── 12+ topic queries                       ├── 10 keyword searches
├── KOL monitoring                          ├── Star velocity tracking
├── Engagement scoring                      └── Spam/fork filtering
│   (likes + 2×RTs + 1.5×replies)               │
└───────────────┬───────────────────────────────┘
                │
        Signal Aggregator
        ├── Topic clustering (regex pattern matching)
        ├── Cross-source correlation (scaled signal bonus)
        ├── Source diversity analysis (unique authors)
        ├── Stage classification (pre-narrative → peak)
        └── Confidence scoring (0-95%)
                │
        LLM Synthesis (Claude)
        ├── Narrative explanations from raw signals
        └── 3-5 build ideas per narrative
                │
        Web Output
        ├── Static HTML page
        └── JSON API endpoint
```

### Signal Scoring

Each narrative gets a composite score (0-100) from three components:

**Social signals (0-40)**
- Volume: tweet count × 2.5, capped at 15
- Quality: avg engagement / 60, capped at 20
- Source diversity: unique authors / tweet count × unique authors, capped at 5. High diversity = organic signal, not one account shilling

**Developer signals (0-40)**
- Volume: repo count × 2, capped at 15
- Quality: total stars / 10, capped at 20
- Dev diversity: repos × log2(avg stars + 1), capped at 5. Stars spread across many repos = healthier ecosystem

**Cross-source bonus (0-20)**
Narratives present in BOTH X and GitHub get a scaled bonus based on the strength of each source (not a flat bonus). Weak cross-source = +10, strong cross-source = up to +20

### Stage Classification

| Stage | What it means | Detection criteria |
|-------|--------------|-------------------|
| Pre-narrative | Dev activity before social buzz | GitHub repos exist, little/no X discussion |
| Emergence | Growing social + dev activity | Either strong social OR strong dev signals |
| Acceleration | High engagement + active dev | Both strong social (5+ tweets, 100+ avg engagement) AND strong dev (5+ repos, 20+ stars), 200+ avg engagement |
| Peak | Widespread awareness, many voices | All acceleration criteria + 500+ avg engagement + 8+ unique authors |

### Data Sources

| Source | Window | Method | Cost |
|--------|--------|--------|------|
| X/Twitter API v2 | 7 days | Recent search, relevancy sort | ~$0.06/scan (12 queries × $0.005) |
| GitHub API | 30 days | Repository search, star sort | Free (public API) |

## Setup

### Prerequisites
- [Bun](https://bun.sh) runtime
- X/Twitter API credentials (Basic tier, OAuth 1.0a)
- Optional: Anthropic API key (enables LLM-powered narrative explanations)
- Optional: GitHub token (increases rate limits from 10 to 30 req/min)

### Install

```bash
git clone https://github.com/agenttessaa/narrative-scope.git
cd narrative-scope
bun install  # installs twitter-api-v2 dependency
```

### Configure

Create credential files (paths are configurable in `src/run.ts`):

1. X API credentials at `credentials/x-credentials.json`:
```json
{
  "appKey": "...",
  "appSecret": "...",
  "accessToken": "...",
  "accessSecret": "..."
}
```

2. (Optional) Anthropic API key for LLM synthesis — set `ANTHROPIC_API_KEY` env var or create `credentials/anthropic-api-key.txt`. Without it, the tool still works using rule-based explanations and build ideas.

3. (Optional) GitHub token at `credentials/github-credentials.json`:
```json
{ "token": "ghp_..." }
```

Without a GitHub token, the GitHub scanner works but with lower rate limits (10 req/min vs 30).

### Run

```bash
# Full scan (X + GitHub + aggregate + generate HTML)
bun narrative-scope/src/run.ts

# Use cached scan data (skip API calls, just re-aggregate)
bun narrative-scope/src/run.ts --cached

# Start web server after generating
bun narrative-scope/src/run.ts --serve
```

### Output

- `narrative-scope/public/index.html` — Static HTML page with all detected narratives
- `narrative-scope/public/api.json` — JSON API with full signal data
- `narrative-scope/data/` — Raw scan data (X tweets, GitHub repos, aggregated narratives)

## Architecture

```
narrative-scope/
├── src/
│   ├── x-scanner.ts       # X/Twitter signal collection
│   ├── github-scanner.ts  # GitHub repo discovery
│   ├── aggregator.ts      # Cross-source signal correlation
│   ├── llm-synthesis.ts   # Claude-powered narrative explanations + build ideas
│   ├── web-output.ts      # HTML page generation
│   └── run.ts             # Main pipeline runner
├── data/                  # Scan results (gitignored)
├── public/                # Generated web output
└── README.md
```

### Module Responsibilities

**x-scanner.ts**: Searches X for Solana ecosystem tweets using 12+ queries. Extracts engagement metrics, deduplicates, and clusters by topic using regex pattern matching. Filters tweets below engagement threshold (score < 20).

**github-scanner.ts**: Searches GitHub for new repos with Solana-related keywords (created in last 30 days). Filters spam/airdrops, deduplicates, clusters by development category.

**aggregator.ts**: The core algorithm. Aligns X and GitHub topic clusters, computes composite signal scores, classifies narrative stages, generates confidence levels, and produces initial build ideas for each detected narrative.

**llm-synthesis.ts**: Sends each detected narrative's raw signal data to Claude (Sonnet 4.5) for richer explanations and more creative, context-aware build ideas. Falls back to rule-based output if the API is unavailable.

**web-output.ts**: Renders detected narratives as a responsive, dark-themed HTML page. Each narrative shows metrics, top signals (tweets + repos), key terms, and actionable build ideas with difficulty ratings.

## Demo

Run locally after cloning:

```bash
bun src/run.ts --serve   # generates fresh data + serves at http://localhost:3456
```

Interactive HTML dashboard with all detected narratives, signal breakdowns, top tweets/repos, and build ideas. JSON API at `/api.json`.

## Detected Narratives (Latest Output)

From a Feb 13, 2026 live scan (133 tweets, 242 repos analyzed):

| Narrative | Stage | Score | Tweets | Repos | Stars | Confidence |
|-----------|-------|-------|--------|-------|-------|-----------|
| AI Agent Economy | Acceleration | 82 | 50 | 61 | 190 | 95% |
| Dev Tooling for Solana | Emergence | 75 | 5 | 42 | 237 | 81% |
| Restaking & LSTs | Acceleration | 73 | 6 | 29 | 112 | 81% |
| Agent Commerce | Emergence | 72 | 15 | 56 | 132 | 95% |
| Privacy Infrastructure | Acceleration | 64 | 36 | 50 | 39 | 90% |
| DePIN Growth | Emergence | 45 | 17 | 4 | 0 | 88% |
| Cross-chain | Emergence | 16 | 4 | 0 | 0 | 49% |

**What the stages tell you:**
- AI Agent Economy dropped from Peak to **Acceleration** — narrative cooling from its Feb 9 peak. Still dominant but the initial hype wave is settling into sustained builder activity (61 repos, 190 stars)
- Dev Tooling jumped to 75 (was 61) — 237 stars across 42 repos shows strong developer conviction. Social is still quiet (5 tweets) but builders are shipping
- Cross-chain is a new emergence signal — early cross-ecosystem infrastructure appearing alongside Solana-native development
- Privacy Infrastructure holds at Acceleration with strong social signal (36 tweets) but low star counts (39) — opportunity is in building, not talking
- DePIN still early (17 tweets, 4 repos) — watching for developer activity to confirm

## Build Ideas (Latest)

Each narrative generates 3-5 build ideas with difficulty ratings, grounded in the actual signals detected. These aren't generic suggestions — they're derived from what's being discussed and built RIGHT NOW. Here are highlights:

**AI Agent Economy (Acceleration, Score 82)**
- Agent Treasury Dashboard — real-time monitoring and analytics for AI agent wallets, treasury movements, and on-chain behavior patterns (medium)
- x402 Payment Gateway SDK — developer-friendly SDK simplifying x402 protocol integration for Solana apps, enabling autonomous agent payments (medium)
- Agent Identity Verification Registry — on-chain registry for verifying agent identities and capabilities, addressing the trust gap as agents get autonomous credit (hard)

**Dev Tooling for Solana (Emergence, Score 75)**
- Agent Wallet SDK — purpose-built wallet library for AI agents with autonomous transaction signing, risk limits, and multi-sig controls (medium)
- Privacy Mixer for Agent Transactions — lightweight privacy protocol for AI agent transactions on Solana, following the week's focus on on-chain privacy (hard)

**Restaking & LSTs (Acceleration, Score 73)**
- LST Yield Aggregator Dashboard — real-time analytics comparing yields across Solana's LST protocols and new restaking opportunities like Fragmetric (easy)
- Restaking Strategy AI Agent — autonomous agent that monitors LST positions and automatically rebalances between protocols based on yield changes (medium)

**Agent Commerce (Emergence, Score 72)**
- Agent API Marketplace — marketplace where developers list APIs that AI agents can discover and pay for using x402 payments (medium)
- Agent Spend Analytics Dashboard — tracks the 38M+ agent transactions on Solana, categorizing spending patterns and wallet behavior (easy)

**Privacy Infrastructure (Acceleration, Score 64)**
- PrivateDEX Aggregator — routes trades through privacy layers like Arcium and GhostSend, showing privacy scores per route (medium)
- Wallet Privacy Scorer — browser extension scoring Solana wallets on privacy exposure based on transaction patterns (easy)

## Reproduction

```bash
# 1. Clone and set up credentials (see Setup above)
git clone https://github.com/agenttessaa/narrative-scope.git && cd narrative-scope

# 2. Run full pipeline (~60-90 seconds)
bun src/run.ts

# 3. View results
open public/index.html        # interactive HTML dashboard
cat public/api.json | jq .    # raw JSON with all signals

# 4. Or start a local server
bun src/run.ts --serve         # serves at http://localhost:3456

# 5. Re-aggregate without re-scanning (instant)
bun src/run.ts --cached        # uses cached scan data
```

**Note:** X search results are time-dependent (7-day rolling window). GitHub results shift as new repos are created. Running at different times shows narrative evolution — that's a feature, not a bug. The `--cached` flag lets you re-run aggregation and HTML generation with previously fetched data.

## Extending

The architecture is modular — each data source is an independent scanner that outputs clustered signals.

- **Add data sources**: Create a new scanner following the pattern in x-scanner.ts. Export a scan function returning clustered data, add alignment mapping in aggregator.ts
- **On-chain data**: Add Helius/Solana RPC scanner for program deployment tracking, TVL changes, new token launches
- **Automated refresh**: Run as a cron job for fortnightly updates with historical trend tracking
- **Discord/forum monitoring**: Add scanners for Solana Discord, governance forums, research blogs

## License

MIT
