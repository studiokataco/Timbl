"use client"

import type { ChannelKey, Post } from "@/lib/schemas"

const NETWORK_CONFIG: Record<ChannelKey, { label: string; color: string; limit: number }> = {
  linkedin: { label: "LinkedIn", color: "#0077B5", limit: 3000 },
  instagram: { label: "Instagram", color: "#E1306C", limit: 2200 },
  facebook: { label: "Facebook", color: "#1877F2", limit: 63206 },
  x: { label: "X", color: "#000000", limit: 280 },
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
    return (
      <p className="text-sm text-[#6b7280]">No channels selected.</p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {channels.map((ch) => {
        const config = NETWORK_CONFIG[ch]
        if (!config) return null

        const body = post.blurb ?? post.brief ?? ""
        const preview = body.length > 280 ? body.slice(0, 280) + "..." : body
        const charCount = body.length
        const showFirstComment = post.firstComment && FIRST_COMMENT_NETWORKS.includes(ch)

        return (
          <div
            key={ch}
            className="rounded-xl bg-[#f5f5f5] border border-[#e5e7eb] p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: config.color }}
                >
                  {config.label}
                </span>
                {post.isAiGenerated && (
                  <span className="inline-flex items-center rounded-md bg-[#8b5cf6]/10 px-2 py-0.5 text-[11px] font-semibold text-[#8b5cf6]">
                    AI
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#6b7280] tabular-nums">
                {charCount}
                {config.limit > 0 ? `/${config.limit}` : ""} chars
              </span>
            </div>

            <p className="text-sm text-[#374151] whitespace-pre-wrap leading-relaxed">
              {preview || <span className="text-[#6b7280] italic">No caption yet</span>}
            </p>

            {showFirstComment && (
              <div className="border-t border-[#e5e7eb] pt-2 mt-1">
                <p className="text-[11px] text-[#6b7280] mb-1">First comment</p>
                <p className="text-sm text-[#374151] whitespace-pre-wrap leading-relaxed">
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
