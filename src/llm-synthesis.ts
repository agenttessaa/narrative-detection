/**
 * LLM Synthesis for NarrativeScope
 * Takes raw signal data from the aggregator and uses Claude to generate
 * narrative explanations and build ideas.
 */

import { readFileSync } from "fs";
import type { DetectedNarrative, BuildIdea } from "./aggregator";

const API_KEY = readFileSync("agent/vault/anthropic/api-key.txt", "utf-8").trim();

interface SynthesisResult {
  name: string;
  explanation: string;
  buildIdeas: BuildIdea[];
}

export async function synthesizeNarrative(
  narrative: DetectedNarrative
): Promise<SynthesisResult> {
  const prompt = buildPrompt(narrative);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as any;
  const text = data.content[0].text;

  return parseResponse(narrative.name, text);
}

export async function synthesizeAll(
  narratives: DetectedNarrative[]
): Promise<Map<string, SynthesisResult>> {
  const results = new Map<string, SynthesisResult>();

  // Process sequentially to stay within rate limits
  for (const n of narratives) {
    try {
      console.log(`  Synthesizing: ${n.name}...`);
      const result = await synthesizeNarrative(n);
      results.set(n.name, result);
    } catch (e) {
      console.error(`  Failed to synthesize ${n.name}:`, e);
      // Fall back to existing data
      results.set(n.name, {
        name: n.name,
        explanation: n.explanation,
        buildIdeas: n.buildIdeas,
      });
    }
  }

  return results;
}

function buildPrompt(narrative: DetectedNarrative): string {
  const topTweets = narrative.signals.social.topTweets
    .map((t) => `- @${t.author} (${t.likes} likes): "${t.text}"`)
    .join("\n");

  const topRepos = narrative.signals.developer.topRepos
    .map((r) => `- ${r.name} (${r.stars} stars): ${r.description}`)
    .join("\n");

  return `You are analyzing emerging narratives in the Solana blockchain ecosystem. Given the raw signal data below, write a concise narrative explanation and generate practical build ideas.

NARRATIVE: ${narrative.name}
STAGE: ${narrative.stage}
SIGNAL SCORE: ${narrative.signalScore}/100
CONFIDENCE: ${Math.round(narrative.confidence * 100)}%

SOCIAL SIGNALS (X/Twitter, last 7 days):
- ${narrative.signals.social.tweetCount} tweets, ${narrative.signals.social.avgEngagement} avg engagement
- ${narrative.signals.social.uniqueAuthors} unique authors
- Key terms: ${narrative.signals.social.keyTerms.join(", ")}
Top tweets:
${topTweets || "(none)"}

DEVELOPER SIGNALS (GitHub, last 30 days):
- ${narrative.signals.developer.repoCount} new repos, ${narrative.signals.developer.totalStars} total stars
- Key terms: ${narrative.signals.developer.keyTerms.join(", ")}
Top repos:
${topRepos || "(none)"}

Respond in this exact JSON format (no markdown, no backticks, just raw JSON):
{
  "explanation": "2-3 sentence explanation of what this narrative IS and WHY it matters for Solana builders right now. Be specific — reference actual projects, numbers, or events from the signal data. Don't be generic.",
  "build_ideas": [
    {
      "title": "Short product name",
      "description": "1-2 sentence description of what to build and why it would work. Reference the specific opportunity the signals reveal.",
      "difficulty": "easy|medium|hard",
      "category": "DeFi|Infrastructure|Analytics|Commerce|Security|Developer Experience|Governance|Data|Marketplace|Payments"
    }
  ]
}

Generate 3-5 build ideas. Make them concrete and specific to Solana — not generic crypto ideas. Each idea should be something a solo developer or small team could realistically build. Prioritize ideas that address gaps visible in the signal data.`;
}

function parseResponse(name: string, text: string): SynthesisResult {
  // Try to parse as JSON directly
  let parsed: any;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("Could not parse LLM response as JSON");
    }
  }

  const buildIdeas: BuildIdea[] = (parsed.build_ideas || []).map((idea: any) => ({
    title: idea.title,
    description: idea.description,
    difficulty: idea.difficulty || "medium",
    category: idea.category || "Infrastructure",
  }));

  return {
    name,
    explanation: parsed.explanation || "",
    buildIdeas,
  };
}
