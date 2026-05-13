export function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 rounded border border-border bg-surface-1 px-2.5 py-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        Live Market Research
      </span>
    </div>
  );
}
