import "server-only"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { orgCategoriesPath, orgCtasPath, orgPostsPath, orgUsersPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import type { Category, Cta, Post, User } from "@/lib/schemas"

/*
 * Server-side reads. Used by Server Components to hydrate a page; the
 * Client Components keep the same data fresh through TanStack Query +
 * Firestore onSnapshot.
 *
 * Every helper takes `orgId` from getCurrentOrgId() — never trust implicit
 * scoping, even with the dev shim.
 */

export async function fetchPostsInRange(start: string, end: string): Promise<WithId<Post>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgPostsPath(orgId))
    .where("scheduledDate", ">=", start)
    .where("scheduledDate", "<=", end)
    .orderBy("scheduledDate", "asc")
    .get()
  return snap.docs.map((d) => snapToData<Post>(d))
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
  const snap = await getDb().collection(orgCtasPath(orgId)).limit(500).get()
  return snap.docs.map((d) => snapToData<Cta>(d))
}

export async function fetchUsers(): Promise<WithId<User>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().collection(orgUsersPath(orgId)).limit(500).get()
  return snap.docs.map((d) => snapToData<User>(d))
}
