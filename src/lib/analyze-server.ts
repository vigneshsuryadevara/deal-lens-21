/**
 * analyze-server.ts — Server-only Anthropic integration.
 * Import ONLY from server.ts or other server-side modules.
 */

import { TRANSACTIONS } from "../data/transactions";
import { BUYERS } from "../data/buyers";
import type { AnalysisInputs, LiveAnalysisResult } from "../types/analysis";

// ─── Constants ───────────────────────────────────────────────────────────────

const API_TIMEOUT_MS = 45_000;
const MAX_STRING_LENGTH = 500;
const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-4-20250514";

// ─── Pre-built summaries (computed once at module load) ──────────────────────

const COMP_SUMMARY = TRANSACTIONS.map((t) => ({
  id: t.id,
  target: t.target,
  acquirer: t.acquirer,
  date: t.date,
  evRevenue: t.evRevenue,
  evEbitda: t.evEbitda > 0 ? t.evEbitda : null,
  growth: t.growth,
  ebitdaMargin: t.ebitdaMargin,
  type: t.type,
}));

const BUYER_SUMMARY = BUYERS.map((b) => ({
  id: b.id,
  name: b.name,
  type: b.type,
  sectorFit: b.sectorFit,
  appetite: b.appetite,
}));

// ─── Input validation & sanitization ─────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

function clampNumber(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function sanitizeString(v: unknown, maxLen = MAX_STRING_LENGTH): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

export function validateAndSanitize(raw: unknown): {
  inputs: AnalysisInputs;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      inputs: buildDefaultInputs(),
      errors: [{ field: "body", message: "Request body must be a JSON object" }],
    };
  }

  const r = raw as Record<string, unknown>;

  // Strings
  const company = sanitizeString(r.company) || "Unknown Company";
  const sector = sanitizeString(r.sector) || "General";
  const geography = sanitizeString(r.geography) || "North America";
  const dealType = sanitizeString(r.dealType) || "Strategic M&A";
  const context = sanitizeString(r.context, 1000);

  if (!sanitizeString(r.company)) {
    errors.push({ field: "company", message: "Company name is required" });
  }

  // Numerics — clamp to realistic financial ranges
  const revenue = clampNumber(r.revenue, 0.1, 1_000_000, 0);
  const ebitda = clampNumber(r.ebitda, -100_000, 1_000_000, 0);
  const growth = clampNumber(r.growth, -100, 10_000, 0);
  const netDebt = clampNumber(r.netDebt, -1_000_000, 1_000_000, 0);

  if (revenue <= 0) {
    errors.push({ field: "revenue", message: "Revenue must be greater than 0" });
  }

  // Derive ebitdaMargin defensively — avoid division by zero
  const rawMargin = clampNumber(r.ebitdaMargin, -100, 100, 0);
  const ebitdaMargin =
    revenue > 0
      ? Number.isFinite(rawMargin) && rawMargin !== 0
        ? rawMargin
        : (ebitda / revenue) * 100
      : 0;

  return {
    inputs: {
      company,
      sector,
      geography,
      revenue,
      ebitda,
      growth,
      ebitdaMargin: Math.round(ebitdaMargin * 10) / 10,
      netDebt,
      dealType,
      context,
    },
    errors,
  };
}

function buildDefaultInputs(): AnalysisInputs {
  return {
    company: "Unknown Company",
    sector: "General",
    geography: "North America",
    revenue: 100,
    ebitda: 20,
    growth: 10,
    ebitdaMargin: 20,
    netDebt: 0,
    dealType: "Strategic M&A",
    context: "",
  };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(inp: AnalysisInputs): string {
  const equityStr =
    inp.netDebt < 0
      ? `Net cash of $${Math.abs(inp.netDebt)}M`
      : `Net debt of $${inp.netDebt}M`;

  return `You are a senior M&A analyst at a bulge bracket investment bank preparing a live deal analysis.

TARGET COMPANY
Company:       ${inp.company}
Sector:        ${inp.sector}
Geography:     ${inp.geography}
LTM Revenue:   $${inp.revenue}M
LTM EBITDA:    $${inp.ebitda}M (${inp.ebitdaMargin.toFixed(1)}% margin)
YoY Growth:    ${inp.growth}%
${equityStr}
Deal Type:     ${inp.dealType}
${inp.context ? `Context:       ${inp.context}` : ""}

COMPARABLE TRANSACTIONS DATABASE (use these IDs exactly — do not invent new ones):
${JSON.stringify(COMP_SUMMARY, null, 2)}

BUYER UNIVERSE (use these IDs exactly):
${JSON.stringify(BUYER_SUMMARY, null, 2)}

INSTRUCTIONS:
1. Search the web for recent M&A activity and market conditions in the ${inp.sector} sector in ${inp.geography}.
2. From the database above, identify the 5-8 most comparable transactions by sector, size proximity, margin profile, and recency. Return their exact IDs.
3. Compute median EV/EBITDA and EV/Revenue from only those selected transactions. Round to one decimal.
4. Compute p25/p75 from the same selected set.
5. Build valuation methods using target financials × multiples — all dollar values as absolute USD integers (e.g. 3850000000 not 3850).
6. Write 3-4 sentences of sharp analyst commentary referencing the company by name.
7. Identify 3-5 buyer IDs most likely to pursue this target. Return exact IDs only.
8. Propose realistic EBITDA add-backs and bridge items for this company profile.

IMPORTANT: Return ONLY valid JSON. No markdown fences, no text outside the JSON object. All number fields must be finite numbers, never null or undefined.

{
  "company": "${inp.company}",
  "sector": "${inp.sector}",
  "geography": "${inp.geography}",
  "asOf": "${new Date().toISOString()}",
  "stats": {
    "medianEvEbitda": 0.0, "medianEvRevenue": 0.0,
    "p25EvEbitda": 0.0, "p75EvEbitda": 0.0,
    "p25EvRevenue": 0.0, "p75EvRevenue": 0.0
  },
  "valuationMethods": [
    { "label": "Precedent Transactions (EV/EBITDA)", "low": 0, "high": 0, "base": 0 },
    { "label": "Precedent Transactions (EV/Revenue)", "low": 0, "high": 0, "base": 0 },
    { "label": "Trading Comparables", "low": 0, "high": 0, "base": 0 },
    { "label": "Discounted Cash Flow", "low": 0, "high": 0, "base": 0 },
    { "label": "LBO (Sponsor — 20% IRR)", "low": 0, "high": 0, "base": 0 },
    { "label": "52-Week Trading Range", "low": 0, "high": 0, "base": 0 }
  ],
  "commentary": ["sentence 1", "sentence 2", "sentence 3"],
  "marketObservations": [{ "label": "label", "value": "value", "tone": "neutral" }],
  "relevantCompIds": ["t1"],
  "topBuyerIds": ["b1"],
  "assumptions": [
    { "id": "a1", "category": "Add-Backs", "label": "label", "value": 0.0, "unit": "$M", "note": "note" }
  ],
  "bridge": [
    { "label": "Enterprise Value (Base)", "value": 0 },
    { "label": "(+) Cash & equivalents", "value": 0 },
    { "label": "(−) Total debt", "value": 0 },
    { "label": "(−) Capitalized leases", "value": 0 },
    { "label": "(−) Minority interest", "value": 0 },
    { "label": "(−) Earnout liability", "value": 0 }
  ],
  "analystNote": "one-sentence deal framing",
  "dataNote": "source quality note"
}`;
}

// ─── Defensive JSON parser ────────────────────────────────────────────────────

function safeParseJson(raw: string): unknown {
  // Strategy 1: direct parse
  try {
    return JSON.parse(raw);
  } catch {
    // fall through
  }

  // Strategy 2: strip markdown fences and retry
  const stripped = raw.replace(/```(?:json)?|```/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // fall through
  }

  // Strategy 3: extract first {...} block
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  // Strategy 4: try to fix common model mistakes (trailing commas)
  try {
    const fixed = stripped
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, " "); // strip control chars
    return JSON.parse(fixed);
  } catch {
    // all strategies exhausted
  }

  throw new Error("Unable to parse model response as JSON after all strategies");
}

// ─── Validate shape of parsed result ─────────────────────────────────────────

function isValidResult(obj: unknown): obj is LiveAnalysisResult {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.company === "string" &&
    typeof r.sector === "string" &&
    r.stats !== null &&
    typeof r.stats === "object" &&
    Array.isArray(r.valuationMethods) &&
    Array.isArray(r.commentary)
  );
}

function coerceNumbers(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(coerceNumbers);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "number" && !Number.isFinite(v) ? 0 : coerceNumbers(v),
      ]),
    );
  }
  return obj;
}

// ─── Fallback analysis from static data ──────────────────────────────────────

function buildFallbackAnalysis(inp: AnalysisInputs): LiveAnalysisResult {
  const sorted = [...TRANSACTIONS]
    .filter((t) => t.evEbitda > 0)
    .sort((a, b) => b.ebitdaMargin - a.ebitdaMargin);

  const evEbArr = sorted.map((t) => t.evEbitda).sort((a, b) => a - b);
  const evRevArr = TRANSACTIONS.map((t) => t.evRevenue).sort((a, b) => a - b);

  const p = (arr: number[], q: number) =>
    arr[Math.max(0, Math.floor((arr.length - 1) * q))] ?? 0;

  const medEE = p(evEbArr, 0.5);
  const medER = p(evRevArr, 0.5);
  const revM = inp.revenue * 1e6;
  const ebM = inp.ebitda * 1e6;

  const topIds = sorted.slice(0, 6).map((t) => t.id);
  const topBuyerIds = BUYERS.slice(0, 3).map((b) => b.id);

  return {
    company: inp.company,
    sector: inp.sector,
    geography: inp.geography,
    asOf: new Date().toISOString(),
    stats: {
      medianEvEbitda: medEE,
      medianEvRevenue: medER,
      p25EvEbitda: p(evEbArr, 0.25),
      p75EvEbitda: p(evEbArr, 0.75),
      p25EvRevenue: p(evRevArr, 0.25),
      p75EvRevenue: p(evRevArr, 0.75),
    },
    valuationMethods: [
      {
        label: "Precedent Transactions (EV/EBITDA)",
        low: p(evEbArr, 0.25) * ebM,
        high: p(evEbArr, 0.75) * ebM,
        base: medEE * ebM,
      },
      {
        label: "Precedent Transactions (EV/Revenue)",
        low: p(evRevArr, 0.25) * revM,
        high: p(evRevArr, 0.75) * revM,
        base: medER * revM,
      },
      {
        label: "Trading Comparables",
        low: medEE * 0.8 * ebM,
        high: medEE * 1.2 * ebM,
        base: medEE * ebM,
      },
      {
        label: "Discounted Cash Flow",
        low: medEE * 0.85 * ebM,
        high: medEE * 1.3 * ebM,
        base: medEE * 1.05 * ebM,
      },
      {
        label: "LBO (Sponsor — 20% IRR)",
        low: medEE * 0.7 * ebM,
        high: medEE * ebM,
        base: medEE * 0.85 * ebM,
      },
      {
        label: "52-Week Trading Range",
        low: medEE * 0.75 * ebM,
        high: medEE * 1.15 * ebM,
        base: medEE * 0.95 * ebM,
      },
    ],
    commentary: [
      `${inp.company} is a ${inp.sector} business generating $${inp.revenue}M in revenue at a ${inp.ebitdaMargin.toFixed(1)}% EBITDA margin.`,
      `At ${inp.growth}% year-over-year growth, the company compares favourably to the precedent transaction dataset median of ${medEE.toFixed(1)}x EV/EBITDA.`,
      `Valuation is derived from ${evEbArr.length} comparable transactions; live market commentary unavailable — re-run analysis to refresh.`,
    ],
    marketObservations: [
      { label: "Dataset Transactions", value: `${TRANSACTIONS.length}`, tone: "neutral" },
      { label: "Median EV/EBITDA", value: `${medEE.toFixed(1)}x`, tone: "neutral" },
      { label: "Median EV/Revenue", value: `${medER.toFixed(1)}x`, tone: "neutral" },
      { label: "Data Source", value: "Static dataset", tone: "neutral" },
    ],
    relevantCompIds: topIds,
    topBuyerIds,
    assumptions: [
      { id: "f-a1", category: "Add-Backs", label: "Normalisation adjustment", value: inp.ebitda * 0.05, unit: "$M", note: "Estimated one-time items" },
      { id: "f-a2", category: "Add-Backs", label: "Stock-based compensation", value: inp.ebitda * 0.03, unit: "$M", note: "Non-cash charge add-back" },
    ],
    bridge: [
      { label: "Enterprise Value (Base)", value: Math.round(medEE * inp.ebitda) },
      { label: "(+) Cash & equivalents", value: inp.netDebt < 0 ? Math.round(Math.abs(inp.netDebt)) : 0 },
      { label: "(−) Total debt", value: inp.netDebt > 0 ? Math.round(inp.netDebt) : 0 },
      { label: "(−) Capitalized leases", value: Math.round(inp.ebitda * 0.08) },
      { label: "(−) Minority interest", value: 0 },
      { label: "(−) Earnout liability", value: 0 },
    ],
    analystNote: `Fallback analysis — live web search unavailable. Figures derived from ${TRANSACTIONS.length}-transaction precedent dataset.`,
    dataNote: "Static dataset only. Re-run analysis for live market commentary and web-sourced comps.",
  };
}

// ─── Safe error logger (no secrets, no PII) ───────────────────────────────────

function safeLog(label: string, err: unknown): void {
  if (err instanceof Error) {
    // Redact anything that looks like an API key
    const msg = err.message.replace(/sk-ant-[A-Za-z0-9\-_]+/g, "[REDACTED]");
    console.error(`[analyze-server] ${label}:`, msg);
  } else {
    console.error(`[analyze-server] ${label}: non-Error thrown`);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runAnalysis(
  inputs: AnalysisInputs,
  apiKey: string,
): Promise<LiveAnalysisResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let anthropicResp: Response;
  try {
    anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: buildPrompt(inputs) }],
      }),
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));
    if (isTimeout) {
      safeLog("API timeout", err);
      return buildFallbackAnalysis(inputs);
    }
    safeLog("Network error", err);
    return buildFallbackAnalysis(inputs);
  } finally {
    clearTimeout(timer);
  }

  if (!anthropicResp.ok) {
    // 429 rate limit and 5xx server errors both get fallback
    const status = anthropicResp.status;
    const body = await anthropicResp.text().catch(() => "");
    safeLog(`Upstream HTTP ${status}`, new Error(body.slice(0, 120)));
    if (status === 429 || status >= 500) {
      return buildFallbackAnalysis(inputs);
    }
    // 4xx (except 429) — bad request, surface the error
    throw new Error(`API request error (${status})`);
  }

  let data: { content?: { type: string; text?: string }[] };
  try {
    data = (await anthropicResp.json()) as typeof data;
  } catch (err) {
    safeLog("Failed to parse API JSON envelope", err);
    return buildFallbackAnalysis(inputs);
  }

  const textBlocks = (data.content ?? []).filter(
    (b) => b.type === "text" && b.text,
  );
  if (!textBlocks.length) {
    safeLog("No text block in response", new Error("empty content array"));
    return buildFallbackAnalysis(inputs);
  }

  const raw = textBlocks[textBlocks.length - 1].text!;

  let parsed: unknown;
  try {
    parsed = safeParseJson(raw);
  } catch (err) {
    safeLog("JSON parse failure", err);
    return buildFallbackAnalysis(inputs);
  }

  // Coerce any NaN/Infinity to 0 so the frontend never receives bad numbers
  parsed = coerceNumbers(parsed);

  if (!isValidResult(parsed)) {
    safeLog(
      "Invalid result shape",
      new Error(`keys: ${Object.keys(parsed as object).join(", ")}`),
    );
    return buildFallbackAnalysis(inputs);
  }

  return parsed;
}
