"use client"

import { format, parseISO } from "date-fns"
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
} from "lucide-react"

import type { PublishStatusProjection } from "@/lib/actions/posts"
import { cn } from "@/lib/utils"

/*
 * Publish-state chip rendered inside Studio run cards and the run-timeline
 * outputs section. Visual palette is keyed off the seeded post-status
 * taxonomy (idea | brief | researching | designing | review | scheduled |
 * posted | missed | archived) - see `firestore/seeds/0006_kanban_columns.ts`
 * for the source of truth.
 *
 * Variants:
 *   draft-ish (idea/brief/researching/designing/review) → muted hairline
 *   scheduled                                            → emerald-faint fill
 *   posted                                               → solid emerald fill
 *   missed                                               → rose-faint fill
 *   archived / unknown                                   → muted hairline
 *
 * Each chip is a Cal.com `badge-pill`: rounded-pill, `caption` typography
 * (12px / Inter 500), 4×10 padding, `tabular-nums` on dates.
 */

type Props = {
  post: PublishStatusProjection | undefined
  /** Falls back to this id when `post` is undefined (loading / missing). */
  fallbackId: string
}

const BASE_CHIP =
  "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11px] font-medium tabular-nums transition-colors"

export function PublishChip({ post, fallbackId }: Props) {
  if (!post) {
    return (
      <a
        href={`/calendar?postId=${fallbackId}`}
        className={cn(
          BASE_CHIP,
          "border border-border bg-background text-muted-foreground hover:bg-secondary/60",
        )}
        title={fallbackId}
      >
        <CircleDashed className="size-3" aria-hidden />
        <span className="font-mono">{fallbackId.slice(0, 6)}</span>
      </a>
    )
  }

  const href = `/calendar?postId=${post.id}`
  const status = post.status

  if (status === "scheduled") {
    return (
      <a
        href={href}
        className={cn(
          BASE_CHIP,
          "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200",
        )}
        title={post.brief ?? post.id}
      >
        <CalendarClock className="size-3" aria-hidden />
        <span>Scheduled{post.scheduledDate ? ` · ${fmtDate(post.scheduledDate)}` : ""}</span>
      </a>
    )
  }

  if (status === "posted") {
    return (
      <a
        href={href}
        className={cn(
          BASE_CHIP,
          "bg-emerald-500 text-white hover:bg-emerald-600",
        )}
        title={post.brief ?? post.id}
      >
        <CheckCircle2 className="size-3" aria-hidden />
        <span>Posted{platformSuffix(post.channelStatuses)}</span>
      </a>
    )
  }

  if (status === "missed") {
    return (
      <a
        href={href}
        className={cn(
          BASE_CHIP,
          "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200",
        )}
        title={post.brief ?? post.id}
      >
        <AlertCircle className="size-3" aria-hidden />
        <span>Missed</span>
      </a>
    )
  }

  // draft-ish bucket - idea, brief, researching, designing, review, archived,
  // and anything unrecognised.
  const label = capitalise(status) || "Draft"
  return (
    <a
      href={href}
      className={cn(
        BASE_CHIP,
        "border border-border bg-background text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
      title={post.brief ?? post.id}
    >
      <FileText className="size-3" aria-hidden />
      <span>{label}</span>
      <ExternalLink className="size-2.5 opacity-60" aria-hidden />
    </a>
  )
}

function platformSuffix(channelStatuses: Record<string, unknown> | undefined): string {
  if (!channelStatuses) return ""
  const platforms: string[] = []
  for (const [key, val] of Object.entries(channelStatuses)) {
    // Treat a channel as "published" if its status string is `posted` or the
    // value is a non-empty array (fb_groups cross-post list).
    if (typeof val === "string" && (val === "posted" || val === "published")) {
      platforms.push(key)
    } else if (Array.isArray(val) && val.length > 0) {
      platforms.push(key)
    }
  }
  if (platforms.length === 0) return ""
  if (platforms.length === 1) return ` · ${capitalise(platforms[0])}`
  return ` · ${platforms.length} channels`
}

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d")
  } catch {
    return iso
  }
}

function capitalise(s: string): string {
  if (!s) return ""
  return s[0].toUpperCase() + s.slice(1)
}
