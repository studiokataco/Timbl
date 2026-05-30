import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

/*
 * Signed OAuth `state` - CSRF guard + cross-org binding. Format:
 *   base64url(`${orgId}.${ts}.${nonce}`) + "." + hmac
 * HMAC keyed off SOCIAL_TOKEN_KEY. verifyState confirms the signature and
 * that the bound org matches the callback's org, within a 15-minute window.
 */

const MAX_AGE_MS = 15 * 60 * 1000

function secret(): string {
  const s = process.env.SOCIAL_TOKEN_KEY
  if (!s) throw new Error("SOCIAL_TOKEN_KEY is not configured")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function signState(orgId: string): string {
  const nonce = randomBytes(16).toString("base64url")
  const payload = Buffer.from(`${orgId}.${Date.now()}.${nonce}`).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function verifyState(orgId: string, state: string): boolean {
  const [payload, mac] = state.split(".")
  if (!payload || !mac) return false
  const expected = sign(payload)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const [boundOrg, tsRaw] = Buffer.from(payload, "base64url").toString().split(".")
  if (boundOrg !== orgId) return false
  const ts = Number(tsRaw)
  return Number.isFinite(ts) && Date.now() - ts < MAX_AGE_MS
}
