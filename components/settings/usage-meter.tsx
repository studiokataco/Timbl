import { MiniRing, StatCell } from "@/components/shared/stat-grid"
import { cn } from "@/lib/utils"

export type UsageMeterTone = "ok" | "near" | "over" | "unlimited"

export function usageMeterTone(used: number, limit: number | null): UsageMeterTone {
  if (limit === null) return "unlimited"
  if (limit <= 0) return used > 0 ? "over" : "ok"
  const ratio = used / limit
  if (ratio >= 1) return "over"
  if (ratio >= 0.8) return "near"
  return "ok"
}

const RING_TONE: Record<UsageMeterTone, string> = {
  ok: "stroke-foreground",
  near: "stroke-warning",
  over: "stroke-destructive",
  unlimited: "stroke-foreground",
}

const count = (n: number) => n.toLocaleString("en-IN")

export function UsageMeter({
  label,
  used,
  limit,
  className,
}: {
  label: string
  used: number
  limit: number | null
  className?: string
}) {
  const tone = usageMeterTone(used, limit)
  const sub = limit === null ? "No limit" : limit === 0 ? "Not on plan" : `of ${count(limit)}`

  return (
    <div className={cn("grid", className)}>
      <StatCell
        label={label}
        value={count(used)}
        sub={<span className={cn(tone === "over" && "text-destructive")}>{sub}</span>}
        visual={
          limit ? (
            <MiniRing
              value={used / limit}
              tone={RING_TONE[tone]}
              label={`${label}: ${count(used)} of ${count(limit)} used`}
            />
          ) : undefined
        }
      />
    </div>
  )
}
