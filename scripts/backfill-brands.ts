import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgAgentMemoryPath,
  orgAgentRunsPath,
  orgBrandConfigDocPath,
  orgBrandDocPath,
  orgCampaignsPath,
  orgPostsPath,
  orgPublishRunsPath,
  orgSocialAccountsPath,
  orgTemplatesPath,
} from "@/lib/firebase/paths"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

/*
 * Backfill for the brands-as-entities rollout. Two moves per org:
 *
 *   1. Materialise the default brand at /brands/default from the legacy
 *      /brandConfig/default doc (adding a `name`), so listBrands sees it
 *      without relying on the read-time legacy fallback.
 *   2. Stamp brandId="default" on every content doc that predates the field,
 *      so brand-filtered queries stop treating them as "missing" and the
 *      app can move from in-memory brand matching to indexed where() later.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm backfill:brands
 *
 * Idempotent: only creates /brands/default when absent, only stamps docs that
 * lack brandId. Safe to run repeatedly. Run per environment before/at deploy.
 */

const STAMPED_COLLECTIONS = [
  orgPostsPath,
  orgCampaignsPath,
  orgTemplatesPath,
  orgAgentMemoryPath,
  orgPublishRunsPath,
  orgSocialAccountsPath,
  orgAgentRunsPath,
]

async function ensureDefaultBrand(
  db: FirebaseFirestore.Firestore,
  orgId: string,
): Promise<boolean> {
  const brandRef = db.doc(orgBrandDocPath(orgId, DEFAULT_BRAND_ID))
  if ((await brandRef.get()).exists) return false
  const legacy = await db.doc(orgBrandConfigDocPath(orgId)).get()
  const now = new Date().toISOString()
  const base = legacy.exists ? legacy.data() ?? {} : {}
  await brandRef.set({
    voice: "",
    audience: "",
    channels: [],
    targetCadence: { perWeek: 3, preferredDays: [], preferredTimes: [] },
    forbiddenTopics: [],
    samplePosts: [],
    ...base,
    id: DEFAULT_BRAND_ID,
    organizationId: orgId,
    name: (base.name as string | undefined)?.trim() || "Default brand",
    createdAt: (base.createdAt as string | undefined) ?? now,
    updatedAt: now,
  })
  return true
}

async function stampCollection(
  db: FirebaseFirestore.Firestore,
  path: string,
): Promise<number> {
  const snap = await db.collection(path).get()
  let stamped = 0
  let batch = db.batch()
  let inBatch = 0
  for (const doc of snap.docs) {
    if (doc.data().brandId !== undefined) continue
    batch.set(doc.ref, { brandId: DEFAULT_BRAND_ID }, { merge: true })
    stamped++
    inBatch++
    if (inBatch === 400) {
      await batch.commit()
      batch = db.batch()
      inBatch = 0
    }
  }
  if (inBatch > 0) await batch.commit()
  return stamped
}

async function main() {
  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let brandsCreated = 0
  let totalStamped = 0

  for (const org of orgs.docs) {
    const orgId = org.id
    if (await ensureDefaultBrand(db, orgId)) {
      brandsCreated++
      console.log(`- ${orgId}: created /brands/default`)
    }
    for (const pathFn of STAMPED_COLLECTIONS) {
      const n = await stampCollection(db, pathFn(orgId))
      if (n > 0) {
        totalStamped += n
        console.log(`- ${orgId}: stamped brandId on ${n} ${pathFn(orgId).split("/").pop()}`)
      }
    }
  }

  console.log(
    `\nDone. ${brandsCreated} default brands created, ${totalStamped} docs stamped across ${orgs.size} orgs.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
