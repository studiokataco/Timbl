"use server"

import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { getCurrentOrgId, getCurrentUser, getDb } from "@/lib/auth/server-helpers"
import { orgPostSharesPath, shareTokensPath } from "@/lib/firebase/paths"
import { writePostActivity } from "@/lib/actions/post-activity"
import type { ServerActionResult } from "@/lib/schemas"
import type { Share } from "@/lib/schemas/share"

export type ShareInfo = {
  id: string
  mode: Share["mode"]
  role: Share["role"]
  token: string
  expiresAt?: string
  createdAt: string
}

export async function listPostShares(postId: string): Promise<ShareInfo[]> {
  const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
  const snap = await db.collection(orgPostSharesPath(orgId, postId)).get()
  return snap.docs.map((d) => d.data() as ShareInfo)
}

export async function createShareLink(input: {
  postId: string
  mode?: Share["mode"]
  role?: Share["role"]
}): Promise<ServerActionResult & { token?: string }> {
  try {
    const [orgId, user, db] = await Promise.all([getCurrentOrgId(), getCurrentUser(), getDb()])
    const token = randomUUID().replace(/-/g, "")
    const now = new Date().toISOString()
    const mode = input.mode ?? "link"
    const role = input.role ?? "view"

    const shareRef = db.collection(orgPostSharesPath(orgId, input.postId)).doc()
    await shareRef.set({ id: shareRef.id, postId: input.postId, mode, role, token, createdAt: now })

    // Flat token->{orgId,postId} lookup for unauthenticated resolution
    await db.doc(`${shareTokensPath()}/${token}`).set({ orgId, postId: input.postId, role, createdAt: now })

    await writePostActivity(orgId, input.postId, user.id, "edit", { action: "share_created", mode }, db)
    revalidatePath("/posts")
    return { ok: true, id: shareRef.id, token }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function setShareMode(input: {
  postId: string
  shareId: string
  mode: Share["mode"]
}): Promise<ServerActionResult> {
  try {
    const [orgId, db] = await Promise.all([getCurrentOrgId(), getDb()])
    const ref = db.doc(`${orgPostSharesPath(orgId, input.postId)}/${input.shareId}`)
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, error: "Share not found" }
    await ref.set({ mode: input.mode, updatedAt: new Date().toISOString() }, { merge: true })
    // Update token lookup mode
    const token = snap.data()?.token as string | undefined
    if (token) await db.doc(`${shareTokensPath()}/${token}`).set({ mode: input.mode }, { merge: true })
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function revokeShare(input: {
  postId: string
  shareId: string
}): Promise<ServerActionResult> {
  try {
    const [orgId, user, db] = await Promise.all([getCurrentOrgId(), getCurrentUser(), getDb()])
    const ref = db.doc(`${orgPostSharesPath(orgId, input.postId)}/${input.shareId}`)
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, error: "Share not found" }
    const token = snap.data()?.token as string | undefined
    await ref.delete()
    if (token) await db.doc(`${shareTokensPath()}/${token}`).delete()
    await writePostActivity(orgId, input.postId, user.id, "edit", { action: "share_revoked" }, db)
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function makePostPrivate(input: { postId: string }): Promise<ServerActionResult> {
  try {
    const [orgId, user, db] = await Promise.all([getCurrentOrgId(), getCurrentUser(), getDb()])
    const snap = await db.collection(orgPostSharesPath(orgId, input.postId)).get()
    const batch = db.batch()
    const tokenDels: Promise<unknown>[] = []
    for (const doc of snap.docs) {
      batch.delete(doc.ref)
      const token = doc.data().token as string | undefined
      if (token) tokenDels.push(db.doc(`${shareTokensPath()}/${token}`).delete())
    }
    await batch.commit()
    await Promise.allSettled(tokenDels)
    await writePostActivity(orgId, input.postId, user.id, "edit", { action: "made_private" }, db)
    revalidatePath("/posts")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

/** Server-only token resolver - NOT a "use server" action. Used by the public route. */
export async function resolveShareToken(
  token: string,
): Promise<{ orgId: string; postId: string; role: Share["role"] } | null> {
  try {
    const db = getDb()
    const snap = await db.doc(`${shareTokensPath()}/${token}`).get()
    if (!snap.exists) return null
    const data = snap.data()
    if (!data) return null
    return {
      orgId: data.orgId as string,
      postId: data.postId as string,
      role: (data.role as Share["role"]) ?? "view",
    }
  } catch {
    return null
  }
}

/** Public-safe approve action - resolves via token, no session cookie required. */
export async function approveViaShareToken(input: {
  token: string
  requestChanges?: boolean
}): Promise<ServerActionResult> {
  try {
    const db = getDb()
    const resolved = await resolveShareToken(input.token)
    if (!resolved) return { ok: false, error: "Invalid or expired share link" }

    const { orgId, postId } = resolved
    const ref = db.collection("organizations").doc(orgId).collection("posts").doc(postId)
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, error: "Post not found" }

    const now = new Date().toISOString()
    if (input.requestChanges) {
      await ref.set({ status: "review", updatedAt: now }, { merge: true })
      await writePostActivity(orgId, postId, "client", "status", { from: snap.data()?.status, to: "review", via: "share_link" }, db)
    } else {
      // Auto-advance: Client Review -> Approved (set status to "scheduled" if not already)
      const prevStatus = snap.data()?.status as string | undefined
      await ref.set({ status: "scheduled", updatedAt: now }, { merge: true })
      await writePostActivity(orgId, postId, "client", "status", { from: prevStatus, to: "scheduled", via: "share_link" }, db)
    }

    revalidatePath("/posts")
    revalidatePath("/calendar")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}
