/*
 * Single source of truth for enum → user-facing label mappings.
 *
 * Every Select / Badge / table cell that needs to render a stored enum
 * slug ("grid", "ad-hoc", "client-wins") should resolve through these
 * maps so the case + spacing stays consistent across the app and the
 * dropdown trigger never leaks raw slugs.
 *
 * For @base-ui/react Select usage, the render-prop form
 *   <SelectValue>{(v) => labelOr(enumMap, v)}</SelectValue>
 * keeps the trigger in lock-step with the SelectItem children.
 */

import type { AgentProvider } from "@/lib/schemas/agentConfig"
import type {
  ChannelKey,
  ChannelStatus,
  PostType,
} from "@/lib/schemas/_shared"
import type { TemplateCadence } from "@/lib/schemas/template"
import type { AwarenessDay } from "@/lib/schemas/awarenessDay"
import type { CampaignStatus } from "@/lib/schemas/campaign"
import type { ReminderPreferences } from "@/lib/schemas/organisation"

export const POST_TYPE_LABELS: Record<PostType, string> = {
  grid: "Grid",
  carousel: "Carousel",
  reel: "Reel",
  story: "Story",
  video: "Video",
}

export const CADENCE_LABELS: Record<TemplateCadence, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "ad-hoc": "Ad-hoc",
}

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  "n/a": "N/A",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
}

export const AGENT_PROVIDER_LABELS: Record<AgentProvider, string> = {
  gemini: "Gemini",
  anthropic: "Anthropic",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
  mock: "Mock (testing)",
}

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  website: "Website",
  fb_groups: "Facebook groups",
}

export const IMPORTANCE_LABELS: Record<AwarenessDay["importance"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
}

export const REMINDER_FREQUENCY_LABELS: Record<
  ReminderPreferences["frequency"],
  string
> = {
  "per-session": "Each browser session",
  "once-per-day": "Once per day",
}

export const GOES_LIVE_WINDOW_LABELS: Record<
  ReminderPreferences["goesLiveWindow"],
  string
> = {
  today: "Today only",
  "today-and-tomorrow": "Today or tomorrow",
}

/* Generic post-status label - the project carries a free-string `status`
 * field with a `LEGACY_POST_STATUSES` constant for the historical 9-state
 * lifecycle. Slugs like "in-review" come back as "In review" via
 * humanize(); curated overrides win when present. */
const POST_STATUS_OVERRIDES: Record<string, string> = {
  idea: "Idea",
  brief: "Brief",
  researching: "Researching",
  designing: "Designing",
  review: "In review",
  scheduled: "Scheduled",
  posted: "Posted",
  missed: "Missed",
  archived: "Archived",
}

export function postStatusLabel(status: string | null | undefined): string {
  if (!status) return "-"
  return POST_STATUS_OVERRIDES[status] ?? humanize(status)
}

/* Title-case a kebab-or-snake slug. "client-wins" -> "Client wins".
 * Used as the default fallback for any value missing from an override
 * map, and as the one-shot normaliser for category names that landed
 * lowercased before this round (sentence case, first word capitalised). */
export function humanize(slug: string): string {
  const spaced = slug.replace(/[-_]+/g, " ").trim()
  if (!spaced) return slug
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/* Resolve `value` through `map`, falling back to humanize. Suitable as
 * the render-prop body of @base-ui SelectValue. */
export function labelOr<K extends string>(
  map: Record<K, string>,
  value: K | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return ""
  const hit = (map as Record<string, string>)[value]
  return hit ?? humanize(String(value))
}
