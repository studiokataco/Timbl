"use client"

import { cn } from "@/lib/utils"
import type { ChannelKey, Post } from "@/lib/schemas"

type NetworkMeta = { label: string; color: string; limit: number; aspectRatio?: string }

const NETWORK_CONFIG: Record<ChannelKey, NetworkMeta> = {
  linkedin: { label: "LinkedIn", color: "#0077B5", limit: 3000, aspectRatio: "1:1 or 1.91:1" },
  instagram: { label: "Instagram", color: "#E1306C", limit: 2200, aspectRatio: "1:1, 4:5, or 9:16" },
  facebook: { label: "Facebook", color: "#1877F2", limit: 63206, aspectRatio: "1.91:1 or 1:1" },
  x: { label: "X", color: "#000000", limit: 280, aspectRatio: "16:9 or 1:1" },
  website: { label: "Website", color: "#6b7280", limit: 0 },
  fb_groups: { label: "FB Groups", color: "#1877F2", limit: 63206 },
}

const FIRST_COMMENT_NETWORKS: ChannelKey[] = ["linkedin", "instagram", "facebook", "fb_groups"]

type Props = {
  post: Pick<Post, "brief" | "blurb" | "firstComment" | "isAiGenerated">
  channels: ChannelKey[]
}

export function NetworkPreview({ post, channels }: Props) {
  if (channels.length === 0) {
    return <p className="text-sm text-muted-foreground">No channels selected.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {channels.map((ch) => {
        const config = NETWORK_CONFIG[ch]
        if (!config) return null

        const body = post.blurb ?? post.brief ?? ""
        const charCount = body.length
        const hasLimit = config.limit > 0
        const over = hasLimit && charCount > config.limit
        const pct = hasLimit ? Math.min(charCount / config.limit, 1) : 0
        const preview = body.length > 300 ? body.slice(0, 300) + "..." : body
        const showFirstComment = post.firstComment && FIRST_COMMENT_NETWORKS.includes(ch)

        return (
          <div
            key={ch}
            className={cn(
              "rounded-xl border p-4 flex flex-col gap-2.5",
              over ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30",
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: config.color }}
                >
                  {config.label}
                </span>
                {post.isAiGenerated && (
                  <span className="inline-flex items-center rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                    AI
                  </span>
                )}
              </div>
              <span className={cn("text-[11px] tabular-nums", over ? "text-destructive font-medium" : "text-muted-foreground")}>
                {charCount.toLocaleString()}
                {hasLimit ? `/${config.limit.toLocaleString()}` : ""} chars
              </span>
            </div>

            {/* Character bar */}
            {hasLimit && (
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    over ? "bg-destructive" : pct > 0.85 ? "bg-amber-500" : "bg-foreground/30",
                  )}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            )}

            {/* Preview text */}
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {preview || <span className="text-muted-foreground italic">No caption yet</span>}
            </p>

            {/* Aspect ratio hint */}
            {config.aspectRatio && (
              <p className="text-[11px] text-muted-foreground">
                Recommended ratio: {config.aspectRatio}
              </p>
            )}

            {/* First comment */}
            {showFirstComment && (
              <div className="border-t pt-2 mt-0.5">
                <p className="text-[11px] text-muted-foreground mb-1">First comment</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {post.firstComment}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
