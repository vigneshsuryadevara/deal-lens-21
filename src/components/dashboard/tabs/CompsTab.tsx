import { Fragment, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, ArrowUpDown, FileText, Star } from "lucide-react";
import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { StatPill } from "@/components/common/StatPill";
import { useAnalysis } from "@/context/AnalysisContext";
import { TRANSACTIONS, type Transaction } from "@/data/transactions";
import { fmtCurrency, fmtMonthYear, fmtMultiple, fmtPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "date" | "dealValue" | "evEbitda" | "evRevenue" | "growth" | "ebitdaMargin";

const COLS: {
  key: string;
  label: string;
  align?: "right" | "left";
  sortable?: boolean;
}[] = [
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
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i < filled ? "bg-positive" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

type FilterType = "All" | "Strategic" | "Sponsor" | "Take-Private" | "Highlighted";

export function CompsTab() {
  const { result } = useAnalysis();

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("All");

  const relevantIds = new Set<string>(result?.relevantCompIds ?? []);
  const hasHighlights = relevantIds.size > 0;

  const sorted = useMemo(() => {
    let list = [...TRANSACTIONS];

    // Filter
    if (filter === "Highlighted" && hasHighlights) {
      list = list.filter((t) => relevantIds.has(t.id));
    } else if (filter !== "All") {
      list = list.filter((t) => {
        if (filter === "Sponsor") return t.type === "Sponsor" || t.type === "Take-Private";
        if (filter === "Strategic") return t.type === "Strategic";
        return t.type === filter;
      });
    }

    // Sort
    list.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === "date") {
        return sortDir === "asc"
          ? new Date(av as string).getTime() - new Date(bv as string).getTime()
          : new Date(bv as string).getTime() - new Date(av as string).getTime();
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    return list;
  }, [sortKey, sortDir, filter, relevantIds, hasHighlights]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  // Medians for column colour-coding
  const validEbitda = TRANSACTIONS.filter((t) => t.evEbitda > 0).map((t) => t.evEbitda).sort((a, b) => a - b);
  const medianEbitda = validEbitda[Math.floor(validEbitda.length / 2)] ?? 0;

  const FILTERS: FilterType[] = ["All", "Highlighted", "Strategic", "Sponsor", "Take-Private"];

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center gap-3">
          <PanelTitle>Comparable Transactions</PanelTitle>
          <StatPill>{sorted.length} deals</StatPill>
          {hasHighlights && (
            <StatPill tone="positive">{relevantIds.size} highlighted</StatPill>
          )}
        </div>
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              disabled={f === "Highlighted" && !hasHighlights}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                filter === f
                  ? "border-primary/60 bg-primary/15 text-foreground"
                  : "border-border bg-surface-2 text-muted-foreground hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </PanelHeader>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="w-6 px-2 py-2" />
              <th className="w-4 px-1 py-2" />
              {COLS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable && toggleSort(c.key as SortKey)}
                  className={cn(
                    "whitespace-nowrap px-3 py-2 font-medium",
                    c.align === "right" ? "text-right" : "text-left",
                    c.sortable && "cursor-pointer select-none hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      c.align === "right" && "justify-end",
                    )}
                  >
                    {c.label}
                    {c.sortable &&
                      (sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3 w-3 text-foreground" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-foreground" />
                        )
                      ) : (
                        <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const isOpen = expanded === t.id;
              const isHighlighted = relevantIds.has(t.id);
              const eeColor =
                t.evEbitda > 0 && medianEbitda
                  ? t.evEbitda > medianEbitda * 1.15
                    ? "text-positive"
                    : t.evEbitda < medianEbitda * 0.85
                      ? "text-muted-foreground"
                      : ""
                  : "";

              return (
                <Fragment key={t.id}>
                  <motion.tr
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.018, duration: 0.24 }}
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className={cn(
                      "cursor-pointer border-b border-border/60 transition-colors",
                      isOpen
                        ? "bg-surface-2"
                        : isHighlighted
                          ? "bg-accent/5 hover:bg-accent/10"
                          : "hover:bg-surface-1/80",
                    )}
                  >
                    <td className="px-2 py-2 text-center text-muted-foreground">
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          !isOpen && "-rotate-90",
                        )}
                      />
                    </td>
                    {/* Highlight star */}
                    <td className="px-1 py-2">
                      {isHighlighted && (
                        <Star className="h-2.5 w-2.5 fill-accent text-accent" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-foreground">{t.target}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.acquirer}</td>
                    <td className="px-3 py-2 text-right num text-muted-foreground">
                      {fmtMonthYear(t.date)}
                    </td>
                    <td className="px-3 py-2 text-right num text-foreground">
                      {fmtCurrency(t.dealValue)}
                    </td>
                    <td className={cn("px-3 py-2 text-right num", eeColor)}>
                      {t.evEbitda > 0 ? fmtMultiple(t.evEbitda) : "n/m"}
                    </td>
                    <td className="px-3 py-2 text-right num text-foreground">
                      {fmtMultiple(t.evRevenue)}
                    </td>
                    <td className="px-3 py-2 text-right num text-positive">
                      {fmtPercent(t.growth, 0)}
                    </td>
                    <td className="px-3 py-2 text-right num text-muted-foreground">
                      {fmtPercent(t.ebitdaMargin, 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <ConfidenceDots level={t.confidence} />
                    </td>
                  </motion.tr>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <tr className="border-b border-border bg-surface-1">
                        <td colSpan={12} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-12 gap-4 border-l-2 border-accent/60 px-5 py-4">
                              <div className="col-span-12 lg:col-span-7">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Transaction Rationale
                                </div>
                                <p className="mt-1 text-[12px] leading-relaxed text-foreground/90">
                                  {t.rationale}
                                </p>
                                <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Notes
                                </div>
                                <p className="mt-1 text-[12px] leading-relaxed text-foreground/80">
                                  {t.notes}
                                </p>
                              </div>
                              <div className="col-span-12 space-y-2 lg:col-span-5">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Sources
                                </div>
                                {t.sources.map((s) => (
                                  <a
                                    key={s.label}
                                    href={s.url}
                                    className="flex items-center justify-between rounded border border-border bg-surface-2 px-2.5 py-1.5 text-[11px] text-foreground hover:border-border-strong"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <FileText className="h-3 w-3 text-muted-foreground" />
                                      {s.label}
                                    </span>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                  </a>
                                ))}
                                <div className="rounded border border-border bg-surface-2 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
                                  Confidence:{" "}
                                  <span className="text-foreground">{t.confidence}</span> · Source
                                  quality reviewed by deal team
                                </div>
                                {isHighlighted && (
                                  <div className="rounded border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-[10.5px] text-accent">
                                    ★ Highlighted as most relevant by analysis
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
        <span>
          Showing {sorted.length} of {TRANSACTIONS.length} transactions
          {hasHighlights ? ` · ${relevantIds.size} highlighted by analysis` : ""}
        </span>
        <span className="num">
          Median EV/EBITDA{" "}
          <span className="text-foreground">
            {result ? fmtMultiple(result.stats.medianEvEbitda) : fmtMultiple(medianEbitda)}
          </span>{" "}
          · Median EV/Rev{" "}
          <span className="text-foreground">
            {result
              ? fmtMultiple(result.stats.medianEvRevenue)
              : fmtMultiple(
                  TRANSACTIONS.map((t) => t.evRevenue).sort((a, b) => a - b)[
                    Math.floor(TRANSACTIONS.length / 2)
                  ],
                )}
          </span>
        </span>
      </div>
    </Panel>
  );
}
