import "server-only"

import { PostHog } from "posthog-node"

let ph: PostHog | null = null

function getPostHog(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (!ph)
    ph = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    })
  return ph
}

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
  groups?: Record<string, string>,
): void {
  getPostHog()?.capture({ distinctId, event, properties, groups })
}

export function identifyServerGroup(
  groupType: string,
  groupKey: string,
  properties: Record<string, unknown>,
): void {
  getPostHog()?.groupIdentify({ groupType, groupKey, properties })
}
