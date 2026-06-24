import "server-only"
import { addDays, differenceInDays, format, parseISO, subDays } from "date-fns"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import {
  orgCampaignsPath,
  orgCategoriesPath,
  orgPostsPath,
  orgTemplatesPath,
} from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { Campaign, Category, Template } from "@/lib/schemas"

/*
 * Page-level suggestion computer. Runs server-side per /calendar render so
 * we don't need a separate suggestions collection or background job. Returns
 * three buckets: silent categories (no post in 14 days), cadence-due
 * templates (last use older than the cadence's interval), and campaigns
 * ending within 14 days.
 *
 * The output is intentionally small (max ~3 per bucket) so the rail stays
 * scannable, not exhaustive.
 */

export type Suggestion =
  | { kind: "silent-category"; categoryId: string; name: string; daysSilent: number; neverUsed: boolean }
  | { kind: "template-due"; templateId: string; name: string; daysSinceLast: number; cadence: Template["cadence"]; neverUsed: boolean }
  | { kind: "campaign-ending"; campaignId: string; name: string; endDate: string; daysAway: number }

const CADENCE_DAYS: Record<Template["cadence"], number | null> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  "ad-hoc": null,
}

const SILENT_CATEGORY_THRESHOLD_DAYS = 14
const CAMPAIGN_HORIZON_DAYS = 14

export async function fetchSuggestions(): Promise<Suggestion[]> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const today = new Date()
  const todayIso = format(today, "yyyy-MM-dd")
  const horizonIso = format(addDays(today, CAMPAIGN_HORIZON_DAYS), "yyyy-MM-dd")
  const lookbackIso = format(subDays(today, 90), "yyyy-MM-dd")

  const [catSnap, tmplSnap, campSnap, recentPostsSnap] = await Promise.all([
    db
      .collection(orgCategoriesPath(orgId))
      .where("isActive", "==", true)
      .get(),
    db.collection(orgTemplatesPath(orgId)).get(),
    db.collection(orgCampaignsPath(orgId)).get(),
    db
      .collection(orgPostsPath(orgId))
      .where("scheduledDate", ">=", lookbackIso)
      .where("scheduledDate", "<=", todayIso)
      .select("categoryId", "templateId", "scheduledDate")
      .get(),
  ])

  const categories: WithId<Category>[] = catSnap.docs.map((d) =>
    snapToData<Category>(d),
  )
  const templates: WithId<Template>[] = tmplSnap.docs.map((d) =>
    snapToData<Template>(d),
  )
  const campaigns: WithId<Campaign>[] = campSnap.docs.map((d) =>
    snapToData<Campaign>(d),
  )

  // Walk recent posts once; record latest scheduledDate per category and
  // per template.
  const lastByCategory = new Map<string, string>()
  const lastByTemplate = new Map<string, string>()
  for (const d of recentPostsSnap.docs) {
    const cat = d.get("categoryId") as string | undefined
    const tmpl = d.get("templateId") as string | undefined
    const dt = d.get("scheduledDate") as string | undefined
    if (!dt) continue
    if (cat) {
      const prev = lastByCategory.get(cat)
      if (!prev || dt > prev) lastByCategory.set(cat, dt)
    }
    if (tmpl) {
      const prev = lastByTemplate.get(tmpl)
      if (!prev || dt > prev) lastByTemplate.set(tmpl, dt)
    }
  }

  const suggestions: Suggestion[] = []

  // Silent categories: any active category with no post in the last 14 days.
  for (const cat of categories) {
    const last = lastByCategory.get(cat.id)
    const daysSilent = last
      ? differenceInDays(today, parseISO(last))
      : Infinity
    if (daysSilent >= SILENT_CATEGORY_THRESHOLD_DAYS) {
      suggestions.push({
        kind: "silent-category",
        categoryId: cat.id,
        name: cat.name,
        daysSilent: Number.isFinite(daysSilent) ? daysSilent : 0,
        neverUsed: !last,
      })
    }
  }
  suggestions.sort((a, b) => {
    if (a.kind === "silent-category" && b.kind === "silent-category") {
      return b.daysSilent - a.daysSilent
    }
    return 0
  })
  const silent = suggestions.slice(0, 3)

  // Cadence-due templates.
  const templateDue: Suggestion[] = []
  for (const t of templates) {
    const interval = CADENCE_DAYS[t.cadence]
    if (interval == null) continue
    const last = lastByTemplate.get(t.id)
    const daysSinceLast = last ? differenceInDays(today, parseISO(last)) : 0
    if (!last || daysSinceLast >= interval) {
      templateDue.push({
        kind: "template-due",
        templateId: t.id,
        name: t.name,
        daysSinceLast,
        cadence: t.cadence,
        neverUsed: !last,
      })
    }
  }
  templateDue.sort((a, b) => {
    if (a.kind !== "template-due" || b.kind !== "template-due") return 0
    if (a.neverUsed !== b.neverUsed) return a.neverUsed ? -1 : 1
    return b.daysSinceLast - a.daysSinceLast
  })

  // Campaigns ending within 14 days.
  const campaignEnding: Suggestion[] = []
  for (const c of campaigns) {
    if (c.status !== "active" || !c.endDate) continue
    if (c.endDate < todayIso || c.endDate > horizonIso) continue
    campaignEnding.push({
      kind: "campaign-ending",
      campaignId: c.id,
      name: c.name,
      endDate: c.endDate,
      daysAway: differenceInDays(parseISO(c.endDate), today),
    })
  }
  campaignEnding.sort((a, b) =>
    a.kind === "campaign-ending" && b.kind === "campaign-ending"
      ? a.daysAway - b.daysAway
      : 0,
  )

  return [...silent, ...templateDue.slice(0, 3), ...campaignEnding.slice(0, 3)]
}
