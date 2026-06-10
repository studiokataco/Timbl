import { Sparkles } from "lucide-react"

export function AiTestingBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border bg-secondary text-muted-foreground text-xs px-4 py-1.5 flex items-center justify-center gap-2"
    >
      <Sparkles className="size-3.5 shrink-0 opacity-70" aria-hidden />
      <span>
        AI features are in testing - kindly expect breakage or glitches
      </span>
    </div>
  )
}
