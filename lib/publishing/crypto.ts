import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/*
 * AES-256-GCM token encryption. The key is derived (sha256 → 32 bytes) from
 * SOCIAL_TOKEN_KEY (a Secret-Manager value). Ciphertext is stored as
 * `iv:tag:ct`, all base64. Plaintext tokens never get logged or returned to
 * the client - they live only in-memory inside the publish worker.
 */

const ALGO = "aes-256-gcm"

function key(): Buffer {
  const secret = process.env.SOCIAL_TOKEN_KEY
  if (!secret) {
    throw new Error("SOCIAL_TOKEN_KEY is not configured")
  }
  return createHash("sha256").update(secret, "utf8").digest()
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`
}

export function decrypt(ciphertext: string): string {
  const [ivB64, tagB64, ctB64] = ciphertext.split(":")
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed ciphertext")
  }
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
