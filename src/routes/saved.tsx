import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, PanelHeader, PanelTitle } from "@/components/common/Card";
import { StatPill } from "@/components/common/StatPill";
import { SAVED_ANALYSES } from "@/data/analysis";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { ArrowUpRight, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved Analyses — COMPS Terminal" },
      { name: "description", content: "Browse saved precedent transaction analyses, valuations, and buyer screens." },
    ],
  }),
  component: SavedPage,
});

function statusTone(s: string) {
  if (s === "Live") return "positive" as const;
  if (s === "Final") return "neutral" as const;
  if (s === "In Review") return "warning" as const;
  return "neutral" as const;
}

function SavedPage() {
  return (
    <AppShell>
      <div className="px-6 pt-6 pb-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <FolderOpen className="h-3 w-3" /> Workspace
            </div>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">Saved Analyses</h1>
            <p className="mt-1 text-[12px] text-muted-foreground">{SAVED_ANALYSES.length} analyses across 4 sectors · Last updated {fmtDate(SAVED_ANALYSES[0].updated)}</p>
          </div>
          <Link to="/" className="rounded border border-border bg-surface-1 px-3 py-1.5 text-[11px] text-foreground hover:border-border-strong">
            ← Back to workspace
          </Link>
        </div>

        <Panel>
          <PanelHeader>
            <PanelTitle>All Analyses</PanelTitle>
            <span className="text-[10px] text-muted-foreground">Sorted by last updated</span>
          </PanelHeader>
          <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
            {SAVED_ANALYSES.map(a => (
              <Link
                key={a.id}
                to="/"
                className="group flex flex-col gap-2 bg-surface-1 p-4 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-foreground">{a.name}</div>
                    <div className="text-[10.5px] text-muted-foreground">{a.sector}</div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Implied EV</div>
                    <div className="text-[16px] font-semibold text-foreground num">{fmtCurrency(a.impliedEv)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatPill tone={statusTone(a.status)}>{a.status}</StatPill>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(a.updated)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
