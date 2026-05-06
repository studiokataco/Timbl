import { db, ensureEmulator, SAFE_ORG_ID, withAudit } from "./_helpers"

/*
 * Seeds 9 CTAs and 14 post categories for SAFE Foundation. Colours come from
 * the Airtable signature palette (DESIGN.md). Default hashtag bundles are
 * pulled from patterns observed in the legacy spreadsheet (PRD analysis).
 */

const CTAS: Array<{ slug: string; label: string; description?: string }> = [
  { slug: "attend-an-event", label: "Attend an event" },
  { slug: "donate", label: "Donate" },
  { slug: "like", label: "Like" },
  {
    slug: "learn-change-behaviour",
    label: "Learn / change behaviour",
    description: "Educational call to action — invite the audience to read, watch, or change a habit.",
  },
  { slug: "visit-shop", label: "Visit shop" },
  { slug: "volunteer", label: "Volunteer" },
  { slug: "share", label: "Share" },
  { slug: "comment", label: "Comment" },
  { slug: "save", label: "Save" },
]

type CategorySeed = {
  slug: string
  name: string
  color: string
  icon: string
  description?: string
  defaultPostType?: "grid" | "carousel" | "reel" | "story" | "video"
  defaultHashtags?: string[]
  defaultCtaSlug?: string
  displayOrder: number
}

// Colour assignments cycle through the DESIGN.md badge-pastel palette
// (Cal.com voice — orange / pink / violet / emerald + a small extended set
// for visual distinction on the calendar grid).
const SIG = {
  coral: "#fb923c",   // badge-orange
  forest: "#10b981",  // success
  cream: "#fde68a",   // amber-200, an extra warm pastel
  peach: "#fbcfe8",   // pink-200, an extra soft pastel
  mint: "#34d399",    // badge-emerald
  yellow: "#f59e0b",  // warning
  mustard: "#ec4899", // badge-pink
  navy: "#8b5cf6",    // badge-violet
}

const CATEGORIES: CategorySeed[] = [
  {
    slug: "ethical-boutique-pick",
    name: "Ethical Boutique – Pick of Week",
    color: SIG.coral,
    icon: "shopping-bag",
    defaultPostType: "grid",
    defaultHashtags: [
      "#SustainableFashion",
      "#CharityShop",
      "#Donate",
      "#CharityRaffle",
      "#EthicalBoutique",
    ],
    defaultCtaSlug: "visit-shop",
    displayOrder: 1,
  },
  {
    slug: "ethical-boutique-general",
    name: "Ethical Boutique – General",
    color: SIG.peach,
    icon: "shirt",
    defaultPostType: "grid",
    defaultHashtags: ["#EthicalBoutique", "#SustainableFashion", "#CharityShop"],
    defaultCtaSlug: "visit-shop",
    displayOrder: 2,
  },
  {
    slug: "meet-the-team",
    name: "Meet the Team",
    color: SIG.forest,
    icon: "users",
    defaultPostType: "reel",
    defaultHashtags: ["#MeetTheTeam", "#SAFEFoundation", "#CharityWork"],
    defaultCtaSlug: "like",
    displayOrder: 3,
  },
  {
    slug: "international-day",
    name: "International / Awareness Day",
    color: SIG.mint,
    icon: "globe",
    defaultPostType: "carousel",
    defaultHashtags: ["#AwarenessDay", "#SAFEFoundation"],
    defaultCtaSlug: "learn-change-behaviour",
    displayOrder: 4,
  },
  {
    slug: "fundraising-appeal",
    name: "Fundraising Appeal",
    color: SIG.yellow,
    icon: "heart-handshake",
    defaultPostType: "grid",
    defaultHashtags: ["#Fundraising", "#Donate", "#SAFEFoundation"],
    defaultCtaSlug: "donate",
    displayOrder: 5,
  },
  {
    slug: "events-whats-on",
    name: "What's On / Events",
    color: SIG.mustard,
    icon: "calendar-days",
    defaultPostType: "carousel",
    defaultHashtags: ["#WhatsOn", "#SAFEEvents", "#Swansea"],
    defaultCtaSlug: "attend-an-event",
    displayOrder: 6,
  },
  {
    slug: "did-you-know",
    name: "Did You Know – GC Facts",
    color: SIG.cream,
    icon: "lightbulb",
    defaultPostType: "carousel",
    defaultHashtags: ["#DidYouKnow", "#GreenChampions", "#Sustainability"],
    defaultCtaSlug: "learn-change-behaviour",
    displayOrder: 7,
  },
  {
    slug: "volunteer-activity",
    name: "Volunteer Activity",
    color: SIG.coral,
    icon: "hand-helping",
    defaultPostType: "grid",
    defaultHashtags: ["#Volunteer", "#CharityWork", "#SAFEFoundation"],
    defaultCtaSlug: "volunteer",
    displayOrder: 8,
  },
  {
    slug: "anniversary-20-years",
    name: "20 Years of SAFE",
    color: SIG.peach,
    icon: "cake",
    defaultPostType: "carousel",
    defaultHashtags: ["#20YearsOfSAFE", "#SAFEFoundation", "#Anniversary"],
    defaultCtaSlug: "share",
    displayOrder: 9,
  },
  {
    slug: "campaign-update",
    name: "Campaign Update",
    color: SIG.mint,
    icon: "megaphone",
    defaultPostType: "grid",
    defaultHashtags: ["#Campaign", "#SAFEFoundation"],
    defaultCtaSlug: "share",
    displayOrder: 10,
  },
  {
    slug: "mental-health",
    name: "Mental Health",
    color: SIG.yellow,
    icon: "brain",
    defaultPostType: "carousel",
    defaultHashtags: ["#MentalHealth", "#Wellbeing", "#SAFEFoundation"],
    defaultCtaSlug: "learn-change-behaviour",
    displayOrder: 11,
  },
  {
    slug: "staff-roles",
    name: "Staff Roles & Recruitment",
    color: SIG.forest,
    icon: "id-card",
    defaultPostType: "grid",
    defaultHashtags: ["#Hiring", "#JoinUs", "#CharityJobs"],
    defaultCtaSlug: "share",
    displayOrder: 12,
  },
  {
    slug: "social-media-guide",
    name: "Social Media Guide / Voice",
    color: SIG.mustard,
    icon: "book-open",
    defaultPostType: "grid",
    defaultHashtags: ["#SAFEFoundation"],
    defaultCtaSlug: "like",
    displayOrder: 13,
  },
  {
    slug: "general",
    name: "General",
    color: SIG.navy,
    icon: "circle",
    defaultPostType: "grid",
    defaultHashtags: ["#SAFEFoundation"],
    defaultCtaSlug: "like",
    displayOrder: 14,
  },
]

export async function seedCategoriesAndCtas() {
  ensureEmulator()

  const orgRef = db().doc(`organizations/${SAFE_ORG_ID}`)
  const ctaCol = orgRef.collection("ctas")
  const catCol = orgRef.collection("categories")

  // CTAs first — categories reference them by id (= slug).
  const ctaIdBySlug = new Map<string, string>()
  for (const cta of CTAS) {
    const id = cta.slug
    await ctaCol.doc(id).set(
      withAudit({
        id,
        organizationId: SAFE_ORG_ID,
        slug: cta.slug,
        label: cta.label,
        description: cta.description,
      }),
      { merge: true },
    )
    ctaIdBySlug.set(cta.slug, id)
  }
  console.log(`✓ ctas: ${CTAS.length}`)

  for (const cat of CATEGORIES) {
    const id = cat.slug
    const defaultCtaId = cat.defaultCtaSlug
      ? ctaIdBySlug.get(cat.defaultCtaSlug)
      : undefined
    if (cat.defaultCtaSlug && !defaultCtaId) {
      throw new Error(
        `Unknown default CTA slug "${cat.defaultCtaSlug}" on category "${cat.slug}"`,
      )
    }
    await catCol.doc(id).set(
      withAudit({
        id,
        organizationId: SAFE_ORG_ID,
        slug: cat.slug,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        description: cat.description,
        defaultPostType: cat.defaultPostType ?? "grid",
        defaultHashtags: cat.defaultHashtags ?? [],
        defaultCtaId,
        isActive: true,
        displayOrder: cat.displayOrder,
      }),
      { merge: true },
    )
  }
  console.log(`✓ categories: ${CATEGORIES.length}`)
}

if (require.main === module) {
  seedCategoriesAndCtas().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
