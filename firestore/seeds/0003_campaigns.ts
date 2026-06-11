import { TIMBL_DEMO_ORG_ID, db, ensureEmulator, withAudit } from "./_helpers"
import { orgCampaignsPath } from "@/lib/firebase/paths"

const campaigns = [
  {
    id: "20th-anniversary-ball",
    name: "20th Anniversary Ball",
    slug: "20th-anniversary-ball",
    description:
      "Celebrating 20 years - gala fundraiser and awareness campaign.",
    color: "#fb923c",
    startDate: "2026-06-01",
    endDate: "2026-09-30",
    status: "active",
  },
  {
    id: "mental-health-awareness-week-2026",
    name: "Mental Health Awareness Week 2026",
    slug: "mental-health-awareness-week-2026",
    description: "Annual MHAW content series across all channels.",
    color: "#10b981",
    startDate: "2026-05-11",
    endDate: "2026-05-17",
    status: "active",
  },
] as const

export async function seed0003Campaigns() {
  ensureEmulator()
  const col = orgCampaignsPath(TIMBL_DEMO_ORG_ID)
  for (const c of campaigns) {
    const { id, ...rest } = c
    await db().doc(`${col}/${id}`).set(withAudit(rest), { merge: true })
    console.log(`  ✓ campaign ${id}`)
  }
}
