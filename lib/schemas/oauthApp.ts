import { z } from "zod"
import { audit, channelKey } from "./_shared"

/*
 * Per-org OAuth app credentials for the publishing layer. One doc per
 * channel — id is the channel key. Credentials are AES-256-GCM encrypted
 * with SOCIAL_TOKEN_KEY (same key as the social token vault) and decrypted
 * only inside server-side publish helpers. Lets org admins manage the
 * platform-side OAuth pairs from the UI without redeploying the backend.
 */
export const oauthAppSchema = audit.extend({
  id: channelKey,
  organizationId: z.string(),
  channel: channelKey,
  clientIdEnc: z.string(),
  clientSecretEnc: z.string(),
})
export type OauthApp = z.infer<typeof oauthAppSchema>

/* Client-safe projection — strips every credential field. */
export const oauthAppPublicSchema = oauthAppSchema.omit({
  clientIdEnc: true,
  clientSecretEnc: true,
})
export type OauthAppPublic = z.infer<typeof oauthAppPublicSchema>
