import { Search, Bookmark, Download, ChevronDown, Settings, Check, Activity } from "lucide-react";
import { LiveIndicator } from "./LiveIndicator";
import { Link } from "@tanstack/react-router";
import { Kbd } from "@/components/common/Kbd";
import { useAnalysis } from "@/context/AnalysisContext";
import { useState, useRef, useEffect, useCallback } from "react";
import { TRANSACTIONS } from "@/data/transactions";
import { fmtCurrency, fmtMultiple, fmtDate } from "@/lib/format";

function exportCSV(
  inputs: ReturnType<typeof useAnalysis>["inputs"],
  result: ReturnType<typeof useAnalysis>["result"],
) {
  const comps = result?.relevantCompIds
    ? TRANSACTIONS.filter((t) => result.relevantCompIds.includes(t.id))
    : TRANSACTIONS;

  const rows = [
    ["Target", "Acquirer", "Date", "EV ($M)", "EV/EBITDA", "EV/Revenue", "Growth %", "EBITDA Margin %", "Type"],
    ...comps.map((t) => [
      t.target, t.acquirer, t.date,
      (t.dealValue / 1e6).toFixed(0),
      t.evEbitda > 0 ? t.evEbitda.toFixed(1) : "n/m",
      t.evRevenue.toFixed(1),
      t.growth.toFixed(1),
      t.ebitdaMargin.toFixed(1),
      t.type,
    ]),
    [],
    ["Analysis Summary"],
    ["Company", inputs.company],
    ["Sector", inputs.sector],
    ["Geography", inputs.geography],
    ["Deal Type", inputs.dealType],
    ["LTM Revenue ($M)", inputs.revenue],
    ["LTM EBITDA ($M)", inputs.ebitda],
    ["Growth (%)", inputs.growth],
    ["EBITDA Margin (%)", inputs.ebitdaMargin],
    ["Net Debt ($M)", inputs.netDebt],
    result ? ["Median EV/EBITDA", result.stats.medianEvEbitda.toFixed(1) + "x"] : [],
    result ? ["Median EV/Revenue", result.stats.medianEvRevenue.toFixed(1) + "x"] : [],
    [],
    ["Generated", new Date().toISOString()],
    ["For internal use only. Not for distribution."],
  ];

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inputs.company.replace(/\s+/g, "_")}_analysis_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(
  inputs: ReturnType<typeof useAnalysis>["inputs"],
  result: ReturnType<typeof useAnalysis>["result"],
) {
  const comps = result?.relevantCompIds
    ? TRANSACTIONS.filter((t) => result.relevantCompIds.includes(t.id))
    : TRANSACTIONS.slice(0, 12);

  const rows = comps
    .map((t) =>
      `<tr>
        <td>${t.target}</td><td>${t.acquirer}</td><td>${t.date.slice(0, 7)}</td>
        <td style="text-align:right">${fmtCurrency(t.dealValue)}</td>
        <td style="text-align:right">${t.evEbitda > 0 ? fmtMultiple(t.evEbitda) : "n/m"}</td>
        <td style="text-align:right">${fmtMultiple(t.evRevenue)}</td>
        <td style="text-align:right">${t.growth.toFixed(0)}%</td>
        <td style="text-align:right">${t.ebitdaMargin.toFixed(0)}%</td>
        <td>${t.type}</td>
      </tr>`,
    )
    .join("");

  const valuationRows = result?.valuationMethods
    ?.map((v) =>
      `<tr>
        <td>${v.label}</td>
        <td style="text-align:right">${fmtCurrency(v.low)}</td>
        <td style="text-align:right">${fmtCurrency(v.base)}</td>
        <td style="text-align:right">${fmtCurrency(v.high)}</td>
      </tr>`
    )
    .join("") ?? "";

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>M&A Analysis — ${inputs.company}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #1a1a1a; padding: 28px 32px; max-width: 1020px; margin: 0 auto; background: #fff; }
    .header { border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .firm-name { font-size: 9px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #555; margin-bottom: 4px; }
    h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
    .meta { font-size: 9px; color: #666; margin-top: 3px; }
    .confidential { font-size: 9px; color: #999; font-style: italic; }
    .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin: 14px 0; }
    .kpi { border: 1px solid #ddd; padding: 8px 10px; }
    .kpi-val { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .kpi-lbl { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
    h2 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin: 16px 0 6px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
    .commentary { background: #f9f8f5; border-left: 3px solid #c8a53a; padding: 10px 12px; margin-bottom: 12px; }
    .commentary p { font-size: 10px; line-height: 1.65; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 16px; }
    th { background: #f0f0f0; padding: 5px 8px; text-align: left; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #ccc; white-space: nowrap; }
    th.r, td.r { text-align: right; }
    td { padding: 4px 8px; border-bottom: 1px solid #f0f0f0; }
    tr:nth-child(even) td { background: #fafafa; }
    .obs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
    .obs { border: 1px solid #eee; padding: 6px 8px; }
    .obs-lbl { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }
    .obs-val { font-size: 10px; font-weight: 600; margin-top: 2px; }
    .disclaimer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #eee; font-size: 8px; color: #aaa; }
    @media print { body { padding: 0; } @page { margin: 20mm; } }
  </style>
  </head><body>
  <div class="header">
    <div class="firm-name">M&A Intelligence Terminal</div>
    <h1>${inputs.company} — Deal Analysis</h1>
    <div class="meta">${inputs.sector} · ${inputs.geography} · ${inputs.dealType} · ${fmtDate(new Date().toISOString())}</div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi-val">$${inputs.revenue}M</div><div class="kpi-lbl">LTM Revenue</div></div>
    <div class="kpi"><div class="kpi-val">$${inputs.ebitda}M</div><div class="kpi-lbl">LTM EBITDA</div></div>
    <div class="kpi"><div class="kpi-val">${inputs.ebitdaMargin}%</div><div class="kpi-lbl">EBITDA Margin</div></div>
    <div class="kpi"><div class="kpi-val">${inputs.growth}%</div><div class="kpi-lbl">YoY Growth</div></div>
    ${result ? `<div class="kpi"><div class="kpi-val">${result.stats.medianEvEbitda.toFixed(1)}x</div><div class="kpi-lbl">Median EV/EBITDA</div></div>` : ""}
    ${result ? `<div class="kpi"><div class="kpi-val">${result.stats.medianEvRevenue.toFixed(1)}x</div><div class="kpi-lbl">Median EV/Revenue</div></div>` : ""}
  </div>

  ${result?.commentary?.length ? `<h2>Analyst Commentary</h2><div class="commentary">${result.commentary.map((c) => `<p>${c}</p>`).join("")}</div>` : ""}

  ${result?.marketObservations?.length ? `
  <h2>Market Observations</h2>
  <div class="obs-grid">
    ${result.marketObservations.map((o) => `<div class="obs"><div class="obs-lbl">${o.label}</div><div class="obs-val">${o.value}</div></div>`).join("")}
  </div>` : ""}

  ${result?.valuationMethods?.length ? `
  <h2>Valuation Analysis — Football Field</h2>
  <table>
    <thead><tr><th>Methodology</th><th class="r">Low</th><th class="r">Base</th><th class="r">High</th></tr></thead>
    <tbody>${valuationRows}</tbody>
  </table>` : ""}

  <h2>Comparable Transactions</h2>
  <table>
    <thead><tr><th>Target</th><th>Acquirer</th><th>Date</th><th class="r">EV</th><th class="r">EV/EBITDA</th><th class="r">EV/Rev</th><th class="r">Growth</th><th class="r">Margin</th><th>Type</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="disclaimer">For internal use only. Not for distribution. This analysis was generated for informational purposes. Figures sourced from public filings, market data, and precedent transaction databases. All information should be independently verified before use in client materials or investment decisions. Generated: ${new Date().toISOString()}</div>
  </body></html>`;

  const w = window.open("", "_blank", "width=1060,height=750");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.addEventListener("load", () => { w.focus(); w.print(); });
}

export function TopBar() {
  const { inputs, result, status, isFallback } = useAnalysis();
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setExportOpen(false);
  }, []);

  return (
    <header className="flex h-11 items-center gap-3 border-b border-border bg-background px-4">
      <Link to="/" className="flex items-center gap-2 shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <span className="font-mono text-[10px] font-bold">IB</span>
        </div>
        <span className="font-mono text-[12px] font-semibold tracking-[0.18em] text-foreground">
          MERIDIAN
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Analytics
        </span>
      </Link>

      <div className="mx-2 h-4 w-px bg-border" />

      <div className="relative flex max-w-xs flex-1 items-center">
        <Search className="absolute left-2.5 h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search companies, sectors…"
          className="h-7 w-full rounded border border-border bg-surface-1 pl-7 pr-12 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/60 focus:outline-none"
        />
        <div className="absolute right-2 flex items-center gap-0.5">
          <Kbd>⌘</Kbd><Kbd>K</Kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <LiveIndicator />

        {status === "enhancing" && (
          <span className="text-[9.5px] text-warning animate-pulse">⚡ Enhancing with AI…</span>
        )}
        {status === "success" && !isFallback && (
          <span className="text-[9.5px] text-positive">✓ Live analysis</span>
        )}
        {status === "success" && isFallback && (
          <span className="text-[9.5px] text-warning">⚡ Dataset analysis</span>
        )}
        {status === "error" && (
          <span className="text-[9.5px] text-destructive">Analysis failed</span>
        )}

        <Link
          to="/saved"
          className="flex items-center gap-1 rounded border border-border bg-surface-1 px-2 py-1 text-[10.5px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          <Bookmark className="h-3 w-3" />
          Saved
        </Link>

        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1 rounded border border-border bg-surface-1 px-2 py-1 text-[10.5px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <Download className="h-3 w-3" />
            Export
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded border border-border bg-popover shadow-lg">
              <button
                onClick={() => { exportCSV(inputs, result); setExportOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[10.5px] text-foreground hover:bg-surface-2"
              >
                Download CSV
              </button>
              <button
                onClick={() => { exportPDF(inputs, result); setExportOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[10.5px] text-foreground hover:bg-surface-2"
              >
                Print / Save PDF
              </button>
              <button
                onClick={handleCopy}
                className="flex w-full items-center gap-2 px-3 py-2 text-[10.5px] text-foreground hover:bg-surface-2"
              >
                {copied ? <Check className="h-3 w-3 text-positive" /> : null}
                Copy link
              </button>
            </div>
          )}
        </div>

        <a
          href="/api/health"
          target="_blank"
          rel="noreferrer"
          title="System health"
          className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-1 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Activity className="h-3 w-3" />
        </a>

        <button className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-1 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
          <Settings className="h-3 w-3" />
        </button>
      </div>
    </header>
  );
}
