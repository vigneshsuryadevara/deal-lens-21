/**
 * api/ssr.ts — Vercel Serverless Function
 * 
 * Fast path for /api/analyze — handles it directly with static imports.
 * No heavy SSR bundle for API calls.
 */

import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";
import { runAnalysis, validateAndSanitize } from "../src/lib/analyze-server";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

function sendJson(res: ServerResponse, body: unknown, status = 200) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function handleAnalyze(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") { sendJson(res, { error: "Method not allowed" }, 405); return; }

  const t0 = Date.now();
  const rid = Math.random().toString(36).slice(2, 7);
  const apiKey = process.env["ANTHROPIC_API_KEY"] ?? "";
  console.log(`[${rid}] key=${apiKey ? "SET len=" + apiKey.length : "MISSING"}`);

  try {
    const rawText = await readBody(req);
    if (!rawText.trim()) { sendJson(res, { error: "Empty body" }, 400); return; }

    let rawBody: unknown;
    try { rawBody = JSON.parse(rawText); }
    catch { sendJson(res, { error: "Invalid JSON" }, 400); return; }

    const { inputs, errors } = validateAndSanitize(rawBody);
    if (errors.some(e => e.field === "revenue")) {
      sendJson(res, { error: "Invalid inputs" }, 422);
      return;
    }

    const result = await runAnalysis(inputs, apiKey);
    console.log(`[${rid}] done ${Date.now() - t0}ms`);
    sendJson(res, result, 200);

  } catch (err) {
    console.error(`[${rid}] error:`, err instanceof Error ? err.message : err);
    sendJson(res, { error: "Analysis failed. Please try again." }, 500);
  }
}

function handleHealth(res: ServerResponse) {
  sendJson(res, {
    status: "ok",
    apiKeySet: !!process.env["ANTHROPIC_API_KEY"],
    ts: new Date().toISOString(),
  });
}

// Lazy-load the heavy SSR bundle only for page requests
let _ssrHandler: { fetch: (req: Request, env: unknown, ctx: unknown) => Promise<Response> } | null = null;
async function getSsr() {
  if (!_ssrHandler) {
    // @ts-ignore
    const m = await import("../dist/server/server.js");
    _ssrHandler = m.default ?? m;
  }
  return _ssrHandler!;
}

function nodeToWeb(req: IncomingMessage): Request {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach(x => headers.append(k, x));
    else headers.set(k, v);
  }
  const method = (req.method ?? "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  return new Request(url.toString(), {
    method, headers,
    body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream) : undefined,
    // @ts-ignore
    duplex: "half",
  });
}

async function webToNode(webRes: Response, res: ServerResponse) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((v, k) => res.setHeader(k, v));
  if (webRes.body) {
    const r = Readable.fromWeb(webRes.body as unknown as import("stream/web").ReadableStream<Uint8Array>);
    await new Promise<void>((ok, fail) => { r.pipe(res); r.on("end", ok); r.on("error", fail); });
  } else {
    res.end();
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? "/";

  if (url.startsWith("/api/analyze")) { await handleAnalyze(req, res); return; }
  if (url.startsWith("/api/health"))  { handleHealth(res); return; }

  try {
    const ssr = await getSsr();
    const response = await ssr.fetch(nodeToWeb(req), process.env, {});
    await webToNode(response, res);
  } catch (err) {
    console.error("[ssr]", err instanceof Error ? err.message : err);
    if (!res.headersSent) { res.statusCode = 500; res.end("Error"); }
  }
}
