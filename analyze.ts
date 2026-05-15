/**
 * api/analyze.ts — Dedicated Vercel serverless function for analysis.
 *
 * WHY THIS EXISTS:
 * Before, /api/analyze was handled inside api/ssr.ts (the SSR function).
 * That function also renders every page, so it's heavy and slow to cold-start.
 * This dedicated function is lightweight — it ONLY handles analysis requests,
 * cold-starts in ~200ms instead of ~2s, and has its own maxDuration.
 */

import type { IncomingMessage, ServerResponse } from "http";
import { runAnalysis, validateAndSanitize } from "../src/lib/analyze-server";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

let requestCount = 0;
let errorCount = 0;

function json(res: ServerResponse, body: unknown, status = 200) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(payload);
}

export default async function analyzeHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, { error: "Method not allowed" }, 405);
    return;
  }

  requestCount++;
  const t0 = Date.now();
  const reqId = Math.random().toString(36).slice(2, 8);

  try {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      console.error("[analyze] ANTHROPIC_API_KEY not set");
      json(res, { error: "Server configuration error" }, 500);
      return;
    }

    // Read body
    const body = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    if (!body.trim()) {
      json(res, { error: "Request body is empty" }, 400);
      return;
    }

    let rawBody: unknown;
    try { rawBody = JSON.parse(body); }
    catch { json(res, { error: "Request body must be valid JSON" }, 400); return; }

    const { inputs, errors } = validateAndSanitize(rawBody);
    if (errors.some(e => e.field === "revenue")) {
      json(res, { error: "Invalid inputs", details: errors.map(e => `${e.field}: ${e.message}`) }, 422);
      return;
    }

    const result = await runAnalysis(inputs, apiKey);
    const latency = Date.now() - t0;
    console.log(`[analyze:${reqId}] OK ${latency}ms — ${inputs.company}`);
    json(res, result, 200);

  } catch (err) {
    errorCount++;
    const msg = err instanceof Error ? err.message.replace(/sk-ant-[A-Za-z0-9\-_]+/g, "[KEY]") : "unknown";
    console.error(`[analyze:${reqId}] error: ${msg}`);
    json(res, { error: "Analysis failed. Please try again." }, 500);
  }
}
