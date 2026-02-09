/**
 * Web Output Generator for NarrativeScope
 * Generates a polished static HTML page from detected narratives
 * Features: summary overview, collapsible cards, signal gauges, responsive design
 */

import type { AggregatorResult, DetectedNarrative } from "./aggregator";

export function generateHTML(result: AggregatorResult): string {
  const narrativeCards = result.narratives
    .map((n, i) => renderNarrativeCard(n, i))
    .join("\n");

  const overviewItems = result.narratives
    .map((n, i) => renderOverviewItem(n, i))
    .join("\n");

  const totalTweets = result.narratives.reduce((s, n) => s + n.signals.social.tweetCount, 0);
  const totalRepos = result.narratives.reduce((s, n) => s + n.signals.developer.repoCount, 0);
  const avgConfidence = result.narratives.length > 0
    ? Math.round(result.narratives.reduce((s, n) => s + n.confidence, 0) / result.narratives.length * 100)
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NarrativeScope — Solana Emerging Narratives</title>
  <meta name="description" content="Real-time emerging narrative detection in the Solana ecosystem. Cross-source signal analysis combining X social signals and GitHub developer activity.">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --bg: #08080d;
      --surface: #111118;
      --surface2: #16161f;
      --border: #1e1e2e;
      --border-hover: #2a2a3e;
      --text: #e0e0e8;
      --text-dim: #7878a0;
      --text-muted: #50506a;
      --accent: #6366f1;
      --accent-dim: rgba(99,102,241,0.15);
      --accent2: #22d3ee;
      --accent2-dim: rgba(34,211,238,0.12);
      --green: #22c55e;
      --green-dim: rgba(34,197,94,0.12);
      --yellow: #eab308;
      --yellow-dim: rgba(234,179,8,0.12);
      --orange: #f97316;
      --orange-dim: rgba(249,115,22,0.12);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }

    /* Header */
    header {
      text-align: center;
      margin-bottom: 2.5rem;
    }

    .logo {
      font-size: 2.2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 0.4rem;
    }
    .logo span { color: var(--accent); }

    .tagline {
      color: var(--text-dim);
      font-size: 0.92rem;
      max-width: 480px;
      margin: 0 auto;
    }

    .header-meta {
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 1rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    /* Stats bar */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 2.5rem;
    }

    .stat {
      background: var(--surface);
      padding: 1.25rem 1rem;
      text-align: center;
    }

    .stat-value {
      font-size: 1.6rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent2);
    }

    .stat-label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 0.2rem;
    }

    /* Overview grid */
    .overview {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
      margin-bottom: 2.5rem;
    }

    .overview-item {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
      overflow: hidden;
    }

    .overview-item:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }

    .overview-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }

    .overview-item.stage-emergence::before { background: var(--accent2); }
    .overview-item.stage-acceleration::before { background: var(--green); }
    .overview-item.stage-peak::before { background: var(--orange); }
    .overview-item.stage-pre-narrative::before { background: var(--text-muted); }

    .ov-name {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .ov-score {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .ov-score-bar {
      flex: 1;
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
    }

    .ov-score-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .ov-score-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-dim);
      min-width: 24px;
      text-align: right;
    }

    .ov-stage {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 0.4rem;
      color: var(--text-muted);
    }

    /* Section headers */
    .section-header {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }

    /* Narrative cards */
    .narrative-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      margin-bottom: 1rem;
      transition: border-color 0.2s;
      overflow: hidden;
    }

    .narrative-card:hover { border-color: var(--border-hover); }

    .card-top {
      padding: 1.25rem 1.5rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      user-select: none;
    }

    .card-top-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }

    .score-ring {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }

    .score-ring circle {
      fill: none;
      stroke-width: 4;
    }

    .score-ring .ring-bg {
      stroke: var(--border);
    }

    .score-ring .ring-fill {
      stroke-linecap: round;
      transition: stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .score-ring text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      fill: var(--text);
      text-anchor: middle;
      dominant-baseline: central;
    }

    .card-title-area {
      flex: 1;
    }

    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.3;
    }

    .card-subtitle {
      font-size: 0.8rem;
      color: var(--text-dim);
      margin-top: 0.15rem;
    }

    .card-top-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .stage-badge {
      font-size: 0.68rem;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }

    .stage-pre-narrative { background: rgba(136,136,160,0.15); color: var(--text-muted); }
    .stage-emergence { background: var(--accent2-dim); color: var(--accent2); }
    .stage-acceleration { background: var(--green-dim); color: var(--green); }
    .stage-peak { background: var(--orange-dim); color: var(--orange); }

    .expand-icon {
      width: 20px;
      height: 20px;
      color: var(--text-muted);
      transition: transform 0.3s;
      flex-shrink: 0;
    }

    .narrative-card.expanded .expand-icon {
      transform: rotate(180deg);
    }

    /* Expandable detail section */
    .card-detail {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .narrative-card.expanded .card-detail {
      max-height: 2000px;
    }

    .card-detail-inner {
      padding: 0 1.5rem 1.5rem;
      border-top: 1px solid var(--border);
    }

    .detail-metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      padding-top: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .d-metric {
      background: var(--surface2);
      padding: 0.6rem;
      border-radius: 8px;
      text-align: center;
    }

    .d-metric-value {
      font-size: 1.15rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent2);
    }

    .d-metric-label {
      font-size: 0.65rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .detail-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.5rem;
      margin-top: 1rem;
    }

    .key-terms {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 0.5rem;
    }

    .term-tag {
      font-size: 0.72rem;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
      background: var(--accent-dim);
      color: var(--accent);
      font-family: 'JetBrains Mono', monospace;
    }

    .signal-list { margin-bottom: 0.5rem; }

    .signal-item {
      background: var(--surface2);
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      margin-bottom: 0.35rem;
      font-size: 0.82rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .signal-text {
      flex: 1;
      color: var(--text);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.45;
    }

    .signal-meta {
      font-size: 0.7rem;
      color: var(--text-muted);
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.15rem;
    }

    .signal-item a {
      color: var(--accent);
      text-decoration: none;
      font-size: 0.7rem;
    }
    .signal-item a:hover { text-decoration: underline; }

    .build-ideas { margin-top: 0.5rem; }

    .idea {
      background: var(--accent-dim);
      border-left: 3px solid var(--accent);
      padding: 0.7rem 0.9rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 0.4rem;
    }

    .idea-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.2rem;
    }

    .idea-title {
      font-weight: 600;
      font-size: 0.85rem;
    }

    .idea-difficulty {
      font-size: 0.65rem;
      padding: 0.12rem 0.45rem;
      border-radius: 999px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }

    .diff-easy { background: var(--green-dim); color: var(--green); }
    .diff-medium { background: var(--yellow-dim); color: var(--yellow); }
    .diff-hard { background: var(--orange-dim); color: var(--orange); }

    .idea-desc {
      font-size: 0.8rem;
      color: var(--text-dim);
      line-height: 1.5;
    }

    .idea-category {
      font-size: 0.65rem;
      color: var(--text-muted);
      margin-top: 0.3rem;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Methodology */
    .methodology {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      margin-top: 2.5rem;
    }

    .methodology h2 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: var(--text);
    }

    .methodology p {
      font-size: 0.82rem;
      color: var(--text-dim);
      margin-bottom: 0.6rem;
      line-height: 1.6;
    }

    .methodology strong { color: var(--text); }

    /* Footer */
    footer {
      text-align: center;
      padding: 2rem 0 1rem;
      font-size: 0.78rem;
    }

    .footer-main {
      color: var(--text-dim);
      margin-bottom: 0.3rem;
    }

    .footer-main a { color: var(--accent); text-decoration: none; }
    .footer-main a:hover { text-decoration: underline; }

    .footer-sub {
      color: var(--text-muted);
      font-size: 0.7rem;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Animations */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .narrative-card {
      animation: fadeUp 0.4s ease both;
    }

    .narrative-card:nth-child(1) { animation-delay: 0.05s; }
    .narrative-card:nth-child(2) { animation-delay: 0.1s; }
    .narrative-card:nth-child(3) { animation-delay: 0.15s; }
    .narrative-card:nth-child(4) { animation-delay: 0.2s; }
    .narrative-card:nth-child(5) { animation-delay: 0.25s; }
    .narrative-card:nth-child(6) { animation-delay: 0.3s; }
    .narrative-card:nth-child(7) { animation-delay: 0.35s; }

    /* Responsive */
    @media (max-width: 640px) {
      .container { padding: 1.25rem 1rem; }
      .logo { font-size: 1.6rem; }
      .stats-bar { grid-template-columns: repeat(2, 1fr); }
      .overview { grid-template-columns: 1fr 1fr; }
      .detail-metrics { grid-template-columns: repeat(2, 1fr); }
      .header-meta { flex-direction: column; gap: 0.3rem; }
      .card-top { padding: 1rem; }
      .card-detail-inner { padding: 0 1rem 1rem; }
      .signal-item { flex-direction: column; gap: 0.3rem; }
      .signal-meta { flex-direction: row; align-items: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">Narrative<span>Scope</span></div>
      <p class="tagline">Emerging narratives in the Solana ecosystem, detected by cross-source signal analysis</p>
      <div class="header-meta">
        <span>${new Date(result.generatedAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
        <span>${result.period}</span>
      </div>
    </header>

    <div class="stats-bar">
      <div class="stat">
        <div class="stat-value">${result.narratives.length}</div>
        <div class="stat-label">Narratives</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalTweets}</div>
        <div class="stat-label">Tweets Analyzed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalRepos}</div>
        <div class="stat-label">New Repos</div>
      </div>
      <div class="stat">
        <div class="stat-value">${avgConfidence}%</div>
        <div class="stat-label">Avg Confidence</div>
      </div>
    </div>

    <div class="section-header">At a glance</div>
    <div class="overview">
      ${overviewItems}
    </div>

    <div class="section-header">Narrative details</div>
    ${narrativeCards}

    <div class="methodology">
      <h2>Methodology</h2>
      ${result.methodology
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</p>`)
        .join("\n")}
    </div>

    <footer>
      <div class="footer-main">Built by <a href="https://x.com/agenttessaa">@agenttessaa</a></div>
      <div class="footer-sub">SuperteamEarn Narrative Detection Bounty</div>
    </footer>
  </div>

  <script>
    // Expand/collapse cards
    document.querySelectorAll('.card-top').forEach(el => {
      el.addEventListener('click', () => {
        el.closest('.narrative-card').classList.toggle('expanded');
      });
    });

    // Overview items scroll to card
    document.querySelectorAll('.overview-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = el.dataset.idx;
        const card = document.querySelector('.narrative-card[data-idx="' + idx + '"]');
        if (card) {
          card.classList.add('expanded');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    // Animate score rings on load
    window.addEventListener('load', () => {
      document.querySelectorAll('.ring-fill').forEach(el => {
        const pct = parseFloat(el.dataset.pct);
        const circumference = 2 * Math.PI * 18;
        el.style.strokeDashoffset = circumference * (1 - pct / 100);
      });
    });

    // Auto-expand first card
    const firstCard = document.querySelector('.narrative-card');
    if (firstCard) firstCard.classList.add('expanded');
  </script>
</body>
</html>`;
}

function renderOverviewItem(n: DetectedNarrative, index: number): string {
  const stageClass = `stage-${n.stage}`;
  const scoreColor =
    n.signalScore >= 80 ? "var(--green)" :
    n.signalScore >= 50 ? "var(--accent2)" :
    n.signalScore >= 30 ? "var(--yellow)" :
    "var(--text-muted)";

  return `
    <div class="overview-item ${stageClass}" data-idx="${index}">
      <div class="ov-name">${escapeHtml(n.name)}</div>
      <div class="ov-score">
        <div class="ov-score-bar">
          <div class="ov-score-fill" style="width: ${n.signalScore}%; background: ${scoreColor};"></div>
        </div>
        <div class="ov-score-num">${n.signalScore}</div>
      </div>
      <div class="ov-stage">${n.stage.replace("-", " ")} · ${n.signals.social.tweetCount}tw · ${n.signals.developer.repoCount}gh</div>
    </div>`;
}

function renderNarrativeCard(n: DetectedNarrative, index: number): string {
  const stageClass = `stage-${n.stage}`;
  const confPercent = Math.round(n.confidence * 100);

  // SVG ring for signal score
  const circumference = 2 * Math.PI * 18;
  const scoreColor =
    n.signalScore >= 80 ? "var(--green)" :
    n.signalScore >= 50 ? "var(--accent2)" :
    n.signalScore >= 30 ? "var(--yellow)" :
    "var(--text-muted)";

  // Compact explanation (remove "Emerging — " prefix etc)
  const shortExplanation = n.explanation
    .replace(/^(Early stage|Emerging|Accelerating|Peaking)[^.]*\.\s*/, "");

  // Top tweets
  const tweetSignals = n.signals.social.topTweets
    .slice(0, 3)
    .map(
      (t) => `
      <div class="signal-item">
        <span class="signal-text">${escapeHtml(t.text)}</span>
        <span class="signal-meta">
          <span>${escapeHtml(t.author)} · ${t.likes} likes</span>
          <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">view &rarr;</a>
        </span>
      </div>`
    )
    .join("\n");

  // Top repos
  const repoSignals = n.signals.developer.topRepos
    .slice(0, 3)
    .map(
      (r) => `
      <div class="signal-item">
        <span class="signal-text"><strong>${escapeHtml(r.name)}</strong> &mdash; ${escapeHtml(r.description)}</span>
        <span class="signal-meta">
          <span>${r.stars} stars</span>
          <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener">repo &rarr;</a>
        </span>
      </div>`
    )
    .join("\n");

  // Key terms
  const allTerms = [...new Set([...n.signals.social.keyTerms, ...n.signals.developer.keyTerms])].slice(0, 8);
  const termTags = allTerms
    .map((t) => `<span class="term-tag">${escapeHtml(t)}</span>`)
    .join("");

  // Build ideas
  const ideaCards = n.buildIdeas
    .slice(0, 4)
    .map(
      (idea) => `
      <div class="idea">
        <div class="idea-header">
          <div class="idea-title">${escapeHtml(idea.title)}</div>
          <span class="idea-difficulty diff-${idea.difficulty}">${idea.difficulty}</span>
        </div>
        <div class="idea-desc">${escapeHtml(idea.description)}</div>
        <div class="idea-category">${escapeHtml(idea.category)}</div>
      </div>`
    )
    .join("\n");

  return `
    <div class="narrative-card" data-idx="${index}">
      <div class="card-top">
        <div class="card-top-left">
          <svg class="score-ring" viewBox="0 0 40 40">
            <circle class="ring-bg" cx="20" cy="20" r="18" />
            <circle class="ring-fill" cx="20" cy="20" r="18"
              stroke="${scoreColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
              data-pct="${n.signalScore}"
              transform="rotate(-90 20 20)" />
            <text x="20" y="20">${n.signalScore}</text>
          </svg>
          <div class="card-title-area">
            <div class="card-title">${escapeHtml(n.name)}</div>
            <div class="card-subtitle">${shortExplanation || escapeHtml(n.explanation)}</div>
          </div>
        </div>
        <div class="card-top-right">
          <span class="stage-badge ${stageClass}">${n.stage.replace("-", " ")}</span>
          <svg class="expand-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>

      <div class="card-detail">
        <div class="card-detail-inner">
          <div class="detail-metrics">
            <div class="d-metric">
              <div class="d-metric-value">${confPercent}%</div>
              <div class="d-metric-label">Confidence</div>
            </div>
            <div class="d-metric">
              <div class="d-metric-value">${n.signals.social.tweetCount}</div>
              <div class="d-metric-label">Tweets</div>
            </div>
            <div class="d-metric">
              <div class="d-metric-value">${n.signals.social.uniqueAuthors || 0}</div>
              <div class="d-metric-label">Sources</div>
            </div>
            <div class="d-metric">
              <div class="d-metric-value">${n.signals.developer.repoCount}</div>
              <div class="d-metric-label">Repos</div>
            </div>
            <div class="d-metric">
              <div class="d-metric-value">${Math.round(n.signals.social.avgEngagement)}</div>
              <div class="d-metric-label">Avg Engagement</div>
            </div>
            <div class="d-metric">
              <div class="d-metric-value">${n.signals.developer.totalStars}</div>
              <div class="d-metric-label">Total Stars</div>
            </div>
          </div>

          ${termTags ? `
          <div class="detail-label">Key terms</div>
          <div class="key-terms">${termTags}</div>` : ""}

          ${tweetSignals ? `
          <div class="detail-label">Top social signals</div>
          <div class="signal-list">${tweetSignals}</div>` : ""}

          ${repoSignals ? `
          <div class="detail-label">Top developer signals</div>
          <div class="signal-list">${repoSignals}</div>` : ""}

          ${ideaCards ? `
          <div class="detail-label">Build ideas</div>
          <div class="build-ideas">${ideaCards}</div>` : ""}
        </div>
      </div>
    </div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// CLI entry point — generate HTML from cached data
if (import.meta.main) {
  const { readFileSync, writeFileSync, mkdirSync } = await import("fs");

  let result: AggregatorResult;
  try {
    result = JSON.parse(readFileSync("narrative-scope/data/narratives.json", "utf-8"));
  } catch {
    console.error("No narratives.json found. Run aggregator.ts first.");
    process.exit(1);
  }

  const html = generateHTML(result);
  mkdirSync("narrative-scope/public", { recursive: true });
  writeFileSync("narrative-scope/public/index.html", html);
  console.log("Generated narrative-scope/public/index.html");
}
