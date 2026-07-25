import "server-only"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { getCurrentBrandId } from "@/lib/brand/brand-session"
import { orgCategoriesPath, orgCtasPath, orgPostsPath, orgUsersPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { seedDefaultCtasIfEmpty } from "@/lib/org/seed-default-ctas"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import type { Category, Cta, Post, User } from "@/lib/schemas"

/*
 * Server-side reads. Used by Server Components to hydrate a page; the
 * Client Components keep the same data fresh through TanStack Query +
 * Firestore onSnapshot.
 *
 * Every helper takes `orgId` from getCurrentOrgId() - never trust implicit
 * scoping, even with the dev shim.
 */

export async function fetchPostsInRange(start: string, end: string): Promise<WithId<Post>[]> {
  const orgId = await getCurrentOrgId()
  const brandId = await getCurrentBrandId(orgId)
  const snap = await getDb()
    .collection(orgPostsPath(orgId))
    .where("scheduledDate", ">=", start)
    .where("scheduledDate", "<=", end)
    .orderBy("scheduledDate", "asc")
    .get()
  /* Brand filter in memory, not a where() clause: the date range already
   * bounds the set, and a Firestore equality on brandId would skip posts
   * written before the backfill (no brandId field) - those are the default
   * brand. Keeps the calendar correct with no composite index. */
  return snap.docs
    .map((d) => snapToData<Post>(d))
    .filter((p) => (p.brandId ?? DEFAULT_BRAND_ID) === brandId)
}

export async function fetchPost(postId: string): Promise<WithId<Post> | null> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().doc(`${orgPostsPath(orgId)}/${postId}`).get()
  return snap.exists ? snapToData<Post>(snap) : null
}

export async function fetchCategories(): Promise<WithId<Category>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgCategoriesPath(orgId))
    .where("isActive", "==", true)
    .orderBy("displayOrder", "asc")
    .get()
  return snap.docs.map((d) => snapToData<Category>(d))
}

export async function fetchCtas(): Promise<WithId<Cta>[]> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  await seedDefaultCtasIfEmpty(db, orgId)
  const snap = await db.collection(orgCtasPath(orgId)).limit(500).get()
  return snap.docs.map((d) => snapToData<Cta>(d))
}

export async function fetchUsers(): Promise<WithId<User>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().collection(orgUsersPath(orgId)).limit(500).get()
  return snap.docs.map((d) => snapToData<User>(d))
}
