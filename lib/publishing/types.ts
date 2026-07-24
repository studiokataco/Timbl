import type { ChannelKey } from "@/lib/schemas/_shared"
import type { Post } from "@/lib/schemas/post"
import type { SocialAccount } from "@/lib/schemas/socialAccount"

/*
 * Per-channel content constraints. Surfaced to the reviewer agent and
 * re-checked at the publish boundary so a draft fails early, not at the API.
 */
export type ChannelRules = {
  maxTextLength?: number
  maxImages?: number
  maxVideos?: number
  /* At least one asset is required (e.g. Instagram). */
  mediaRequired?: boolean
  /* Whether images and a video can be mixed in one post. */
  allowsMixedMedia?: boolean
}

/*
 * Four-way result every adapter classifies its own failures into. The worker
 * stays platform-agnostic: ok→published, retry→leave scheduled, bad_body→
 * failed, needs_reauth→flag account.
 */
export type PublishResult =
  | { kind: "ok"; externalId: string; url?: string }
  | { kind: "retry"; reason: string }
  | { kind: "bad_body"; reason: string }
  | { kind: "needs_reauth"; reason: string }

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export interface Publisher {
  key: ChannelKey
  rules: ChannelRules
  connect(orgId: string, brandId: string): Promise<{ url: string; state: string }>
  /* The publisher does not know which brand the connection is for - the OAuth
   * callback route reads that from the signed state and stamps brandId on. */
  callback(orgId: string, code: string, state: string): Promise<Omit<SocialAccount, "brandId">>
  refresh(account: SocialAccount): Promise<SocialAccount>
  validate(post: Post): ValidationResult
  publish(account: SocialAccount, post: Post): Promise<PublishResult>
}
