import { Search, Bookmark, Download, ChevronDown, Settings, Check } from "lucide-react";
import { LiveIndicator } from "./LiveIndicator";
import { Link } from "@tanstack/react-router";
import { Kbd } from "@/components/common/Kbd";
import { useAnalysis } from "@/context/AnalysisContext";
import { useState, useRef, useEffect } from "react";
import { TRANSACTIONS } from "@/data/transactions";
import { fmtCurrency, fmtMultiple, fmtPercent, fmtDate } from "@/lib/format";

function exportCSV(inputs: ReturnType<typeof useAnalysis>["inputs"], result: ReturnType<typeof useAnalysis>["result"]) {
  const comps = result?.relevantCompIds
    ? TRANSACTIONS.filter((t) => result.relevantCompIds.includes(t.id))
    : TRANSACTIONS;

  const rows = [
    ["Target", "Acquirer", "Date", "EV", "EV/EBITDA", "EV/Revenue", "Growth %", "EBITDA Margin %", "Type"],
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
    ["LTM Revenue $M", inputs.revenue],
    ["LTM EBITDA $M", inputs.ebitda],
    ["Growth %", inputs.growth],
    ["EBITDA Margin %", inputs.ebitdaMargin],
    result ? ["Median EV/EBITDA", result.stats.medianEvEbitda.toFixed(1) + "x"] : [],
    result ? ["Median EV/Revenue", result.stats.medianEvRevenue.toFixed(1) + "x"] : [],
  ];

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inputs.company.replace(/\s+/g, "_")}_comps_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(inputs: ReturnType<typeof useAnalysis>["inputs"], result: ReturnType<typeof useAnalysis>["result"]) {
  const comps = result?.relevantCompIds
    ? TRANSACTIONS.filter((t) => result.relevantCompIds.includes(t.id))
    : TRANSACTIONS.slice(0, 12);

  const rows = comps
    .map(
      (t) =>
        `<tr>
        <td>${t.target}</td><td>${t.acquirer}</td><td>${t.date.slice(0, 7)}</td>
        <td>${fmtCurrency(t.dealValue)}</td>
        <td>${t.evEbitda > 0 ? fmtMultiple(t.evEbitda) : "n/m"}</td>
        <td>${fmtMultiple(t.evRevenue)}</td>
        <td>${fmtPercent(t.growth, 0)}</td>
        <td>${fmtPercent(t.ebitdaMargin, 0)}</td>
        <td>${t.type}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Deal Analysis — ${inputs.company}</title>
  <style>
    body{font-family:system-ui,sans-serif;font-size:11px;color:#111;padding:28px;max-width:960px;margin:0 auto}
    h1{font-size:18px;font-weight:700;margin-bottom:4px}
    .meta{color:#666;font-size:10px;margin-bottom:20px}
    .stats{display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap}
    .stat{background:#f5f5f5;padding:10px 14px;border:1px solid #ddd;min-width:100px}
    .sv{font-size:16px;font-weight:700}
    .sl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
    h2{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#888;margin:20px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th{background:#f0f0f0;padding:5px 8px;text-align:left;font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #ddd}
    td{padding:5px 8px;border-bottom:1px solid #f0f0f0}
    .commentary{background:#fffbf0;border-left:3px solid #f0a020;padding:10px 12px;font-size:11px;line-height:1.7;margin-bottom:14px}
    .disclaimer{margin-top:24px;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:8px}
    @media print{body{padding:0}}
  </style>
  </head><body>
  <h1>Deal Analysis — ${inputs.company}</h1>
  <div class="meta">${inputs.sector} · ${inputs.geography} · ${inputs.dealType} · Generated ${fmtDate(new Date().toISOString())}</div>
  <div class="stats">
    <div class="stat"><div class="sv">$${inputs.revenue}M</div><div class="sl">LTM Revenue</div></div>
    <div class="stat"><div class="sv">$${inputs.ebitda}M</div><div class="sl">LTM EBITDA</div></div>
    <div class="stat"><div class="sv">${inputs.ebitdaMargin}%</div><div class="sl">EBITDA Margin</div></div>
    <div class="stat"><div class="sv">${inputs.growth}%</div><div class="sl">YoY Growth</div></div>
    ${result ? `<div class="stat"><div class="sv">${result.stats.medianEvEbitda.toFixed(1)}x</div><div class="sl">Median EV/EBITDA</div></div>` : ""}
    ${result ? `<div class="stat"><div class="sv">${result.stats.medianEvRevenue.toFixed(1)}x</div><div class="sl">Median EV/Rev</div></div>` : ""}
  </div>
  ${result?.commentary?.length ? `<h2>Analyst Commentary</h2><div class="commentary">${result.commentary.map((c) => `<p style="margin-bottom:6px">${c}</p>`).join("")}</div>` : ""}
  <h2>Comparable Transactions</h2>
  <table>
    <thead><tr><th>Target</th><th>Acquirer</th><th>Date</th><th>EV</th><th>EV/EBITDA</th><th>EV/Rev</th><th>Growth</th><th>Margin</th><th>Type</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="disclaimer">For internal use only. Not for distribution. Figures sourced from public filings and market data; verify before use in client materials.</div>
  </body></html>`;

  const w = window.open("", "_blank", "width=960,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.addEventListener("load", () => { w.focus(); w.print(); });
}

export function TopBar() {
  const { inputs, result, status } = useAnalysis();
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border bg-background px-4">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary text-primary-foreground">
          <span className="font-mono text-[11px] font-bold">DL</span>
        </div>
        <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-foreground">
          DEAL
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Lens
        </span>
      </Link>

      <div className="mx-3 h-5 w-px bg-border" />

      <div className="relative flex max-w-md flex-1 items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search companies, transactions, sectors…"
          className="h-8 w-full rounded border border-border bg-surface-1 pl-8 pr-16 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/60 focus:outline-none"
        />
        <div className="absolute right-2 flex items-center gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LiveIndicator />

        {status === "success" && (
          <span className="text-[10px] text-positive">
            ✓ Analysis updated
          </span>
        )}
        {status === "error" && (
          <span className="text-[10px] text-destructive">
            Analysis failed
          </span>
        )}

        <Link
          to="/saved"
          className="flex items-center gap-1.5 rounded border border-border bg-surface-1 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          <Bookmark className="h-3 w-3" />
          Saved
        </Link>

        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded border border-border bg-surface-1 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
          >
            <Download className="h-3 w-3" />
            Export
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded border border-border bg-popover shadow-lg">
              <button
                onClick={() => { exportCSV(inputs, result); setExportOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-foreground hover:bg-surface-2"
              >
                Download CSV
              </button>
              <button
                onClick={() => { exportPDF(inputs, result); setExportOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-foreground hover:bg-surface-2"
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  setExportOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-foreground hover:bg-surface-2"
              >
                {copied ? <Check className="h-3 w-3 text-positive" /> : null}
                Copy link
              </button>
            </div>
          )}
        </div>

        <button className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-1 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
