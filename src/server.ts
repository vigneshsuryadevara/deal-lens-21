import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { runAnalysis } from "./lib/analyze-server";
import type { AnalysisInputs } from "./types/analysis";

type ServerEntry = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response> | Response;
};

// Cloudflare Workers env shape — secrets set via `wrangler secret put`
interface CfEnv {
  ANTHROPIC_API_KEY?: string;
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) =>
        ((m as { default?: ServerEntry }).default ??
          (m as unknown as ServerEntry)),
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

function isCatastrophicSsrErrorBody(
  body: string,
  responseStatus: number,
): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }
  if (!payload || Array.isArray(payload) || typeof payload !== "object")
    return false;
  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) return false;
  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

async function normalizeCatastrophicSsrResponse(
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) return response;
  console.error(
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  );
  return brandedErrorResponse();
}

// ─── /api/analyze handler ─────────────────────────────────────────────────────
async function handleAnalyzeRequest(
  request: Request,
  env: CfEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  // API key: prefer CF Workers binding, fall back to process.env for local dev
  const apiKey =
    env.ANTHROPIC_API_KEY ?? process.env["ANTHROPIC_API_KEY"];

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "Server not configured — ANTHROPIC_API_KEY is missing.",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let inputs: AnalysisInputs;
  try {
    inputs = (await request.json()) as AnalysisInputs;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!inputs.company || !inputs.sector || !(inputs.revenue > 0)) {
    return new Response(
      JSON.stringify({
        error: "Required fields: company, sector, revenue (> 0).",
      }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  }

  try {
    const result = await runAnalysis(inputs, apiKey);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/analyze]", msg);
    return new Response(
      JSON.stringify({ error: `Analysis failed: ${msg}` }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}

// ─── Main Cloudflare Workers fetch handler ────────────────────────────────────
export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const cfEnv = (env ?? {}) as CfEnv;

    // Intercept API routes before delegating to TanStack Start SSR
    if (url.pathname === "/api/analyze") {
      return handleAnalyzeRequest(request, cfEnv);
    }

    // All other requests → TanStack Start
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
