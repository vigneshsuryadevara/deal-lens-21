import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, ArrowUpDown, FileText } from "lucide-react";
import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { StatPill } from "@/components/common/StatPill";
import { TRANSACTIONS, type Transaction } from "@/data/transactions";
import { fmtCurrency, fmtMonthYear, fmtMultiple, fmtPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "date" | "dealValue" | "evEbitda" | "evRevenue" | "growth" | "ebitdaMargin";

const COLS: { key: SortKey | "target" | "acquirer" | "type" | "confidence"; label: string; align?: "right" | "left"; sortable?: boolean }[] = [
  { key: "target", label: "Target", align: "left" },
  { key: "acquirer", label: "Acquirer", align: "left" },
  { key: "date", label: "Date", align: "right", sortable: true },
  { key: "dealValue", label: "EV", align: "right", sortable: true },
  { key: "evEbitda", label: "EV / EBITDA", align: "right", sortable: true },
  { key: "evRevenue", label: "EV / Rev", align: "right", sortable: true },
  { key: "growth", label: "Growth", align: "right", sortable: true },
  { key: "ebitdaMargin", label: "Margin", align: "right", sortable: true },
  { key: "type", label: "Type", align: "right" },
  { key: "confidence", label: "Source", align: "right" },
];

function ConfidenceDots({ level }: { level: Transaction["confidence"] }) {
  const filled = level === "High" ? 3 : level === "Medium" ? 2 : 1;
  return (
    <div className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map(i => (
        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < filled ? "bg-positive" : "bg-border")} />
      ))}
    </div>
  );
}

export function CompsTab() {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const copy = [...TRANSACTIONS];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === "date") {
        return sortDir === "asc"
          ? new Date(av as string).getTime() - new Date(bv as string).getTime()
          : new Date(bv as string).getTime() - new Date(av as string).getTime();
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return copy;
  }, [sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center gap-3">
          <PanelTitle>Comparable Transactions</PanelTitle>
          <StatPill>{TRANSACTIONS.length} deals</StatPill>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Filtered: Software & SaaS · 2022–2025</span>
          <button className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-foreground hover:border-border-strong">Filters</button>
        </div>
      </PanelHeader>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="w-6 px-2 py-2"></th>
              {COLS.map(c => (
                <th
                  key={c.key}
                  onClick={() => c.sortable && toggleSort(c.key as SortKey)}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-medium",
                    c.align === "right" ? "text-right" : "text-left",
                    c.sortable && "cursor-pointer select-none hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortable && (
                      sortKey === c.key
                        ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-foreground" /> : <ChevronDown className="h-3 w-3 text-foreground" />)
                        : <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const isOpen = expanded === t.id;
              return (
                <motion.tr
                  key={t.id}
                  // group used in cells
                  initial={false}
                  className="border-b border-border/60 hover:bg-surface-1/60"
                  // wrapper for animation entrance
                  // staggered fade
                  // disable layout shifts
                  // omitted complexities
                ></motion.tr>
              );
            })}
          </tbody>
        </table>

        {/* Real rendering with expansion: separate render below */}
      </div>

      <div className="hidden">{/* keep above to avoid table double-render below */}</div>

      <div className="overflow-x-auto">
        <table className="-mt-px w-full border-collapse text-[11.5px]">
          <colgroup>
            <col className="w-6" />
          </colgroup>
          <tbody>
            {sorted.map((t, i) => {
              const isOpen = expanded === t.id;
              return (
                <>
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.018, duration: 0.24 }}
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition-colors",
                      isOpen ? "bg-surface-2" : "hover:bg-surface-1/80",
                    )}
                  >
                    <td className="px-2 py-2 text-center text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 rotate-180" />}
                    </td>
                    <td className="px-3 py-2 text-foreground">{t.target}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.acquirer}</td>
                    <td className="px-3 py-2 text-right num text-muted-foreground">{fmtMonthYear(t.date)}</td>
                    <td className="px-3 py-2 text-right num text-foreground">{fmtCurrency(t.dealValue)}</td>
                    <td className="px-3 py-2 text-right num text-foreground">{t.evEbitda > 0 ? fmtMultiple(t.evEbitda) : "n/m"}</td>
                    <td className="px-3 py-2 text-right num text-foreground">{fmtMultiple(t.evRevenue)}</td>
                    <td className="px-3 py-2 text-right num text-positive">{fmtPercent(t.growth, 0)}</td>
                    <td className="px-3 py-2 text-right num text-muted-foreground">{fmtPercent(t.ebitdaMargin, 0)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.type}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ConfidenceDots level={t.confidence} />
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {isOpen && (
                      <tr className="border-b border-border bg-surface-1">
                        <td colSpan={11} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-12 gap-4 border-l-2 border-accent/60 px-5 py-4">
                              <div className="col-span-12 lg:col-span-7">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transaction Rationale</div>
                                <p className="mt-1 text-[12px] leading-relaxed text-foreground/90">{t.rationale}</p>
                                <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
                                <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">{t.notes}</p>
                              </div>
                              <div className="col-span-12 lg:col-span-5 space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</div>
                                {t.sources.map(s => (
                                  <a key={s.label} href={s.url} className="flex items-center justify-between rounded border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] text-foreground hover:border-border-strong">
                                    <span className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-muted-foreground" /> {s.label}</span>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                  </a>
                                ))}
                                <div className="rounded border border-border bg-surface-2 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
                                  Confidence: <span className="text-foreground">{t.confidence}</span> · Source quality reviewed by deal team
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
        <span>Showing {TRANSACTIONS.length} of {TRANSACTIONS.length} transactions</span>
        <span className="num">Median EV/EBITDA <span className="text-foreground">28.0x</span> · Median EV/Rev <span className="text-foreground">7.0x</span></span>
      </div>
    </Panel>
  );
}
