/**
 * analyze-server.ts — Production-grade server-side analysis engine.
 * Import ONLY from server.ts or other server-side modules.
 */

import { TRANSACTIONS } from "../data/transactions";
import { BUYERS } from "../data/buyers";
import type { AnalysisInputs, LiveAnalysisResult } from "../types/analysis";
import { scoreTransactions, computeValuationStats } from "../services/comps/index";
import { runDcf, runLbo, buildFootballField } from "../services/financials/index";

const API_TIMEOUT_MS = 50_000;
const MAX_STRING_LENGTH = 500;
const MODEL = process.env["AI_MODEL"] ?? "claude-sonnet-4-20250514";

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private readonly failureThreshold = 3;
  private readonly resetTimeoutMs = 60_000;
  private readonly halfOpenSuccessThreshold = 2;

  isOpen(): boolean {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = "CLOSED";
        this.failures = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) this.state = "OPEN";
  }
}
const circuitBreaker = new CircuitBreaker();

// ─── Pre-built summaries ──────────────────────────────────────────────────────
const COMP_SUMMARY = TRANSACTIONS.map((t) => ({
  id: t.id, target: t.target, acquirer: t.acquirer, date: t.date,
  evRevenue: t.evRevenue, evEbitda: t.evEbitda > 0 ? t.evEbitda : null,
  growth: t.growth, ebitdaMargin: t.ebitdaMargin, type: t.type,
}));

const BUYER_SUMMARY = BUYERS.map((b) => ({
  id: b.id, name: b.name, type: b.type, sectorFit: b.sectorFit, appetite: b.appetite,
}));

// ─── Input validation ─────────────────────────────────────────────────────────
export interface ValidationError { field: string; message: string; }

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function sanitizeString(v: unknown, maxLen = MAX_STRING_LENGTH): string {
  if (typeof v !== "string") return "";
  return v.trim().replace(/[\x00-\x1F\x7F]/g, " ").slice(0, maxLen);
}

export function validateAndSanitize(raw: unknown): { inputs: AnalysisInputs; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { inputs: buildDefaultInputs(), errors: [{ field: "body", message: "Request body must be a JSON object" }] };
  }
  const r = raw as Record<string, unknown>;
  const company = sanitizeString(r.company) || "Unknown Company";
  const sector = sanitizeString(r.sector) || "General";
  const geography = sanitizeString(r.geography) || "North America";
  const dealType = sanitizeString(r.dealType) || "Strategic M&A";
  const context = sanitizeString(r.context, 1000);
  if (!sanitizeString(r.company)) errors.push({ field: "company", message: "Company name is required" });
  const revenue = clampNumber(r.revenue, 0.1, 1_000_000, 0);
  const ebitda = clampNumber(r.ebitda, -100_000, 1_000_000, 0);
  const growth = clampNumber(r.growth, -100, 10_000, 0);
  const netDebt = clampNumber(r.netDebt, -1_000_000, 1_000_000, 0);
  if (revenue <= 0) errors.push({ field: "revenue", message: "Revenue must be greater than 0" });
  const rawMargin = clampNumber(r.ebitdaMargin, -100, 100, 0);
  const ebitdaMargin = revenue > 0
    ? (Number.isFinite(rawMargin) && rawMargin !== 0 ? rawMargin : (ebitda / revenue) * 100)
    : 0;
  return { inputs: { company, sector, geography, revenue, ebitda, growth, ebitdaMargin: Math.round(ebitdaMargin * 10) / 10, netDebt, dealType, context }, errors };
}

function buildDefaultInputs(): AnalysisInputs {
  return { company: "Unknown Company", sector: "General", geography: "North America", revenue: 100, ebitda: 20, growth: 10, ebitdaMargin: 20, netDebt: 0, dealType: "Strategic M&A", context: "" };
}

// ─── Fallback engine ──────────────────────────────────────────────────────────
function buildFallbackAnalysis(inp: AnalysisInputs): LiveAnalysisResult {
  const scored = scoreTransactions(TRANSACTIONS, { sector: inp.sector, revenue: inp.revenue, ebitdaMargin: inp.ebitdaMargin, growth: inp.growth });
  const topComps = scored.slice(0, 8);
  const stats = computeValuationStats(topComps);
  const dcf = runDcf({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const lbo = runLbo({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const valuationMethods = buildFootballField(inp.revenue, inp.ebitda, inp.netDebt, stats, dcf, lbo);
  const topIds = topComps.map((t) => t.id);
  const topBuyerIds = BUYERS.slice(0, 5).map((b) => b.id);
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
  const equityStr = inp.netDebt < 0 ? `net cash of $${Math.abs(inp.netDebt)}M` : `net debt of $${inp.netDebt}M`;
  const p25Ev = stats.p25EvEbitda * inp.ebitda * 1e6;
  const p75Ev = stats.p75EvEbitda * inp.ebitda * 1e6;
  const baseEv = stats.medianEvEbitda * inp.ebitda * 1e6;

  return {
    company: inp.company, sector: inp.sector, geography: inp.geography,
    asOf: new Date().toISOString(),
    stats: { medianEvEbitda: stats.medianEvEbitda, medianEvRevenue: stats.medianEvRevenue, p25EvEbitda: stats.p25EvEbitda, p75EvEbitda: stats.p75EvEbitda, p25EvRevenue: stats.p25EvRevenue, p75EvRevenue: stats.p75EvRevenue },
    valuationMethods,
    commentary: [
      `${inp.company} is a ${inp.sector} business generating $${inp.revenue}M in LTM revenue at a ${inp.ebitdaMargin.toFixed(1)}% EBITDA margin with ${inp.growth}% year-over-year growth.`,
      `Against ${topComps.length} scored comparable transactions, the dataset implies a median EV/EBITDA of ${stats.medianEvEbitda.toFixed(1)}x and EV/Revenue of ${stats.medianEvRevenue.toFixed(1)}x, supporting an indicative enterprise value range of ${fmt(p25Ev)}–${fmt(p75Ev)}.`,
      `DCF analysis (10% WACC, 2.5% terminal growth) implies ${fmt(dcf.enterpriseValue)} enterprise value; a financial sponsor at 20% IRR threshold could support entry of ${fmt(lbo.entryEv)}, implying a ${lbo.assumptions.entryMultiple.toFixed(1)}x EV/EBITDA entry multiple.`,
      `The company carries ${equityStr}; re-run analysis for live web-sourced sector commentary and current market observations.`,
    ],
    marketObservations: [
      { label: "Precedent Transactions", value: `${topComps.length} scored`, tone: "neutral" },
      { label: "Median EV/EBITDA", value: `${stats.medianEvEbitda.toFixed(1)}x`, tone: "neutral" },
      { label: "DCF Implied EV", value: fmt(dcf.enterpriseValue), tone: "neutral" },
      { label: "LBO Entry (20% IRR)", value: fmt(lbo.entryEv), tone: "neutral" },
      { label: "Data Source", value: "Transaction dataset (fallback)", tone: "neutral" },
    ],
    relevantCompIds: topIds,
    topBuyerIds,
    assumptions: [
      { id: "f-a1", category: "Add-Backs", label: "Non-recurring & one-time items", value: Math.round(inp.ebitda * 0.05 * 10) / 10, unit: "$M", note: "Estimated based on industry norms" },
      { id: "f-a2", category: "Add-Backs", label: "Stock-based compensation", value: Math.round(inp.revenue * 0.04 * 10) / 10, unit: "$M", note: "Non-cash charge; added back per sponsor convention" },
      { id: "f-a3", category: "Add-Backs", label: "Management consulting & advisory", value: Math.round(inp.ebitda * 0.02 * 10) / 10, unit: "$M", note: "Normalised management fees and deal costs" },
      { id: "f-a4", category: "Run-Rate", label: "Annualised contracted revenue", value: Math.round(inp.revenue * 0.03 * 10) / 10, unit: "$M", note: "Partial-year contracts with full-year ARR impact" },
    ],
    bridge: [
      { label: "Enterprise Value (Base)", value: Math.round(baseEv) },
      { label: "(+) Cash & equivalents", value: inp.netDebt < 0 ? Math.round(Math.abs(inp.netDebt) * 1e6) : 0 },
      { label: "(−) Total debt", value: inp.netDebt > 0 ? Math.round(inp.netDebt * 1e6) : 0 },
      { label: "(−) Capitalized leases", value: Math.round(inp.ebitda * 0.08 * 1e6) },
      { label: "(−) Minority interest", value: 0 },
      { label: "(−) Earnout / contingent consideration", value: 0 },
    ],
    analystNote: `Dataset analysis for ${inp.company} — ${topComps.length} comps scored algorithmically with integrated DCF and LBO models.`,
    dataNote: `Fallback analysis — live AI unavailable. Figures from precedent transaction dataset.`,
  };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(inp: AnalysisInputs): string {
  const equityStr = inp.netDebt < 0 ? `Net cash of $${Math.abs(inp.netDebt)}M` : `Net debt of $${inp.netDebt}M`;
  const preScored = scoreTransactions(TRANSACTIONS, { sector: inp.sector, revenue: inp.revenue, ebitdaMargin: inp.ebitdaMargin, growth: inp.growth }).slice(0, 12);
  const preStats = computeValuationStats(preScored);
  const dcf = runDcf({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const lbo = runLbo({ revenue: inp.revenue, ebitda: inp.ebitda, growth: inp.growth, ebitdaMargin: inp.ebitdaMargin, netDebt: inp.netDebt });
  const ff = buildFootballField(inp.revenue, inp.ebitda, inp.netDebt, preStats, dcf, lbo);

  return `You are a senior M&A analyst at Goldman Sachs / Evercore / PJT Partners preparing a live deal analysis.

TARGET COMPANY
Company: ${inp.company} | Sector: ${inp.sector} | Geography: ${inp.geography}
LTM Revenue: $${inp.revenue}M | LTM EBITDA: $${inp.ebitda}M (${inp.ebitdaMargin.toFixed(1)}% margin)
YoY Growth: ${inp.growth}% | ${equityStr} | Deal Type: ${inp.dealType}
${inp.context ? `Context: ${inp.context}` : ""}

PRE-COMPUTED MODELS (use these values in valuationMethods):
DCF EV: $${(dcf.enterpriseValue / 1e9).toFixed(2)}B | LBO Entry EV (20% IRR): $${(lbo.entryEv / 1e9).toFixed(2)}B
Algo Comps Median EV/EBITDA: ${preStats.medianEvEbitda.toFixed(1)}x | EV/Revenue: ${preStats.medianEvRevenue.toFixed(1)}x

TRANSACTION DATABASE (exact IDs only):
${JSON.stringify(COMP_SUMMARY, null, 2)}

BUYER UNIVERSE (exact IDs only):
${JSON.stringify(BUYER_SUMMARY, null, 2)}

SUGGESTED COMPS: ${preScored.slice(0, 8).map((t) => `${t.id}(${t.similarity}%)`).join(", ")}

INSTRUCTIONS:
1. Web-search for recent ${inp.sector} M&A activity and market conditions in ${inp.geography}
2. Select 5-8 most relevant transaction IDs from database
3. Compute stats from selected set only
4. Use pre-computed DCF/LBO values in valuationMethods (adjust range ±10-15%)
5. Write 4 sharp analyst sentences referencing specific market conditions found in search
6. Select 3-5 buyer IDs from buyer universe
7. Propose realistic add-backs for this company profile

Return ONLY valid JSON, no markdown:
{
  "company": "${inp.company}",
  "sector": "${inp.sector}",
  "geography": "${inp.geography}",
  "asOf": "${new Date().toISOString()}",
  "stats": { "medianEvEbitda": 0.0, "medianEvRevenue": 0.0, "p25EvEbitda": 0.0, "p75EvEbitda": 0.0, "p25EvRevenue": 0.0, "p75EvRevenue": 0.0 },
  "valuationMethods": [
    { "label": "Precedent Transactions (EV/EBITDA)", "low": ${ff[0]?.low ?? 0}, "high": ${ff[0]?.high ?? 0}, "base": ${ff[0]?.base ?? 0} },
    { "label": "Precedent Transactions (EV/Revenue)", "low": ${ff[1]?.low ?? 0}, "high": ${ff[1]?.high ?? 0}, "base": ${ff[1]?.base ?? 0} },
    { "label": "Trading Comparables", "low": ${ff[2]?.low ?? 0}, "high": ${ff[2]?.high ?? 0}, "base": ${ff[2]?.base ?? 0} },
    { "label": "Discounted Cash Flow", "low": ${Math.round(dcf.enterpriseValue * 0.85)}, "high": ${Math.round(dcf.enterpriseValue * 1.15)}, "base": ${dcf.enterpriseValue} },
    { "label": "LBO (Sponsor — 20% IRR)", "low": ${Math.round(lbo.entryEv * 0.92)}, "high": ${Math.round(lbo.entryEv * 1.06)}, "base": ${lbo.entryEv} },
    { "label": "52-Week Trading Range", "low": ${ff[5]?.low ?? 0}, "high": ${ff[5]?.high ?? 0}, "base": ${ff[5]?.base ?? 0} }
  ],
  "commentary": ["sentence1", "sentence2", "sentence3", "sentence4"],
  "marketObservations": [
    { "label": "Sector M&A Activity", "value": "web-search observation", "tone": "positive" },
    { "label": "Financing Environment", "value": "observation", "tone": "neutral" },
    { "label": "Sponsor Appetite", "value": "observation", "tone": "neutral" },
    { "label": "Strategic Premium Trend", "value": "observation", "tone": "neutral" }
  ],
  "relevantCompIds": ["t1"],
  "topBuyerIds": ["b1"],
  "assumptions": [{ "id": "a1", "category": "Add-Backs", "label": "label", "value": 0.0, "unit": "$M", "note": "note" }],
  "bridge": [
    { "label": "Enterprise Value (Base)", "value": ${Math.round(preStats.medianEvEbitda * inp.ebitda * 1e6)} },
    { "label": "(+) Cash & equivalents", "value": ${inp.netDebt < 0 ? Math.round(Math.abs(inp.netDebt) * 1e6) : 0} },
    { "label": "(−) Total debt", "value": ${inp.netDebt > 0 ? Math.round(inp.netDebt * 1e6) : 0} },
    { "label": "(−) Capitalized leases", "value": ${Math.round(inp.ebitda * 0.08 * 1e6)} },
    { "label": "(−) Minority interest", "value": 0 },
    { "label": "(−) Earnout / contingent consideration", "value": 0 }
  ],
  "analystNote": "one-sentence deal framing",
  "dataNote": "source quality note"
}`;
}

// ─── JSON parser ──────────────────────────────────────────────────────────────
function safeParseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch {}
  const stripped = raw.replace(/```(?:json)?|```/g, "").trim();
  try { return JSON.parse(stripped); } catch {}
  const s = stripped.indexOf("{"), e = stripped.lastIndexOf("}");
  if (s !== -1 && e > s) { try { return JSON.parse(stripped.slice(s, e + 1)); } catch {} }
  try { return JSON.parse(stripped.replace(/,(\s*[}\]])/g, "$1").replace(/[\x00-\x1F\x7F]/g, " ")); } catch {}
  throw new Error("Unable to parse model response as JSON");
}

function isValidResult(obj: unknown): obj is LiveAnalysisResult {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const r = obj as Record<string, unknown>;
  return typeof r.company === "string" && typeof r.sector === "string" &&
    r.stats !== null && typeof r.stats === "object" &&
    Array.isArray(r.valuationMethods) && r.valuationMethods.length >= 2 &&
    Array.isArray(r.commentary) && r.commentary.length >= 1;
}

function coerceNumbers(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(coerceNumbers);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
      k, typeof v === "number" && !Number.isFinite(v) ? 0 : coerceNumbers(v),
    ]));
  }
  return obj;
}

function safeLog(label: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`[analyze-server] ${label}:`, err.message.replace(/sk-ant-[A-Za-z0-9\-_]+/g, "[REDACTED]"));
  } else if (err !== null) {
    console.error(`[analyze-server] ${label}: non-Error`);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function runAnalysis(inputs: AnalysisInputs, apiKey: string): Promise<LiveAnalysisResult> {
  const traceId = Math.random().toString(36).slice(2, 10).toUpperCase();
  const t0 = Date.now();
  console.log(`[trace:${traceId}] analysis.start ${inputs.company}`);

  if (circuitBreaker.isOpen()) {
    console.log(`[trace:${traceId}] circuit open — fallback`);
    return buildFallbackAnalysis(inputs);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let anthropicResp: Response;
  try {
    anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: buildPrompt(inputs) }] }),
    });
  } catch (err) {
    clearTimeout(timer);
    circuitBreaker.recordFailure();
    safeLog("API call failed", err);
    return buildFallbackAnalysis(inputs);
  } finally {
    clearTimeout(timer);
  }

  if (!anthropicResp.ok) {
    const status = anthropicResp.status;
    safeLog(`Upstream HTTP ${status}`, new Error(await anthropicResp.text().catch(() => "").then(b => b.slice(0, 200))));
    if (status === 429 || status >= 500) { circuitBreaker.recordFailure(); return buildFallbackAnalysis(inputs); }
    throw new Error(`API request error (${status})`);
  }

  let data: { content?: { type: string; text?: string }[] };
  try { data = (await anthropicResp.json()) as typeof data; }
  catch (err) { safeLog("Failed to parse API envelope", err); circuitBreaker.recordFailure(); return buildFallbackAnalysis(inputs); }

  const textBlocks = (data.content ?? []).filter((b) => b.type === "text" && b.text);
  if (!textBlocks.length) { safeLog("No text block", new Error("empty")); circuitBreaker.recordFailure(); return buildFallbackAnalysis(inputs); }

  const raw = textBlocks[textBlocks.length - 1].text!;

  let parsed: unknown;
  try { parsed = safeParseJson(raw); }
  catch (err) { safeLog("JSON parse failure", err); circuitBreaker.recordFailure(); return buildFallbackAnalysis(inputs); }

  parsed = coerceNumbers(parsed);
  if (!isValidResult(parsed)) { safeLog("Invalid shape", new Error(Object.keys(parsed as object).join(","))); circuitBreaker.recordFailure(); return buildFallbackAnalysis(inputs); }

  circuitBreaker.recordSuccess();
  console.log(`[trace:${traceId}] analysis.success ${Date.now() - t0}ms`);
  return parsed;
}
