import {
  DEMO_ADMIN_USER_ID,
  TIMBL_DEMO_ORG_ID,
  TIMBL_DEV_ADMIN_EMAIL,
} from "@/lib/constants/timbl"
import { db, ensureEmulator, withAudit } from "./_helpers"

export async function seedDemoOrg() {
  ensureEmulator()
  const orgRef = db().doc(`organizations/${TIMBL_DEMO_ORG_ID}`)
  await orgRef.set(
    withAudit({
      id: TIMBL_DEMO_ORG_ID,
      slug: TIMBL_DEMO_ORG_ID,
      name: "Timbl demo",
      primaryColor: "#111111",
      plan: "agency_v1",
      onboarding: {
        completedAt: new Date().toISOString(),
        profile: {
          industry: "nonprofit",
          channels: ["instagram", "facebook"],
        },
      },
    }),
    { merge: true },
  )
  console.log("✓ organization: Timbl demo")

  const userRef = orgRef.collection("users").doc(DEMO_ADMIN_USER_ID)
  await userRef.set(
    withAudit({
      id: DEMO_ADMIN_USER_ID,
      organizationId: TIMBL_DEMO_ORG_ID,
      email: TIMBL_DEV_ADMIN_EMAIL,
      name: "Timbl Admin",
      role: "admin",
      defaultCategories: [],
    }),
    { merge: true },
  )
  console.log("✓ user: Timbl Admin (role=admin)")
}

if (require.main === module) {
  seedDemoOrg().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
