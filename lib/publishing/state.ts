import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/*
 * Signed OAuth `state` - CSRF guard + cross-org binding + brand binding. Format:
 *   base64url(`${orgId}.${brandId}.${ts}.${nonce}`) + "." + hmac
 * HMAC keyed off SOCIAL_TOKEN_KEY. verifyState confirms the signature and that
 * the bound org matches the callback's org within a 15-minute window, and
 * returns the brand the connect flow targeted so the callback can stamp it on
 * the new account.
 */

import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"

const MAX_AGE_MS = 15 * 60 * 1000

function secret(): string {
  const s = process.env.SOCIAL_TOKEN_KEY
  if (!s) throw new Error("SOCIAL_TOKEN_KEY is not configured")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function signState(orgId: string, brandId: string = DEFAULT_BRAND_ID): string {
  const nonce = randomBytes(16).toString("base64url")
  const payload = Buffer.from(
    `${orgId}.${brandId}.${Date.now()}.${nonce}`,
  ).toString("base64url")
  return `${payload}.${sign(payload)}`
}

/* Returns the bound brandId on success, or null when the state is forged,
 * bound to a different org, or expired. */
export function verifyState(orgId: string, state: string): string | null {
  const [payload, mac] = state.split(".")
  if (!payload || !mac) return null
  const expected = sign(payload)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  const [boundOrg, brandId, tsRaw] = Buffer.from(payload, "base64url")
    .toString()
    .split(".")
  if (boundOrg !== orgId) return null
  const ts = Number(tsRaw)
  if (!Number.isFinite(ts) || Date.now() - ts >= MAX_AGE_MS) return null
  return brandId || DEFAULT_BRAND_ID
}
