import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { runAnalysis, validateAndSanitize } from "./lib/analyze-server";

type ServerEntry = { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response; };
interface CfEnv { ANTHROPIC_API_KEY?: string; }

const JSON_HEADERS = { "content-type": "application/json" } as const;
const SERVER_START = Date.now();
let requestCount = 0;
let errorCount = 0;
let totalLatencyMs = 0;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

function safeLog(label: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`[server] ${label}:`, err.message.replace(/sk-ant-[A-Za-z0-9\-_]+/g, "[REDACTED]"));
  } else {
    console.error(`[server] ${label}: unknown error`);
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;
async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return false; }
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return false;
  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) return false;
  return fields.unhandled === true && fields.message === "HTTPError" && (fields.status === undefined || fields.status === responseStatus);
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) return response;
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// ─── /api/health ─────────────────────────────────────────────────────────────
function handleHealthRequest(): Response {
  const avgLatency = requestCount > 0 ? Math.round(totalLatencyMs / requestCount) : 0;
  return jsonResponse({
    status: "ok",
    uptime: Math.round((Date.now() - SERVER_START) / 1000),
    requests: requestCount,
    errors: errorCount,
    errorRate: requestCount > 0 ? Math.round((errorCount / requestCount) * 100) : 0,
    avgLatencyMs: avgLatency,
    ts: new Date().toISOString(),
    version: "1.0.0",
  });
}

// ─── /api/analyze ─────────────────────────────────────────────────────────────
async function handleAnalyzeRequest(request: Request, env: CfEnv): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  
  requestCount++;
  const t0 = Date.now();
  const reqId = Math.random().toString(36).slice(2, 10);

  try {
    const apiKey = env.ANTHROPIC_API_KEY ?? process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      console.error("[server] ANTHROPIC_API_KEY not set");
      errorCount++;
      return jsonResponse({ error: "Server configuration error. Please contact support." }, 500);
    }

    let rawBody: unknown;
    try {
      const text = await request.text();
      if (!text.trim()) return jsonResponse({ error: "Request body is empty" }, 400);
      rawBody = JSON.parse(text);
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON" }, 400);
    }

    const { inputs, errors } = validateAndSanitize(rawBody);
    if (errors.some((e) => e.field === "revenue")) {
      return jsonResponse({ error: "Invalid inputs", details: errors.map((e) => `${e.field}: ${e.message}`) }, 422);
    }
    if (errors.length > 0) {
      console.warn(`[server:${reqId}] Input warnings:`, errors.map((e) => `${e.field}: ${e.message}`).join("; "));
    }

    const result = await runAnalysis(inputs, apiKey);
    const latency = Date.now() - t0;
    totalLatencyMs += latency;
    console.log(`[server:${reqId}] analyze OK ${latency}ms — ${inputs.company}`);
    return jsonResponse(result, 200);
  } catch (err) {
    errorCount++;
    const latency = Date.now() - t0;
    totalLatencyMs += latency;
    safeLog(`[server:${reqId}] /api/analyze unhandled`, err);
    return jsonResponse({ error: "Analysis failed. Please try again." }, 500);
  }
}

// ─── Main fetch handler ────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const cfEnv = (env ?? {}) as CfEnv;

    // Security headers
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (url.pathname === "/api/health") return handleHealthRequest();
    if (url.pathname === "/api/analyze") return handleAnalyzeRequest(request, cfEnv);

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      safeLog("SSR handler", error);
      return brandedErrorResponse();
    }
  },
};
