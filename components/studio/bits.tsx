import { createElement } from "react"
import { format, parseISO } from "date-fns"

import { cn } from "@/lib/utils"
import { agentIcon } from "./agent-meta"

export { StatusDot } from "@/components/shared/status-dot"

export function AgentGlyph({
  name,
  size = "md",
  muted,
}: {
  name: string
  size?: "sm" | "md" | "lg"
  muted?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg border border-border",
        muted ? "bg-transparent text-muted-foreground" : "bg-secondary text-foreground",
        size === "sm" && "size-7 [&>svg]:size-3.5",
        size === "md" && "size-9 [&>svg]:size-4",
        size === "lg" && "size-12 rounded-xl [&>svg]:size-5",
      )}
    >
      {createElement(agentIcon(name), { strokeWidth: 1.75 })}
    </span>
  )
}

export function ago(iso: string | undefined | null): string {
  if (!iso) return ""
  try {
    const d = parseISO(iso)
    const mins = Math.round((Date.now() - d.getTime()) / 60_000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 7) return `${days}d ago`
    return format(d, "d MMM")
  } catch {
    return ""
  }
}
