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

## Live Demo

**Hosted tool:** [http://64.225.63.234:3456/](http://64.225.63.234:3456/)

Interactive HTML dashboard with all detected narratives, signal breakdowns, top tweets/repos, and build ideas. JSON API at `/api.json`.

## Detected Narratives (Latest Output)

From a Feb 9, 2026 live scan (148 tweets, 184 repos analyzed):

| Narrative | Stage | Score | Tweets | Repos | Stars | Confidence |
|-----------|-------|-------|--------|-------|-------|-----------|
| AI Agent Economy | Peak | 91 | 42 | 58 | 240 | 95% |
| Agent Commerce | Peak | 81 | 19 | 56 | 120 | 95% |
| Restaking & LSTs | Acceleration | 72 | 7 | 29 | 93 | 81% |
| Privacy Infrastructure | Acceleration | 67 | 40 | 53 | 41 | 95% |
| Dev Tooling for Solana | Emergence | 61 | 2 | 47 | 252 | 57% |
| DePIN Growth | Emergence | 40 | 15 | 2 | 0 | 80% |

**What the stages tell you:**
- AI Agent Economy and Agent Commerce are at **Peak** — widespread awareness, many unique voices. Still opportunity in infrastructure/tooling but the narrative is mature
- Dev Tooling scores 61 despite only 2 tweets — that's 252 GitHub stars across 47 new repos. Builders are active, social hasn't caught up yet. This is the kind of signal that matters: developer conviction ahead of social hype
- Privacy is interesting at Acceleration — 40 tweets but only 41 stars. Lots of talk, less building. The opportunity is in execution
- DePIN shows social buzz (15 tweets) but only 2 new repos. Early signal worth watching

## Build Ideas (Latest)

Each narrative generates 3-5 build ideas with difficulty ratings, grounded in the actual signals detected. These aren't generic suggestions — they're derived from what's being discussed and built RIGHT NOW. Here are highlights:

**AI Agent Economy (Peak, Score 91)**
- Agent Credit Scoring Protocol — on-chain reputation tracking agent transaction history and success rates. Signal data shows "credit" as a key term and agents "funding their own keys" (medium)
- Agent-to-Agent Escrow Service — smart contracts for autonomous agent transactions with dispute resolution based on verifiable outcomes. Agents now managing payments across 700+ markets (medium)
- Agent Skill Analytics Dashboard — real-time monitoring of the skills marketplace showing capability success rates and ROI (easy)

**Agent Commerce (Peak, Score 81)**
- Agent Reputation Oracle — onchain reputation scoring based on x402 transaction history and credit repayment. Agents getting autonomous credit lines need trustless creditworthiness assessment (medium)
- Agent Service Marketplace — decentralized discovery for agent-to-agent services using x402 payments. 56 new repos but no central discovery mechanism (medium)

**Privacy Infrastructure (Acceleration, Score 67)**
- Private Payroll Protocol — Solana program using Arcium MPC for DAO payroll that hides individual salaries while proving budget compliance (hard)
- Privacy Score Dashboard — scores wallets on privacy exposure, suggests remediation using emerging stack (Arcium, GhostWareOS) (medium)

**Dev Tooling for Solana (Emergence, Score 61)**
- Anchor Copilot VSCode Extension — intelligent autocomplete and code generation for Anchor, trained on top Solana programs (medium)
- Stablecoin Payment SDK — lightweight TypeScript SDK for Solana stablecoin payments with wallet connection and swap routing (easy)

**Restaking & LSTs (Acceleration, Score 72)**
- AI Agent LST Rebalancer — autonomous agent toolkit for managing LST portfolios, monitoring validator performance, auto-rebalancing (medium)

**DePIN Growth (Emergence, Score 40)**
- DePIN Node Registry SDK — Solana program + TypeScript SDK for registering and verifying physical nodes on-chain with location proofs (medium)

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
