"use client"

import type { AwarenessRange } from "@/lib/calendar/awareness-grouping"
import { cn } from "@/lib/utils"
import { lightenForBg } from "./color"

const IMPORTANCE_COLOR: Record<AwarenessRange["importance"], string> = {
  high: "#fb923c", // orange-400
  medium: "#a855f7", // purple-500
  low: "#94a3b8", // slate-400
}

type Props = {
  range: AwarenessRange
  startCol: number
  endCol: number
  /** Whether this segment continues beyond the current week to the right. */
  continuesRight: boolean
  /** Whether this segment continues from a previous week to the left. */
  continuesLeft: boolean
}

/*
 * Multi-day awareness bar spanning N cells in a week row. Rendered via CSS
 * grid-column-start/end so the bar follows the cell widths exactly.
 */
export function EventBar({
  range,
  startCol,
  endCol,
  continuesRight,
  continuesLeft,
}: Props) {
  const baseColor = IMPORTANCE_COLOR[range.importance]
  const bg = lightenForBg(baseColor)

  return (
    <div
      style={{
        gridColumn: `${startCol + 1} / ${endCol + 2}`,
        backgroundColor: bg,
        borderLeft: continuesLeft ? "none" : `2px solid ${baseColor}`,
      }}
      className={cn(
        "px-2 py-0.5 text-[11px] leading-tight font-medium truncate min-w-0",
        continuesLeft ? "rounded-l-none" : "rounded-l-sm",
        continuesRight ? "rounded-r-none" : "rounded-r-sm",
      )}
      title={`${range.name} (${range.importance})`}
    >
      {range.name}
    </div>
  )
}
