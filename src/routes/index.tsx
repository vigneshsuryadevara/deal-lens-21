import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "COMPS Terminal — Precedent Transaction Analysis" },
      { name: "description", content: "Institutional-grade workspace for precedent transactions, comps, valuation ranges, sensitivity, and buyer universe analysis." },
      { property: "og:title", content: "COMPS Terminal" },
      { property: "og:description", content: "Precedent transaction and valuation workspace for investment bankers and private equity teams." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
