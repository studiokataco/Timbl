export function SocialChannelsGate() {
  return (
    <div className="relative select-none">
      <div
        className="pointer-events-none grid gap-3 blur-md saturate-50 sm:grid-cols-2"
        aria-hidden
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/70" />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-sm rounded-xl bg-card/95 p-6 text-center shadow-sm ring-1 ring-foreground/10 backdrop-blur-sm">
          <p className="text-sm font-medium">Social channels are not available yet</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Connecting LinkedIn, X, Facebook, and Instagram is coming soon. Your
            workspace keeps working as usual - we will announce when publishing
            goes live.
          </p>
        </div>
      </div>
    </div>
  )
}
