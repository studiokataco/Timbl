import { beforeUserSignedIn as v2BeforeUserSignedIn, HttpsError } from "firebase-functions/v2/identity"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import { logger } from "firebase-functions"

const SAFE_ORG_ID = "safe-foundation"
const ALLOWED_DOMAINS = ["safefoundation.org.uk", "kataco.in"]

type ContributorSeed = {
  email: string
  name: string
  role: "admin" | "editor" | "contributor"
}

/**
 * Blocking trigger that runs on every sign-in attempt. Resolves the user's
 * `/organizations/{orgId}/users/{userId}` membership and emits custom claims
 * — `organizationId`, `role`, and `userId` — that Firestore Rules read on
 * every request.
 *
 * Auto-provisions contributors for the allowed Workspace domains so the
 * first sign-in from a new SAFE/Kataco user lands cleanly without manual
 * membership setup.
 */
export const beforeUserSignedIn = v2BeforeUserSignedIn(async (event) => {
  const user = event.data
  if (!user?.email) throw new HttpsError("permission-denied", "Email required")

  const email = user.email.toLowerCase()
  const domain = email.split("@")[1]
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    logger.warn("[claims] denied non-allowed domain", { email })
    throw new HttpsError(
      "permission-denied",
      "Your account isn't authorised for the SAFE planner.",
    )
  }

  const db = getFirestore()
  const membership = await findMembership(email)
  if (membership) {
    logger.info("[claims] resolved membership", { email, ...membership })
    return {
      customClaims: {
        organizationId: membership.orgId,
        role: membership.role,
        userId: membership.userId,
      },
    }
  }

  /* No membership yet — auto-provision under SAFE as a contributor. */
  const seed = await provisionContributor(db, email, user.displayName ?? email.split("@")[0])
  logger.info("[claims] provisioned contributor", { email, userId: seed.userId })
  return {
    customClaims: {
      organizationId: SAFE_ORG_ID,
      role: seed.role,
      userId: seed.userId,
    },
  }
})

async function findMembership(email: string) {
  const db = getFirestore()
  const orgs = await db.collection("organizations").get()
  for (const org of orgs.docs) {
    const hit = await db
      .collection(`organizations/${org.id}/users`)
      .where("email", "==", email)
      .limit(1)
      .get()
    if (!hit.empty) {
      const doc = hit.docs[0]
      const data = doc.data()
      return {
        orgId: org.id,
        userId: doc.id,
        role: (data.role as ContributorSeed["role"]) ?? "contributor",
      }
    }
  }
  return null
}

async function provisionContributor(
  db: FirebaseFirestore.Firestore,
  email: string,
  displayName: string,
): Promise<{ userId: string; role: ContributorSeed["role"] }> {
  const slug = slugify(email.split("@")[0])
  const ref = db.collection(`organizations/${SAFE_ORG_ID}/users`).doc(slug)
  await ref.set(
    {
      email,
      name: displayName,
      role: "contributor",
      organizationId: SAFE_ORG_ID,
      provisionedAt: FieldValue.serverTimestamp(),
      provisionedVia: "beforeUserSignedIn",
    },
    { merge: true },
  )
  return { userId: slug, role: "contributor" }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}
