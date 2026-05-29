import type { ChannelKey } from "@/lib/schemas/_shared"
import type { Post } from "@/lib/schemas/post"
import type { ChannelRules, ValidationResult } from "./types"

/* Official platform content caps (text length, media counts). */
export const CHANNEL_RULES: Record<ChannelKey, ChannelRules> = {
  x: { maxTextLength: 280, maxImages: 4, maxVideos: 1, allowsMixedMedia: false },
  instagram: { maxTextLength: 2200, maxImages: 10, maxVideos: 1, mediaRequired: true },
  facebook: { maxTextLength: 63206, maxImages: 10, maxVideos: 1 },
  linkedin: { maxTextLength: 3000, maxImages: 9, maxVideos: 1 },
  fb_groups: { maxTextLength: 63206, maxImages: 10, maxVideos: 1 },
  website: {},
}

const VIDEO_RE = /\.(mp4|mov|webm|m4v)(\?|$)/i

function postText(post: Post): string {
  return [post.blurb ?? "", (post.hashtags ?? []).map((h) => `#${h}`).join(" ")]
    .filter(Boolean)
    .join(" ")
    .trim()
}

function mediaCounts(post: Post): { images: number; videos: number } {
  const urls = post.assetUrls ?? []
  const videos = urls.filter((u) => VIDEO_RE.test(u)).length
  return { images: urls.length - videos, videos }
}

export function validatePost(channel: ChannelKey, post: Post): ValidationResult {
  const rules = CHANNEL_RULES[channel]
  const text = postText(post)
  const { images, videos } = mediaCounts(post)

  if (rules.maxTextLength && text.length > rules.maxTextLength) {
    return { ok: false, reason: `Text exceeds ${rules.maxTextLength} characters for ${channel}.` }
  }
  if (rules.mediaRequired && images + videos === 0) {
    return { ok: false, reason: `${channel} requires at least one image or video.` }
  }
  if (rules.maxImages !== undefined && images > rules.maxImages) {
    return { ok: false, reason: `${channel} allows at most ${rules.maxImages} images.` }
  }
  if (rules.maxVideos !== undefined && videos > rules.maxVideos) {
    return { ok: false, reason: `${channel} allows at most ${rules.maxVideos} video.` }
  }
  if (rules.allowsMixedMedia === false && images > 0 && videos > 0) {
    return { ok: false, reason: `${channel} cannot mix images and video in one post.` }
  }
  return { ok: true }
}
