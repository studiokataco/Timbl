import { cn } from "@/lib/utils"

export function StatusDot({ className, pulse }: { className: string; pulse?: boolean }) {
  return (
    <span aria-hidden className="relative inline-flex size-2 shrink-0">
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping",
            className,
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", className)} />
    </span>
  )
}
