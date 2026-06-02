import { db, ensureEmulator, SAFE_ADMIN_USER_ID, SAFE_ORG_ID, withAudit } from "./_helpers"

/*
 * Seeds the SAFE Foundation organization plus a single admin user.
 * Idempotent: setDoc with merge keyed by stable slugs (`safe-foundation`,
 * `admin`).
 *
 * The admin user is intentionally generic - `admin@safefoundation.dev`,
 * display name "SAFE Admin". Real staff users land via the CSV migration
 * (Phase 8) and via Google SSO first-login (Phase 7).
 */

export async function seedSafeOrg() {
  ensureEmulator()
  const orgRef = db().doc(`organizations/${SAFE_ORG_ID}`)
  await orgRef.set(
    withAudit({
      id: SAFE_ORG_ID,
      slug: "safe-foundation",
      name: "SAFE Foundation",
      primaryColor: "#111111",
      /* Top self-serve tier during pilot so gates stay off. */
      plan: "agency_v1",
      /* SAFE is the legacy demo org - already has categories, agents,
       * templates from the seed scripts that follow. Marking onboarding
       * as complete here keeps the (app) layout from redirecting it to
       * /onboarding on every dev boot. */
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
  console.log("✓ organization: SAFE Foundation")

  const userRef = orgRef.collection("users").doc(SAFE_ADMIN_USER_ID)
  await userRef.set(
    withAudit({
      id: SAFE_ADMIN_USER_ID,
      organizationId: SAFE_ORG_ID,
      email: "admin@safefoundation.dev",
      name: "SAFE Admin",
      role: "admin",
      defaultCategories: [],
    }),
    { merge: true },
  )
  console.log("✓ user: SAFE Admin (role=admin)")
}

if (require.main === module) {
  seedSafeOrg().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
