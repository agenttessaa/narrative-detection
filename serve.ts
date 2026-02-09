#!/usr/bin/env bun
/**
 * NarrativeScope — Static file server
 * Serves the pre-generated HTML dashboard and JSON API
 */

import { readFileSync } from "fs";

const port = 3456;

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
        return new Response("Not generated yet. Run `bun src/run.ts` first.", { status: 404 });
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

console.log(`NarrativeScope server running at http://localhost:${port}`);
console.log(`  HTML: http://localhost:${port}/`);
console.log(`  API:  http://localhost:${port}/api.json`);
