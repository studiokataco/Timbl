#!/usr/bin/env node
/*
 * One-shot prod seeder for non-agent data: categories, CTAs, kanban
 * columns, brand config. Idempotent (merge:true equivalent via PATCH).
 *
 * Why this exists: the original phased seeds in firestore/seeds/ all call
 * `ensureEmulator()` and are gated on FIRESTORE_EMULATOR_HOST. Phase 7 only
 * seeded agentConfigs to prod (via /api/settings/install-default-agents);
 * categories / kanbanColumns / brandConfig were never seeded. Without them
 * the UI renders empty (kanban has no columns; /posts filters out posts
 * with unknown categoryId).
 *
 * Auth: uses the operator's gcloud OAuth token (no Admin SDK / no ADC).
 * Run: node scripts/seed-prod-data.mjs
 */

import { execSync } from "node:child_process"

const PROJECT_ID = "sm-dashboard-e7641"
const ORG_ID = "safe-foundation"
const ACCOUNT = "hello@kataco.in"

function authToken() {
  return execSync(
    `gcloud auth print-access-token --account=${ACCOUNT}`,
    { encoding: "utf8" },
  ).trim()
}

function fsPath(...segments) {
  const path = ["organizations", ORG_ID, ...segments].join("/")
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`
}

/* Firestore REST value encoding. Only the types we need here. */
function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === "boolean") return { booleanValue: v }
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v }
  }
  if (typeof v === "string") return { stringValue: v }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFsValue) } }
  }
  if (typeof v === "object") {
    const fields = {}
    for (const [k, vv] of Object.entries(v)) {
      if (vv === undefined) continue
      fields[k] = toFsValue(vv)
    }
    return { mapValue: { fields } }
  }
  throw new Error(`unsupported value type: ${typeof v}`)
}

function toFsDoc(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    fields[k] = toFsValue(v)
  }
  return { fields }
}

let TOKEN
async function upsert(path, doc, idField = "id") {
  const id = doc[idField]
  if (!id) throw new Error(`missing ${idField} on doc: ${JSON.stringify(doc)}`)
  const url = `${fsPath(...path)}/${id}`
  const updateMask = Object.keys(doc)
    .filter((k) => doc[k] !== undefined)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&")
  const res = await fetch(`${url}?${updateMask}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toFsDoc(doc)),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PATCH ${url} -> ${res.status}: ${body.slice(0, 300)}`)
  }
  return await res.json()
}

const now = () => new Date().toISOString()

/* === DATA: copied from firestore/seeds/0002 + 0006 (source of truth) === */

const CTAS = [
  { slug: "attend-an-event", label: "Attend an event" },
  { slug: "donate", label: "Donate" },
  { slug: "like", label: "Like" },
  {
    slug: "learn-change-behaviour",
    label: "Learn / change behaviour",
    description:
      "Educational call to action — invite the audience to read, watch, or change a habit.",
  },
  { slug: "visit-shop", label: "Visit shop" },
  { slug: "volunteer", label: "Volunteer" },
  { slug: "share", label: "Share" },
  { slug: "comment", label: "Comment" },
  { slug: "save", label: "Save" },
]

const SIG = {
  coral: "#fb923c",
  forest: "#10b981",
  cream: "#fde68a",
  peach: "#fbcfe8",
  mint: "#34d399",
  yellow: "#f59e0b",
  mustard: "#ec4899",
  navy: "#8b5cf6",
}

const CATEGORIES = [
  { slug: "ethical-boutique-pick", name: "Ethical Boutique – Pick of Week", color: SIG.coral, icon: "shopping-bag", defaultPostType: "grid", defaultHashtags: ["#SustainableFashion", "#CharityShop", "#Donate", "#CharityRaffle", "#EthicalBoutique"], defaultCtaSlug: "visit-shop", displayOrder: 1 },
  { slug: "ethical-boutique-general", name: "Ethical Boutique – General", color: SIG.peach, icon: "shirt", defaultPostType: "grid", defaultHashtags: ["#EthicalBoutique", "#SustainableFashion", "#CharityShop"], defaultCtaSlug: "visit-shop", displayOrder: 2 },
  { slug: "meet-the-team", name: "Meet the Team", color: SIG.forest, icon: "users", defaultPostType: "reel", defaultHashtags: ["#MeetTheTeam", "#CharityWork"], defaultCtaSlug: "like", displayOrder: 3 },
  { slug: "international-day", name: "International / Awareness Day", color: SIG.mint, icon: "globe", defaultPostType: "carousel", defaultHashtags: ["#AwarenessDay", "#CharityWork"], defaultCtaSlug: "learn-change-behaviour", displayOrder: 4 },
  { slug: "fundraising-appeal", name: "Fundraising Appeal", color: SIG.yellow, icon: "heart-handshake", defaultPostType: "grid", defaultHashtags: ["#Fundraising", "#Donate", "#CharityWork"], defaultCtaSlug: "donate", displayOrder: 5 },
  { slug: "events-whats-on", name: "What's On / Events", color: SIG.mustard, icon: "calendar-days", defaultPostType: "carousel", defaultHashtags: ["#WhatsOn", "#CommunityEvents", "#Swansea"], defaultCtaSlug: "attend-an-event", displayOrder: 6 },
  { slug: "did-you-know", name: "Did You Know – GC Facts", color: SIG.cream, icon: "lightbulb", defaultPostType: "carousel", defaultHashtags: ["#DidYouKnow", "#GreenChampions", "#Sustainability"], defaultCtaSlug: "learn-change-behaviour", displayOrder: 7 },
  { slug: "volunteer-activity", name: "Volunteer Activity", color: SIG.coral, icon: "hand-helping", defaultPostType: "grid", defaultHashtags: ["#Volunteer", "#CharityWork"], defaultCtaSlug: "volunteer", displayOrder: 8 },
  { slug: "anniversary-20-years", name: "20 year anniversary", color: SIG.peach, icon: "cake", defaultPostType: "carousel", defaultHashtags: ["#20YearAnniversary", "#CharityWork", "#Anniversary"], defaultCtaSlug: "share", displayOrder: 9 },
  { slug: "campaign-update", name: "Campaign Update", color: SIG.mint, icon: "megaphone", defaultPostType: "grid", defaultHashtags: ["#Campaign", "#CharityWork"], defaultCtaSlug: "share", displayOrder: 10 },
  { slug: "mental-health", name: "Mental Health", color: SIG.yellow, icon: "brain", defaultPostType: "carousel", defaultHashtags: ["#MentalHealth", "#Wellbeing", "#CharityWork"], defaultCtaSlug: "learn-change-behaviour", displayOrder: 11 },
  { slug: "staff-roles", name: "Staff Roles & Recruitment", color: SIG.forest, icon: "id-card", defaultPostType: "grid", defaultHashtags: ["#Hiring", "#JoinUs", "#CharityJobs"], defaultCtaSlug: "share", displayOrder: 12 },
  { slug: "social-media-guide", name: "Social Media Guide / Voice", color: SIG.mustard, icon: "book-open", defaultPostType: "grid", defaultHashtags: ["#CharityWork"], defaultCtaSlug: "like", displayOrder: 13 },
  { slug: "general", name: "General", color: SIG.navy, icon: "circle", defaultPostType: "grid", defaultHashtags: ["#CharityWork"], defaultCtaSlug: "like", displayOrder: 14 },
]

const KANBAN_COLUMNS = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "brief", label: "Brief", color: "#fbbf24" },
  { id: "researching", label: "Researching", color: "#fb923c" },
  { id: "designing", label: "Designing", color: "#ec4899" },
  { id: "review", label: "Review", color: "#8b5cf6" },
  { id: "scheduled", label: "Scheduled", color: "#3b82f6" },
  { id: "posted", label: "Posted", color: "#10b981" },
  { id: "missed", label: "Missed", color: "#ef4444" },
  { id: "archived", label: "Archived", color: "#64748b" },
]

/* A minimal brandConfig — voice + audience + cadence are required.
 * Sourced from demo nonprofit public materials (youth mental health). */
const BRAND_CONFIG = {
  id: "default",
  organizationId: ORG_ID,
  voice:
    "Warm, hopeful, human. Speak directly to young people facing tough times — never patronise, never preach. Sentence case throughout. Avoid jargon and clinical language. When discussing mental health, lead with empathy and ground every claim in lived experience. We are a companion, not a clinic.",
  audience:
    "Young people aged 14–25 in South West Wales navigating mental health challenges, plus the parents, teachers, and youth workers who support them. Many in our audience are first-time encounter-ers of support services — assume zero prior knowledge of charity workflows or therapy language.",
  channels: ["instagram", "facebook", "linkedin"],
  targetCadence: {
    perWeek: 4,
    preferredDays: ["tue", "wed", "thu"],
    preferredTimes: ["10:00", "17:00"],
  },
  forbiddenTopics: [
    "Specific suicide methods",
    "Graphic descriptions of self-harm",
    "Diagnosis or clinical advice (always signpost to professionals)",
    "Political endorsements",
  ],
  samplePosts: [],
  createdAt: now(),
  updatedAt: now(),
}

async function main() {
  TOKEN = authToken()
  console.log(`→ project=${PROJECT_ID} org=${ORG_ID} actor=${ACCOUNT}`)

  console.log("\n=== CTAs ===")
  for (const c of CTAS) {
    await upsert(["ctas"], {
      id: c.slug,
      organizationId: ORG_ID,
      slug: c.slug,
      label: c.label,
      description: c.description,
      createdAt: now(),
      updatedAt: now(),
    })
    console.log(`  ✓ ${c.slug}`)
  }

  console.log("\n=== Categories ===")
  for (const cat of CATEGORIES) {
    await upsert(["categories"], {
      id: cat.slug,
      organizationId: ORG_ID,
      slug: cat.slug,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      description: cat.description,
      defaultPostType: cat.defaultPostType ?? "grid",
      defaultHashtags: cat.defaultHashtags ?? [],
      defaultCtaId: cat.defaultCtaSlug,
      isActive: true,
      displayOrder: cat.displayOrder,
      createdAt: now(),
      updatedAt: now(),
    })
    console.log(`  ✓ ${cat.slug}`)
  }

  console.log("\n=== Kanban columns ===")
  for (let i = 0; i < KANBAN_COLUMNS.length; i++) {
    const c = KANBAN_COLUMNS[i]
    await upsert(["kanbanColumns"], {
      id: c.id,
      organizationId: ORG_ID,
      label: c.label,
      color: c.color,
      sortOrder: i,
      isSystemDefault: true,
      createdAt: now(),
      updatedAt: now(),
    })
    console.log(`  ✓ ${c.id}`)
  }

  console.log("\n=== Brand config ===")
  await upsert(["brandConfig"], BRAND_CONFIG)
  console.log("  ✓ default")

  console.log("\n✅ done")
}

main().catch((err) => {
  console.error("✗ FAILED:", err.message)
  process.exit(1)
})
