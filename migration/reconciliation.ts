import { compareTwoStrings } from "string-similarity"

/*
 * Reconciliation rules for the legacy 9-tab planner spreadsheet → Firestore
 * migration. These are deliberately data, not code - keep them shallow and
 * readable so re-runs after CSV cleanup are predictable.
 *
 * The canonical staff list reflects who actually appears in the spreadsheet's
 * Lead / Assignee / Blurb-author columns. Names sit here (not in seeds) so
 * the migrator can fuzzy-match misspellings without coupling to test data.
 */

export const CANONICAL_STAFF = [
  "Ange",
  "Caz",
  "Hannah",
  "Phil",
  "Rhi",
  "Sophie",
  "Tacha",
  "Carwyn",
  "Anna",
  "Riti",
  "Katie",
  "Ty",
  "Chloe",
  "Rosie",
  "Derek",
] as const

export type CanonicalStaff = (typeof CANONICAL_STAFF)[number]

/** Fuzzy-match threshold from the plan. ≥0.85 auto-applied. */
export const STAFF_MATCH_THRESHOLD = 0.85

export type StaffMatchResult =
  | { kind: "exact"; canonical: CanonicalStaff }
  | { kind: "fuzzy"; canonical: CanonicalStaff; score: number }
  | { kind: "ambiguous"; raw: string; bestScore: number }
  | { kind: "empty" }

/*
 * Match a raw cell value to a canonical staff name. Strips junk (whitespace,
 * brackets, slashes) before comparing. Returns kind:"empty" for blanks so the
 * caller can decide between "leave field blank" and "flag for review".
 */
export function matchStaff(raw: string | undefined | null): StaffMatchResult {
  if (!raw) return { kind: "empty" }
  const cleaned = raw
    .trim()
    .replace(/[()/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return { kind: "empty" }

  // Exact match (case-insensitive) → quick path
  for (const name of CANONICAL_STAFF) {
    if (cleaned.toLowerCase() === name.toLowerCase()) {
      return { kind: "exact", canonical: name }
    }
  }

  // Otherwise score against every canonical and take the best.
  let best: { name: CanonicalStaff; score: number } | null = null
  for (const name of CANONICAL_STAFF) {
    const score = compareTwoStrings(cleaned.toLowerCase(), name.toLowerCase())
    if (!best || score > best.score) best = { name, score }
  }
  if (best && best.score >= STAFF_MATCH_THRESHOLD) {
    return { kind: "fuzzy", canonical: best.name, score: best.score }
  }
  return { kind: "ambiguous", raw: cleaned, bestScore: best?.score ?? 0 }
}

/** Convert a canonical name to the user doc id used in /organizations/safe-foundation/users. */
export function staffSlug(name: CanonicalStaff): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

/*
 * CSV "Catagory" (sic) → category slug. Slugs match the seeded category
 * collection; unmapped values land in `general` and the row is flagged in
 * the migration report.
 */
export const CATEGORY_MAP: Record<string, string> = {
  "ethical boutique - pick of week": "ethical-boutique-pick",
  "ethical boutique pick of week": "ethical-boutique-pick",
  "pick of the week": "ethical-boutique-pick",
  "ethical boutique - general": "ethical-boutique-general",
  "ethical boutique general": "ethical-boutique-general",
  "ethical boutique": "ethical-boutique-general",
  "meet the team": "meet-the-team",
  "international day": "international-day",
  "international / awareness day": "international-day",
  "awareness day": "international-day",
  "fundraising": "fundraising-appeal",
  "fundraising appeal": "fundraising-appeal",
  "what's on": "events-whats-on",
  "whats on": "events-whats-on",
  "events": "events-whats-on",
  "did you know": "did-you-know",
  "did you know - gc facts": "did-you-know",
  "gc facts": "did-you-know",
  "volunteer": "volunteer-activity",
  "volunteer activity": "volunteer-activity",
  "20 years of safe": "anniversary-20-years",
  "20 years": "anniversary-20-years",
  "anniversary": "anniversary-20-years",
  "campaign": "campaign-update",
  "campaign update": "campaign-update",
  "mental health": "mental-health",
  "staff roles": "staff-roles",
  "recruitment": "staff-roles",
  "social media guide": "social-media-guide",
  "voice": "social-media-guide",
  "general": "general",
  "": "general",
}

export function mapCategory(raw: string | undefined | null): {
  slug: string
  matched: boolean
} {
  const key = (raw ?? "").trim().toLowerCase()
  const slug = CATEGORY_MAP[key]
  return slug ? { slug, matched: true } : { slug: "general", matched: false }
}

/*
 * CSV CTA strings (whitespace-noisy in the wild) → CTA slug. Order matters:
 * we strip whitespace first, then look up.
 */
const CTA_MAP: Record<string, string> = {
  "attend an event": "attend-an-event",
  "donate": "donate",
  "like": "like",
  "learn change behaviour": "learn-change-behaviour",
  "learn / change behaviour": "learn-change-behaviour",
  "learn": "learn-change-behaviour",
  "visit shop": "visit-shop",
  "volunteer": "volunteer",
  "share": "share",
  "comment": "comment",
  "save": "save",
}

export function mapCta(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  const key = raw.replace(/\s+/g, " ").trim().toLowerCase()
  if (!key) return undefined
  return CTA_MAP[key]
}

/*
 * Status collapse: the legacy sheet has separate Research and Design status
 * columns. Phase 1's schema collapses these into a single `status`. Rules
 * (per the plan):
 *   - both Posted        → posted
 *   - either Posted      → posted
 *   - either "Working on it" → designing
 *   - either "Ready to Schedule" → scheduled
 *   - "Deadline MISSED"  → missed
 *   - default            → idea
 */
const norm = (s: string | undefined | null) =>
  (s ?? "").replace(/\s+/g, " ").trim().toLowerCase()

export function collapseStatus(
  research: string | undefined | null,
  design: string | undefined | null,
): "idea" | "designing" | "scheduled" | "posted" | "missed" {
  const r = norm(research)
  const d = norm(design)
  const matches = (s: string, needle: string) => s.includes(needle)

  if (r === "posted" && d === "posted") return "posted"
  if (r === "posted" || d === "posted") return "posted"
  if (matches(r, "deadline missed") || matches(d, "deadline missed")) return "missed"
  if (matches(r, "ready to schedule") || matches(d, "ready to schedule"))
    return "scheduled"
  if (matches(r, "working on it") || matches(d, "working on it")) return "designing"
  return "idea"
}

/*
 * Date parser: the spreadsheet uses informal forms - `23-Feb`, `22 Mar`,
 * `1-Apr`, `Feb 23`, `01/04`. Year is supplied externally because tabs
 * cover known periods (2025/2026). Returns `YYYY-MM-DD` or null.
 */
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
}

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

export function parseLooseDate(
  raw: string | undefined | null,
  yearHint: number,
): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[,\s]+/g, " ").trim().toLowerCase()
  if (!cleaned) return null

  // Already ISO? (YYYY-MM-DD)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // Forms like "23-feb", "23 feb", "23/feb"
  const dayMonth = /^(\d{1,2})[\s\-/](\w{3,9})$/.exec(cleaned)
  if (dayMonth) {
    const day = Number(dayMonth[1])
    const m = MONTHS[dayMonth[2].slice(0, 4)] ?? MONTHS[dayMonth[2].slice(0, 3)]
    if (m && day >= 1 && day <= 31) {
      return `${yearHint}-${pad(m)}-${pad(day)}`
    }
  }

  // Forms like "feb 23", "feb-23"
  const monthDay = /^(\w{3,9})[\s\-/](\d{1,2})$/.exec(cleaned)
  if (monthDay) {
    const m = MONTHS[monthDay[1].slice(0, 4)] ?? MONTHS[monthDay[1].slice(0, 3)]
    const day = Number(monthDay[2])
    if (m && day >= 1 && day <= 31) {
      return `${yearHint}-${pad(m)}-${pad(day)}`
    }
  }

  // Numeric DD/MM or DD-MM
  const numeric = /^(\d{1,2})[\s\-/](\d{1,2})$/.exec(cleaned)
  if (numeric) {
    const day = Number(numeric[1])
    const m = Number(numeric[2])
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      return `${yearHint}-${pad(m)}-${pad(day)}`
    }
  }

  return null
}
