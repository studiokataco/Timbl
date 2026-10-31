import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgBrandsPath,
  orgPostsPath,
  orgPostStatusHistoryPath,
} from "@/lib/firebase/paths"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

/*
 * Read-only damage report for the zod `.partial()` defaults bug. Partial
 * updates (calendar drag, kanban move) wrote status "idea", empty hashtags,
 * assets and design links, and brandId "default"; partial brand writes reset
 * the brand name to "Default brand". The status reset left a statusHistory
 * entry `{from: <real status>, to: "idea"}`, which is what this reports.
 * Wiped arrays leave no trail - recovering them needs point-in-time recovery.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm report:reset-posts
 *   env -u FIRESTORE_EMULATOR_HOST NEXT_PUBLIC_FIREBASE_PROJECT_ID=timbl-prod pnpm report:reset-posts
 *
 * Writes nothing.
 */

type ResetRow = {
  orgId: string
  postId: string
  humanId: string
  brief: string
  restoreTo: string
  resetAt: string
  scheduledDate: string
  hashtags: number
}

async function main() {
  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  const resets: ResetRow[] = []
  const renamedBrands: { orgId: string; brandId: string }[] = []

  for (const org of orgs.docs) {
    const orgId = org.id
    const idlePosts = await db.collection(orgPostsPath(orgId)).where("status", "==", "idea").get()
    for (const post of idlePosts.docs) {
      const latest = await db
        .collection(orgPostStatusHistoryPath(orgId, post.id))
        .orderBy("at", "desc")
        .limit(1)
        .get()
      const entry = latest.docs[0]?.data()
      if (!entry || entry.to !== "idea" || !entry.from || entry.from === "idea") continue
      const data = post.data()
      resets.push({
        orgId,
        postId: post.id,
        humanId: data.humanId ?? "",
        brief: String(data.brief ?? "").slice(0, 40),
        restoreTo: entry.from,
        resetAt: entry.at,
        scheduledDate: data.scheduledDate ?? "",
        hashtags: Array.isArray(data.hashtags) ? data.hashtags.length : 0,
      })
    }

    const brands = await db.collection(orgBrandsPath(orgId)).get()
    for (const brand of brands.docs) {
      if (brand.id !== DEFAULT_BRAND_ID && brand.data().name === "Default brand") {
        renamedBrands.push({ orgId, brandId: brand.id })
      }
    }
  }

  console.log(`Scanned ${orgs.size} orgs.`)
  console.log(`\nPosts whose last status change was a move to "idea" (${resets.length}):`)
  if (resets.length) console.table(resets)
  console.log(
    "Note: a deliberate move back to idea also matches. Check resetAt against a calendar or kanban edit before restoring.",
  )
  console.log(`\nNon-default brands named "Default brand" (${renamedBrands.length}):`)
  if (renamedBrands.length) console.table(renamedBrands)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
