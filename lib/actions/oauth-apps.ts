"use server"

import { revalidatePath } from "next/cache"

import { getCurrentOrgId, getCurrentUser } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgOauthAppsPath } from "@/lib/firebase/paths"
import { encrypt } from "@/lib/publishing/crypto"
import { invalidateOauthAppCache, redirectUri } from "@/lib/publishing/oauth"
import { channelKey, type ChannelKey } from "@/lib/schemas/_shared"
import type { ServerActionResult } from "@/lib/schemas"

/* Channel keys that share one Meta App ID/Secret. Setting "facebook" or
 * "instagram" from the UI writes both docs so the admin only enters the
 * Meta credentials once. */
const META_GROUP: ChannelKey[] = ["facebook", "instagram"]

function targetsFor(channel: ChannelKey): ChannelKey[] {
  return META_GROUP.includes(channel) ? META_GROUP : [channel]
}

async function requireAdmin(): Promise<{ orgId: string; userId: string }> {
  const user = await getCurrentUser()
  if (user.role !== "admin") {
    throw new Error("Only org admins can manage OAuth credentials")
  }
  const orgId = await getCurrentOrgId()
  return { orgId, userId: user.id }
}

/* Persist a channel's OAuth client_id + client_secret. Values are encrypted
 * with SOCIAL_TOKEN_KEY before writing - Firestore only ever sees ciphertext.
 * For Meta both facebook and instagram docs are written from one input pair. */
export async function setPlatformOauthApp(
  channel: ChannelKey,
  clientId: string,
  clientSecret: string,
): Promise<ServerActionResult> {
  const validChannel = channelKey.safeParse(channel)
  if (!validChannel.success) return { ok: false, error: "Invalid channel" }
  const trimmedId = clientId.trim()
  const trimmedSecret = clientSecret.trim()
  if (!trimmedId || !trimmedSecret) {
    return { ok: false, error: "Both client ID and client secret are required" }
  }

  const { orgId, userId } = await requireAdmin()
  const now = new Date().toISOString()
  const db = getAdminDb()
  const batch = db.batch()
  for (const target of targetsFor(validChannel.data)) {
    const ref = db.doc(`${orgOauthAppsPath(orgId)}/${target}`)
    batch.set(
      ref,
      {
        id: target,
        organizationId: orgId,
        channel: target,
        clientIdEnc: encrypt(trimmedId),
        clientSecretEnc: encrypt(trimmedSecret),
        createdAt: now,
        createdBy: userId,
        updatedAt: now,
        updatedBy: userId,
      },
      { merge: true },
    )
    invalidateOauthAppCache(orgId, target)
  }
  await batch.commit()

  revalidatePath("/settings/channels")
  return { ok: true, id: validChannel.data }
}

export async function clearPlatformOauthApp(
  channel: ChannelKey,
): Promise<ServerActionResult> {
  const validChannel = channelKey.safeParse(channel)
  if (!validChannel.success) return { ok: false, error: "Invalid channel" }

  const { orgId } = await requireAdmin()
  const db = getAdminDb()
  const batch = db.batch()
  for (const target of targetsFor(validChannel.data)) {
    batch.delete(db.doc(`${orgOauthAppsPath(orgId)}/${target}`))
    invalidateOauthAppCache(orgId, target)
  }
  await batch.commit()

  revalidatePath("/settings/channels")
  return { ok: true, id: validChannel.data }
}

/* List which channels currently have an OAuth app configured for this org.
 * Used by the channels page to render Setup vs. Connect affordances. */
export async function listConfiguredChannels(): Promise<ChannelKey[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb().collection(orgOauthAppsPath(orgId)).get()
  return snap.docs
    .map((d) => channelKey.safeParse(d.id))
    .filter((r): r is { success: true; data: ChannelKey } => r.success)
    .map((r) => r.data)
}

/* Public redirect URI for a channel - surfaced verbatim in the Setup UI
 * so admins copy-paste it into the platform's developer console. */
export async function getChannelRedirectUri(channel: ChannelKey): Promise<string> {
  return redirectUri(channel)
}
