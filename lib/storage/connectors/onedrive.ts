import "server-only"

import { encrypt } from "@/lib/publishing/crypto"
import { expiresAtIso } from "@/lib/publishing/oauth"
import { signState } from "@/lib/publishing/state"
import { loadStoragePlatformApp, storageRedirectUri } from "@/lib/storage/oauth"
import { getStorageProviderDef } from "@/lib/storage/providers"

import type { StorageConnector } from "./index"

const PROVIDER = "onedrive"
const ME_URL = "https://graph.microsoft.com/v1.0/me"

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

export const onedriveConnector: StorageConnector = {
  async connect(orgId) {
    const creds = loadStoragePlatformApp(PROVIDER)
    const def = getStorageProviderDef(PROVIDER)!
    const state = signState(orgId)
    const url = `${def.authorizeUrl}?${new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: storageRedirectUri(PROVIDER),
      response_type: "code",
      scope: def.scopes.join(" "),
      state,
      response_mode: "query",
    })}`
    return { url }
  },

  async callback(orgId, code) {
    const creds = loadStoragePlatformApp(PROVIDER)
    const def = getStorageProviderDef(PROVIDER)!
    const res = await fetch(def.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: storageRedirectUri(PROVIDER),
      }),
    })
    const token = (await res.json()) as TokenResponse
    if (!token.access_token) {
      throw new Error(`OneDrive token exchange failed (${res.status})`)
    }
    const me = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    if (!me.ok) throw new Error(`OneDrive profile lookup failed (${me.status})`)
    const profile = (await me.json()) as {
      id: string
      displayName?: string
      userPrincipalName: string
      mail?: string
    }
    const externalId = profile.id
    const displayName = profile.displayName || profile.userPrincipalName
    const now = new Date().toISOString()
    return {
      id: `${PROVIDER}:${externalId}`,
      organizationId: orgId,
      provider: PROVIDER,
      displayName,
      externalId,
      accessTokenEnc: encrypt(token.access_token),
      refreshTokenEnc: token.refresh_token ? encrypt(token.refresh_token) : undefined,
      expiresAt: expiresAtIso(token.expires_in),
      scopes: def.scopes,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }
  },
}
