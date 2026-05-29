import { z } from "zod"
import { audit, channelKey, isoTimestamp } from "./_shared"

export const socialAccountStatus = z.enum(["active", "needs_reauth", "revoked"])
export type SocialAccountStatus = z.infer<typeof socialAccountStatus>

/*
 * Token vault doc. id = `${channel}:${externalId}`. Tokens are stored
 * encrypted (AES-256-GCM via lib/publishing/crypto) and decrypted only
 * in-memory inside the publish worker — never returned to the client.
 */
export const socialAccountSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  channel: channelKey,
  displayName: z.string(),
  externalId: z.string(),
  accessTokenEnc: z.string(),
  refreshTokenEnc: z.string().optional(),
  expiresAt: isoTimestamp.optional(),
  scopes: z.array(z.string()).default([]),
  status: socialAccountStatus.default("active"),
})
export type SocialAccount = z.infer<typeof socialAccountSchema>

/* Client-safe projection — strips every token field. */
export const socialAccountPublicSchema = socialAccountSchema.omit({
  accessTokenEnc: true,
  refreshTokenEnc: true,
})
export type SocialAccountPublic = z.infer<typeof socialAccountPublicSchema>
