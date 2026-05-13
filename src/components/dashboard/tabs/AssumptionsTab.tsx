import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { ASSUMPTIONS } from "@/data/analysis";
import { Plus, Pencil } from "lucide-react";

const CATEGORIES = ["Add-Backs", "Debt Adjustments", "Other", "Working Capital"];

export function AssumptionsTab() {
  return (
    <div className="grid grid-cols-12 gap-3">
      <Panel className="col-span-12 lg:col-span-8">
        <PanelHeader>
          <PanelTitle>Adjustments & Assumptions</PanelTitle>
          <button className="flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-foreground hover:border-border-strong">
            <Plus className="h-3 w-3" /> Add line
          </button>
        </PanelHeader>
        <div className="divide-y divide-border">
          {CATEGORIES.map(cat => {
            const items = ASSUMPTIONS.filter(a => a.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="px-4 py-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat}</div>
                <table className="w-full text-[12px]">
                  <tbody>
                    {items.map(a => (
                      <tr key={a.id} className="group">
                        <td className="py-1.5 text-foreground">{a.label}</td>
                        <td className="py-1.5 text-muted-foreground text-[11px]">{a.note}</td>
                        <td className="w-28 py-1.5 text-right">
                          <span className="num text-foreground">{a.value > 0 ? "+" : ""}{a.value.toFixed(1)}</span>
                          <span className="ml-1 text-[10px] text-muted-foreground">{a.unit}</span>
                        </td>
                        <td className="w-8 py-1.5 text-right">
                          <button className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                            <Pencil className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="col-span-12 lg:col-span-4">
        <PanelHeader><PanelTitle>Bridge to Equity Value</PanelTitle></PanelHeader>
        <div className="space-y-2 px-4 py-3 text-[12px]">
          {[
            { label: "Enterprise Value (Base)", value: 2184, tone: "foreground" },
            { label: "(+) Cash & equivalents", value: 78, tone: "positive" },
            { label: "(−) Total debt", value: 0, tone: "muted" },
            { label: "(−) Capitalized leases", value: -12.5, tone: "muted" },
            { label: "(−) Minority interest", value: -4.8, tone: "muted" },
            { label: "(−) Earnout liability", value: -9.2, tone: "muted" },
          ].map((r, i) => (
            <div key={i} className="flex items-center justify-between border-b border-border/40 pb-1.5">
              <span className={r.tone === "muted" ? "text-muted-foreground" : "text-foreground"}>{r.label}</span>
              <span className="num text-foreground">${r.value.toFixed(1)}M</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded border border-accent/40 bg-accent/10 px-2.5 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Equity Value</span>
            <span className="num text-[14px] font-semibold text-foreground">$2,235.5M</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}
