#!/usr/bin/env tsx
/*
 * One-shot prod bootstrap: ensure timbl-demo org + hello@kataco.in membership.
 * Idempotent. Run against prod Admin SDK credentials (not emulator).
 *
 *   GCP_PROJECT=timbl-prod pnpm tsx --require ./scripts/stub-server-only.cjs scripts/bootstrap-prod-org.ts
 */
import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath, orgUsersPath } from "@/lib/firebase/paths"
import { bootstrapNewOrg } from "@/lib/org/bootstrap"
import { TIMBL_DEMO_ORG_ID } from "@/lib/constants/timbl"
import { ROOT_PLATFORM_ADMIN_EMAIL } from "@/lib/platform/schema"
import { slugify } from "@/lib/auth/membership"

const ORG_ID = TIMBL_DEMO_ORG_ID
const EMAIL = ROOT_PLATFORM_ADMIN_EMAIL

async function main() {
  const db = getAdminDb()
  const orgRef = db.doc(orgPath(ORG_ID))
  if (!(await orgRef.get()).exists) {
    await bootstrapNewOrg({ orgId: ORG_ID, name: "Timbl Demo" })
    console.log(`→ created org ${ORG_ID}`)
  } else {
    console.log(`→ org ${ORG_ID} already exists`)
  }

  const userId = slugify(EMAIL.split("@")[0])
  const now = new Date().toISOString()
  await db.doc(`${orgUsersPath(ORG_ID)}/${userId}`).set(
    {
      id: userId,
      email: EMAIL,
      name: "Timbl Admin",
      role: "admin",
      organizationId: ORG_ID,
      active: true,
      provisionedAt: now,
      provisionedVia: "bootstrap_prod",
    },
    { merge: true },
  )
  console.log(`→ membership for ${EMAIL} in ${ORG_ID}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
