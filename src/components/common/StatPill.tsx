import { cn } from "@/lib/utils";

export function StatPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "positive" | "negative" | "warning";
  children: React.ReactNode;
  className?: string;
}) {
  const toneCls = {
    neutral: "bg-muted text-muted-foreground border-border",
    positive: "bg-positive/10 text-positive border-positive/30",
    negative: "bg-destructive/10 text-destructive border-destructive/30",
    warning: "bg-warning/10 text-warning border-warning/30",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide num",
        toneCls,
        className,
      )}
    >
      {children}
    </span>
  );
}
