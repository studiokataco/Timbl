import { TIMBL_DEMO_ORG_ID, db, ensureEmulator, withAudit } from "./_helpers"
import { orgTemplatesPath } from "@/lib/firebase/paths"

/*
 * Seeds 4 starter templates for the Timbl demo org. Each template references a
 * category by slug (= category id). The `useTemplate` server action consumes
 * defaultPostType / defaultHashtags / defaultCtaId / blurbTemplate when
 * promoting a template to a post.
 */

type TemplateSeed = {
  id: string
  name: string
  categoryId: string
  defaultPostType: "grid" | "carousel" | "reel" | "story" | "video"
  defaultHashtags: string[]
  defaultCtaId?: string
  blurbTemplate?: string
  designTemplateCanvaUrl?: string
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly" | "ad-hoc"
}

const TEMPLATES: TemplateSeed[] = [
  {
    id: "meet-the-team",
    name: "Meet the Team",
    categoryId: "meet-the-team",
    defaultPostType: "reel",
    defaultHashtags: [
      "#MeetTheTeam",
      "#CharityWork",
      "#CharityStaff",
    ],
    defaultCtaId: "like",
    blurbTemplate:
      "Meet {{name}} - {{role}} on our team. {{name}} has been with us for {{duration}} and {{oneLineHighlight}}.\n\nDouble-tap if you've met {{name}} at one of our events!",
    cadence: "biweekly",
  },
  {
    id: "pick-of-the-week",
    name: "Pick of the Week",
    categoryId: "ethical-boutique-pick",
    defaultPostType: "grid",
    defaultHashtags: [
      "#SustainableFashion",
      "#CharityShop",
      "#PickOfTheWeek",
      "#EthicalBoutique",
    ],
    defaultCtaId: "visit-shop",
    blurbTemplate:
      "This week's Pick of the Week: {{itemName}} - {{description}}.\n\nFind it in store at the Ethical Boutique. Every purchase supports our work in the community.",
    cadence: "weekly",
  },
  {
    id: "whats-on-this-month",
    name: "What's On This Month",
    categoryId: "events-whats-on",
    defaultPostType: "carousel",
    defaultHashtags: [
      "#WhatsOn",
      "#CommunityEvents",
      "#Swansea",
      "#ThingsToDo",
    ],
    defaultCtaId: "attend-an-event",
    blurbTemplate:
      "Here's what's on this {{month}} 💛\n\nSwipe through to see the full line-up - and tap the link in bio to book.",
    cadence: "monthly",
  },
  {
    id: "did-you-know",
    name: "Did You Know - GC Facts",
    categoryId: "did-you-know",
    defaultPostType: "carousel",
    defaultHashtags: [
      "#DidYouKnow",
      "#GreenChampions",
      "#Sustainability",
      "#ClimateAction",
    ],
    defaultCtaId: "learn-change-behaviour",
    blurbTemplate:
      "Did you know? {{fact}}\n\nSmall changes add up. What's one thing you could try this week?",
    cadence: "weekly",
  },
]

export async function seed0004Templates() {
  ensureEmulator()
  const col = orgTemplatesPath(TIMBL_DEMO_ORG_ID)
  for (const t of TEMPLATES) {
    const { id, ...rest } = t
    await db()
      .doc(`${col}/${id}`)
      .set(withAudit({ ...rest, organizationId: TIMBL_DEMO_ORG_ID }), { merge: true })
    console.log(`  ✓ template ${id}`)
  }
  console.log(`✓ templates: ${TEMPLATES.length}`)
}

if (require.main === module) {
  seed0004Templates().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
