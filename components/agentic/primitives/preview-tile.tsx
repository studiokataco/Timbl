"use client"

import { CHANNEL_LABELS } from "@/lib/labels/enums"
import { usePrototype } from "../prototype-context"
import type { ChannelKey, PreviewTileSpec } from "../types"
import { ChannelMark } from "./channel-mark"

const FORMAT_CHANNEL = (Object.entries(CHANNEL_LABELS) as [ChannelKey, string][])
  .sort((a, b) => b[1].length - a[1].length)

function splitFormat(format: string): { channel: ChannelKey | null; rest: string } {
  for (const [channel, label] of FORMAT_CHANNEL) {
    if (format === label) return { channel, rest: "" }
    if (format.startsWith(`${label} · `)) return { channel, rest: format.slice(label.length + 3) }
  }
  return { channel: null, rest: format }
}

type PreviewTileProps = { tile: PreviewTileSpec; size?: "sm" | "md" | "lg"; alt: string }

export function PreviewTile({ tile, size = "md", alt }: PreviewTileProps): React.JSX.Element {
  const { copy } = usePrototype()
  const format = splitFormat(tile.format)
  return (
    <div
      role="img"
      aria-label={alt}
      data-slot="agentic-preview-tile"
      data-state={size}
      data-figma="PreviewTile/root"
      className="@container/tile relative aspect-4/5 w-full min-w-0 overflow-hidden rounded-xl bg-badge-orange/15 text-foreground ring-1 ring-badge-orange/30 dark:bg-badge-violet/15 dark:ring-badge-violet/30"
    >
      <div className="flex h-full min-h-0 flex-col justify-between p-[0.7em] text-[clamp(11px,7.4cqw,16px)] leading-none">
      <div className="relative z-10 flex w-full items-center justify-between gap-[0.4em] border-b border-foreground/10 pb-[0.5em]">
        <span className="inline-flex min-w-0 items-center gap-[0.4em] text-[0.82em] font-medium leading-none text-foreground">
          <span aria-hidden="true" className="grid size-[1.25em] shrink-0 grid-cols-3 gap-px rounded-xs bg-surface-dark p-px">
            <span className="rounded-xs bg-badge-emerald" />
            <span className="rounded-xs bg-surface-dark" />
            <span className="rounded-xs bg-badge-orange" />
            <span className="rounded-xs bg-surface-dark" />
            <span className="rounded-xs bg-badge-violet" />
            <span className="rounded-xs bg-surface-dark" />
          </span>
          <span className="truncate">{copy.iface.sidebar.workspace}</span>
        </span>
        <span className="shrink-0 rounded-full bg-background/90 px-[0.5em] py-[0.15em] font-mono text-[0.7em] leading-none text-foreground">
          01 / 03
        </span>
      </div>

      <div className="relative z-10 my-auto flex min-h-0 flex-col items-start gap-[0.4em] py-[0.4em] text-left">
        <span className="inline-flex items-center gap-[0.35em] rounded-full bg-background/90 px-[0.55em] py-[0.18em] text-[0.75em] font-medium leading-none text-foreground">
          <span aria-hidden="true" className="size-[0.45em] rounded-full bg-badge-orange" />
          <span>Campaign</span>
        </span>
        <span
          data-figma="PreviewTile/headline"
          className="line-clamp-3 text-balance text-[1.22em] font-medium leading-snug text-foreground"
        >
          {tile.headline}
        </span>
      </div>

      <div className="relative z-10 flex w-full items-end justify-between gap-[0.45em] border-t border-foreground/10 pt-[0.5em]">
        <span data-figma="PreviewTile/format" className="inline-flex min-w-0 items-center gap-[0.35em] text-[0.86em] font-medium leading-tight text-foreground/80">
          {format.channel ? <ChannelMark channel={format.channel} className="size-3.5" /> : null}
          {format.rest ? <span className="min-w-0">{format.rest}</span> : null}
        </span>
      </div>
      </div>
    </div>
  )
}
