/**
 * analyze-server.ts
 *
 * Server-only Anthropic integration.
 * Import ONLY from server.ts or other server-side modules.
 * Never import from client-side React components.
 */

import { TRANSACTIONS } from "../data/transactions";
import { BUYERS } from "../data/buyers";
import type { AnalysisInputs } from "../types/analysis";

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
5. Build valuation methods using target financials × multiples — all dollar values as absolute USD (not $M shorthand), e.g. 3850000000 not 3850.
6. Write 3-4 sentences of sharp analyst commentary referencing the company by name.
7. Identify 3-5 buyer IDs most likely to pursue this target. Return exact IDs only.
8. Propose realistic EBITDA add-backs and bridge items appropriate for this company profile.

Return ONLY valid JSON — no markdown fences, no explanatory text outside the object:
{
  "company": "${inp.company}",
  "sector": "${inp.sector}",
  "geography": "${inp.geography}",
  "asOf": "${new Date().toISOString()}",
  "stats": {
    "medianEvEbitda": 0.0,
    "medianEvRevenue": 0.0,
    "p25EvEbitda": 0.0,
    "p75EvEbitda": 0.0,
    "p25EvRevenue": 0.0,
    "p75EvRevenue": 0.0
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
  "marketObservations": [
    { "label": "label", "value": "value", "tone": "positive" }
  ],
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

export async function runAnalysis(
  inputs: AnalysisInputs,
  apiKey: string,
): Promise<unknown> {
  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env["AI_MODEL"] ?? "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: buildPrompt(inputs) }],
    }),
  });

  if (!anthropicResp.ok) {
    const body = await anthropicResp.text().catch(() => "");
    throw new Error(`Upstream error ${anthropicResp.status}: ${body.slice(0, 200)}`);
  }

  const data = (await anthropicResp.json()) as {
    content?: { type: string; text?: string }[];
  };

  const textBlocks = (data.content ?? []).filter(
    (b) => b.type === "text" && b.text,
  );
  if (!textBlocks.length) {
    throw new Error("No text content in model response");
  }

  const raw = textBlocks[textBlocks.length - 1].text!;
  const clean = raw.replace(/```json|```/g, "").trim();

  return JSON.parse(clean);
}
