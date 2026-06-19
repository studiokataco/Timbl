import { z } from "zod"
import { audit, isoTimestamp, storageProvider } from "./_shared"

export const storageAccountStatus = z.enum(["active", "needs_reauth", "revoked"])
export type StorageAccountStatus = z.infer<typeof storageAccountStatus>

/*
 * Connected cloud-storage account token vault. id = `${provider}:${externalId}`.
 * Tokens are AES-256-GCM encrypted (lib/publishing/crypto) and never returned
 * to the client - the public projection strips them.
 */
export const storageAccountSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  provider: storageProvider,
  displayName: z.string(),
  externalId: z.string(),
  accessTokenEnc: z.string(),
  refreshTokenEnc: z.string().optional(),
  expiresAt: isoTimestamp.optional(),
  scopes: z.array(z.string()).default([]),
  status: storageAccountStatus.default("active"),
})
export type StorageAccount = z.infer<typeof storageAccountSchema>

export const storageAccountPublicSchema = storageAccountSchema.omit({
  accessTokenEnc: true,
  refreshTokenEnc: true,
})
export type StorageAccountPublic = z.infer<typeof storageAccountPublicSchema>
