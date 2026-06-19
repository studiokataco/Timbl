"use server"

import { revalidatePath } from "next/cache"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgStorageAccountsPath } from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"
import { decrypt, encrypt } from "@/lib/publishing/crypto"
import { expiresAtIso } from "@/lib/publishing/oauth"
import { loadStoragePlatformApp } from "@/lib/storage/oauth"
import { getStorageProviderDef } from "@/lib/storage/providers"
import {
  storageAccountPublicSchema,
  storageAccountSchema,
  type ServerActionResult,
  type StorageAccountPublic,
  type StorageProvider,
} from "@/lib/schemas"

export async function listStorageAccounts(): Promise<WithId<StorageAccountPublic>[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getDb().collection(orgStorageAccountsPath(orgId)).get()
  const out: WithId<StorageAccountPublic>[] = []
  for (const d of snap.docs) {
    const parsed = storageAccountPublicSchema.safeParse(snapToData(d))
    if (parsed.success) out.push(parsed.data as WithId<StorageAccountPublic>)
  }
  return out
}

export async function disconnectStorageAccount(id: string): Promise<ServerActionResult> {
  if (!id) return { ok: false, error: "Missing account id" }
  const orgId = await getCurrentOrgId()
  await getDb().doc(`${orgStorageAccountsPath(orgId)}/${id}`).delete()
  revalidatePath("/settings/integrations")
  return { ok: true, id }
}

/* Admin SDK read - the full doc carries the encrypted token fields that the
 * public projection strips. Only the minted access token ever leaves here. */
export async function getStorageAccessToken(
  accountId: string,
): Promise<
  | { ok: true; token: string; provider: StorageProvider }
  | { ok: false; error: string }
> {
  if (!accountId) return { ok: false, error: "Missing account id" }
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb().doc(`${orgStorageAccountsPath(orgId)}/${accountId}`)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "Account not found" }
  const parsed = storageAccountSchema.safeParse(snapToData(snap))
  if (!parsed.success) return { ok: false, error: "Account not found" }
  const account = parsed.data

  const expired =
    account.expiresAt !== undefined &&
    Date.parse(account.expiresAt) <= Date.now()

  if (expired && account.refreshTokenEnc) {
    const def = getStorageProviderDef(account.provider)
    if (!def) return { ok: false, error: "Reconnect needed" }
    try {
      const creds = loadStoragePlatformApp(account.provider)
      const res = await fetch(def.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: decrypt(account.refreshTokenEnc),
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        }),
      })
      if (!res.ok) throw new Error(`storage token refresh failed: ${res.status}`)
      const token = (await res.json()) as {
        access_token: string
        expires_in?: number
        refresh_token?: string
      }
      const now = new Date().toISOString()
      await ref.update({
        accessTokenEnc: encrypt(token.access_token),
        refreshTokenEnc: token.refresh_token
          ? encrypt(token.refresh_token)
          : account.refreshTokenEnc,
        expiresAt: expiresAtIso(token.expires_in) ?? account.expiresAt,
        status: "active",
        updatedAt: now,
      })
      return { ok: true, token: token.access_token, provider: account.provider }
    } catch {
      await ref.update({
        status: "needs_reauth",
        updatedAt: new Date().toISOString(),
      })
      return { ok: false, error: "Reconnect needed" }
    }
  }

  return {
    ok: true,
    token: decrypt(account.accessTokenEnc),
    provider: account.provider,
  }
}
