import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin"
import {
  emailSlug,
  platformAdminDocPath,
  ROOT_PLATFORM_ADMIN_EMAIL,
} from "@/lib/platform/schema"

/*
 * Bootstrap the sole root platform admin (hello@kataco.in) into the
 * allowlist. Run once after the control centre lands. Idempotent.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   pnpm seed:platform
 *
 * In production, run against the real project (Admin SDK credentials) once.
 * Every additional platform admin is granted from inside the control centre
 * via grantPlatformAdmin - never re-run this with a different email.
 *
 * Writes platform/state/admins/{slug} (the source of truth re-stamped on
 * each sign-in) and, if the auth user already exists, stamps the
 * platform:'admin' claim immediately so no re-login is needed.
 */

async function main() {
  const email = ROOT_PLATFORM_ADMIN_EMAIL
  const slug = emailSlug(email)

  await getAdminDb()
    .doc(platformAdminDocPath(slug))
    .set(
      {
        email,
        role: "owner",
        grantedBy: "seed",
        grantedAt: new Date().toISOString(),
      },
      { merge: true },
    )
  console.log(`→ allowlisted ${email} at ${platformAdminDocPath(slug)}`)

  try {
    const user = await getAdminAuth().getUserByEmail(email)
    await getAdminAuth().setCustomUserClaims(user.uid, {
      ...(user.customClaims ?? {}),
      platform: "admin",
      platformRole: "owner",
    })
    console.log(`→ stamped platform:'admin' claim on uid=${user.uid}`)
  } catch {
    console.log(
      `→ no auth user for ${email} yet - the claim is stamped on first sign-in by the blocking trigger`,
    )
  }

  console.log("\nplatform admin seed complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
