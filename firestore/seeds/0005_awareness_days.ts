import { db, ensureEmulator, withAudit } from "./_helpers"
import { awarenessDaysPath } from "@/lib/firebase/paths"

/*
 * Seeds the global /awarenessDays collection. Doc ids are `{slug}-{year}` so
 * an annual day in 2026 and 2027 are distinct rows; the calendar rail filters
 * by date range.
 *
 * Coverage: 36 awareness days spanning 2026 — a mix of high-importance UN /
 * national observances, weeks-long campaigns expressed as their start day,
 * and culturally relevant moments for SAFE's audience (mental health,
 * sustainability, charity sector).
 *
 * `suggestedCategorySlug` lets the Promote-to-post action pre-populate the
 * right category; falls back to "international-day" if a closer fit doesn't
 * exist.
 */

type AwarenessSeed = {
  slug: string
  date: string // YYYY-MM-DD (2026)
  name: string
  description?: string
  importance: "low" | "medium" | "high"
  suggestedCategorySlug?: string
  sourceUrl?: string
}

const DAYS_2026: AwarenessSeed[] = [
  {
    slug: "world-cancer-day",
    date: "2026-02-04",
    name: "World Cancer Day",
    importance: "high",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "safer-internet-day",
    date: "2026-02-10",
    name: "Safer Internet Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "valentines-day",
    date: "2026-02-14",
    name: "Valentine's Day",
    importance: "low",
    suggestedCategorySlug: "general",
  },
  {
    slug: "international-womens-day",
    date: "2026-03-08",
    name: "International Women's Day",
    importance: "high",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "world-water-day",
    date: "2026-03-22",
    name: "World Water Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "earth-hour",
    date: "2026-03-28",
    name: "Earth Hour",
    importance: "medium",
    suggestedCategorySlug: "did-you-know",
  },
  {
    slug: "world-autism-awareness-day",
    date: "2026-04-02",
    name: "World Autism Awareness Day",
    importance: "high",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "world-health-day",
    date: "2026-04-07",
    name: "World Health Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "earth-day",
    date: "2026-04-22",
    name: "Earth Day",
    importance: "high",
    suggestedCategorySlug: "did-you-know",
  },
  {
    slug: "stress-awareness-month-uk-start",
    date: "2026-04-01",
    name: "Stress Awareness Month begins (UK)",
    description: "Month-long observance — plan a series.",
    importance: "high",
    suggestedCategorySlug: "mental-health",
  },
  {
    slug: "mental-health-awareness-week-uk-start",
    date: "2026-05-11",
    name: "Mental Health Awareness Week begins (UK)",
    description: "Week-long campaign — Mind Foundation.",
    importance: "high",
    suggestedCategorySlug: "mental-health",
  },
  {
    slug: "world-environment-day",
    date: "2026-06-05",
    name: "World Environment Day",
    importance: "high",
    suggestedCategorySlug: "did-you-know",
  },
  {
    slug: "world-oceans-day",
    date: "2026-06-08",
    name: "World Oceans Day",
    importance: "medium",
    suggestedCategorySlug: "did-you-know",
  },
  {
    slug: "volunteers-week-uk-start",
    date: "2026-06-01",
    name: "Volunteers' Week begins (UK)",
    importance: "high",
    suggestedCategorySlug: "volunteer-activity",
  },
  {
    slug: "world-refugee-day",
    date: "2026-06-20",
    name: "World Refugee Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "international-day-of-friendship",
    date: "2026-07-30",
    name: "International Day of Friendship",
    importance: "low",
    suggestedCategorySlug: "general",
  },
  {
    slug: "international-youth-day",
    date: "2026-08-12",
    name: "International Youth Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "world-suicide-prevention-day",
    date: "2026-09-10",
    name: "World Suicide Prevention Day",
    importance: "high",
    suggestedCategorySlug: "mental-health",
  },
  {
    slug: "international-day-of-charity",
    date: "2026-09-05",
    name: "International Day of Charity",
    importance: "high",
    suggestedCategorySlug: "fundraising-appeal",
  },
  {
    slug: "world-mental-health-day",
    date: "2026-10-10",
    name: "World Mental Health Day",
    importance: "high",
    suggestedCategorySlug: "mental-health",
  },
  {
    slug: "international-day-of-the-girl",
    date: "2026-10-11",
    name: "International Day of the Girl",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "world-food-day",
    date: "2026-10-16",
    name: "World Food Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "anti-slavery-day-uk",
    date: "2026-10-18",
    name: "Anti-Slavery Day (UK)",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "world-kindness-day",
    date: "2026-11-13",
    name: "World Kindness Day",
    importance: "medium",
    suggestedCategorySlug: "general",
  },
  {
    slug: "international-mens-day",
    date: "2026-11-19",
    name: "International Men's Day",
    importance: "medium",
    suggestedCategorySlug: "mental-health",
  },
  {
    slug: "transgender-day-of-remembrance",
    date: "2026-11-20",
    name: "Transgender Day of Remembrance",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "trustees-week-uk-start",
    date: "2026-11-02",
    name: "Trustees' Week begins (UK)",
    importance: "medium",
    suggestedCategorySlug: "staff-roles",
  },
  {
    slug: "world-diabetes-day",
    date: "2026-11-14",
    name: "World Diabetes Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "small-business-saturday-uk",
    date: "2026-12-05",
    name: "Small Business Saturday (UK)",
    importance: "medium",
    suggestedCategorySlug: "ethical-boutique-general",
  },
  {
    slug: "human-rights-day",
    date: "2026-12-10",
    name: "Human Rights Day",
    importance: "medium",
    suggestedCategorySlug: "international-day",
  },
  {
    slug: "international-volunteer-day",
    date: "2026-12-05",
    name: "International Volunteer Day",
    importance: "high",
    suggestedCategorySlug: "volunteer-activity",
  },
  {
    slug: "winter-solstice",
    date: "2026-12-21",
    name: "Winter Solstice",
    importance: "low",
    suggestedCategorySlug: "general",
  },
  {
    slug: "christmas-day",
    date: "2026-12-25",
    name: "Christmas Day",
    importance: "high",
    suggestedCategorySlug: "general",
  },
  {
    slug: "boxing-day",
    date: "2026-12-26",
    name: "Boxing Day",
    importance: "low",
    suggestedCategorySlug: "general",
  },
  {
    slug: "new-years-eve",
    date: "2026-12-31",
    name: "New Year's Eve",
    importance: "medium",
    suggestedCategorySlug: "general",
  },
  {
    slug: "blue-monday",
    date: "2026-01-19",
    name: "Blue Monday",
    description: "Often cited as the most depressing day — counter-program with mental health support.",
    importance: "medium",
    suggestedCategorySlug: "mental-health",
  },
]

export async function seed0005AwarenessDays() {
  ensureEmulator()
  const col = awarenessDaysPath
  for (const d of DAYS_2026) {
    const year = d.date.slice(0, 4)
    const id = `${d.slug}-${year}`
    await db()
      .doc(`${col}/${id}`)
      .set(
        withAudit({
          id,
          date: d.date,
          name: d.name,
          description: d.description,
          importance: d.importance,
          recurringPattern: "annual",
          suggestedCategorySlug: d.suggestedCategorySlug,
          sourceUrl: d.sourceUrl,
        }),
        { merge: true },
      )
  }
  console.log(`✓ awareness days: ${DAYS_2026.length}`)
}

if (require.main === module) {
  seed0005AwarenessDays().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
