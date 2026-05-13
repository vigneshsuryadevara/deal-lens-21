import { useState } from "react";
import { ChevronRight, Play, Clock, Building2 } from "lucide-react";
import { SECTORS, GEOGRAPHIES, DEAL_TYPES } from "@/data/taxonomy";
import { RECENT_SEARCHES } from "@/data/analysis";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function inputCls(extra?: string) {
  return cn(
    "h-8 w-full rounded border border-border bg-background px-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/60 focus:outline-none transition-colors num",
    extra,
  );
}

export function Sidebar() {
  const [sector, setSector] = useState<string>("Software & SaaS");
  const [dealType, setDealType] = useState<string>("Strategic M&A");

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Building2 className="h-3 w-3" />
          New Analysis
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <Field label="Company">
          <input className={inputCls()} defaultValue="Helix Analytics" placeholder="e.g. Acme Corp" />
        </Field>

        <Field label="Sector">
          <div className="flex flex-wrap gap-1">
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className={cn(
                  "rounded-sm border px-2 py-0.5 text-[10.5px] transition-colors",
                  sector === s
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border bg-surface-1 text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Geography">
          <select className={inputCls("appearance-none")}>
            {GEOGRAPHIES.map((g) => <option key={g}>{g}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="LTM Revenue">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
              <input className={inputCls("pl-5 pr-7")} defaultValue="412" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">M</span>
            </div>
          </Field>
          <Field label="LTM EBITDA">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">$</span>
              <input className={inputCls("pl-5 pr-7")} defaultValue="78" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">M</span>
            </div>
          </Field>
          <Field label="YoY Growth">
            <div className="relative">
              <input className={inputCls("pr-7")} defaultValue="24" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
            </div>
          </Field>
          <Field label="EBITDA Margin">
            <div className="relative">
              <input className={inputCls("pr-7")} defaultValue="19" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
            </div>
          </Field>
        </div>

        <Field label="Deal Type">
          <div className="grid grid-cols-2 gap-1">
            {DEAL_TYPES.map((d) => (
              <button
                key={d}
                onClick={() => setDealType(d)}
                className={cn(
                  "rounded-sm border px-2 py-1 text-[10.5px] transition-colors",
                  dealType === d
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border bg-surface-1 text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>

        <button className="group flex h-9 w-full items-center justify-center gap-2 rounded border border-primary/40 bg-primary/15 text-[12px] font-semibold text-foreground transition-all hover:border-primary/60 hover:bg-primary/25">
          <Play className="h-3 w-3 fill-current" />
          Run Analysis
          <span className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="rounded border border-border bg-background px-1 font-mono">⏎</span>
          </span>
        </button>
      </div>

      <div className="mt-2 border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Recent Searches
        </div>
        <div className="space-y-0.5">
          {RECENT_SEARCHES.map((r) => (
            <button
              key={r.name}
              className="group flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[12px] text-foreground">{r.name}</div>
                <div className="truncate text-[10px] text-muted-foreground">{r.sector}</div>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-foreground" />
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
