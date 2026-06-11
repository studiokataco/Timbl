export function BillingPageGate() {
  return (
    <div className="relative select-none">
      <div
        className="pointer-events-none space-y-6 blur-md saturate-50"
        aria-hidden
      >
        <div className="h-24 rounded-xl bg-muted/80" />
        <div className="h-16 rounded-xl bg-muted/60" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-muted/70" />
          ))}
        </div>
        <div className="h-4 w-2/3 rounded bg-muted/50" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-sm rounded-xl bg-card/95 p-6 text-center shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm">
          <p className="text-sm font-medium">Billing is not available yet</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Plan changes and checkout are coming soon. Your workspace keeps
            working as usual - we will announce when billing goes live.
          </p>
        </div>
      </div>
    </div>
  )
}
