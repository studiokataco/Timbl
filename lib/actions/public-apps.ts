"use server"

import { revalidatePath } from "next/cache"

import { getCurrentOrgId, requireRole } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgPublicAppsPath } from "@/lib/firebase/paths"
import { encrypt, hashApiKey } from "@/lib/publishing/crypto"
import { type PublicScope } from "@/lib/auth/public-scopes"
import type { PublicApp } from "@/lib/schemas/publicApp"
import type { ServerActionResult } from "@/lib/schemas"

async function requireOwner(): Promise<{ orgId: string; userId: string }> {
  const user = await requireRole(["admin"])
  const orgId = await getCurrentOrgId()
  return { orgId, userId: user.id }
}

function generateKey(): string {
  const rand = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")
  return `tmbl_pk_${rand}`
}

export async function createPublicApp(
  name: string,
  scopes: PublicScope[],
): Promise<ServerActionResult & { key?: string; appId?: string }> {
  const { orgId, userId } = await requireOwner()
  const db = getAdminDb()

  const key = generateKey()
  const prefix = key.slice(0, 14)
  const [keyHash, keyCiphertext] = await Promise.all([
    hashApiKey(key),
    Promise.resolve(encrypt(key)),
  ])

  const ref = db.collection(orgPublicAppsPath(orgId)).doc()
  const now = new Date().toISOString()
  const app: Omit<PublicApp, "id"> & { id: string } = {
    id: ref.id,
    organizationId: orgId,
    name,
    keyPrefix: prefix,
    keyHash,
    keyCiphertext,
    scopes,
    rateTier: "free",
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  }

  await ref.set(app)
  revalidatePath("/settings/integrations")
  return { ok: true, key, appId: ref.id }
}

export async function listPublicApps(): Promise<PublicApp[]> {
  const { orgId } = await requireOwner()
  const snap = await getAdminDb()
    .collection(orgPublicAppsPath(orgId))
    .where("revokedAt", "==", null)
    .orderBy("createdAt", "desc")
    .get()
  return snap.docs.map((d) => d.data() as PublicApp)
}

export async function rotateKey(
  appId: string,
): Promise<ServerActionResult & { key?: string }> {
  const { orgId } = await requireOwner()
  const db = getAdminDb()
  const ref = db.collection(orgPublicAppsPath(orgId)).doc(appId)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "App not found" }

  const key = generateKey()
  const [keyHash, keyCiphertext] = await Promise.all([
    hashApiKey(key),
    Promise.resolve(encrypt(key)),
  ])

  await ref.update({
    keyPrefix: key.slice(0, 14),
    keyHash,
    keyCiphertext,
    updatedAt: new Date().toISOString(),
  })

  revalidatePath("/settings/integrations")
  return { ok: true, key }
}

export async function revokePublicApp(appId: string): Promise<ServerActionResult> {
  const { orgId } = await requireOwner()
  const ref = getAdminDb().collection(orgPublicAppsPath(orgId)).doc(appId)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "App not found" }

  await ref.update({ revokedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  revalidatePath("/settings/integrations")
  return { ok: true }
}
