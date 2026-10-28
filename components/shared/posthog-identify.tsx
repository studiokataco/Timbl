"use client"

import { usePostHog } from "posthog-js/react"
import { useEffect } from "react"

/* Ties replays and client events to the same person and workspace as the
 * server-side activation events. Skipped while impersonating so a platform
 * admin's session never merges into the tenant's profile. */
export function PostHogIdentify({
  userId,
  email,
  name,
  orgId,
  orgName,
  impersonating,
}: {
  userId: string
  email: string | null
  name: string
  orgId: string
  orgName: string
  impersonating: boolean
}) {
  const posthog = usePostHog()

  useEffect(() => {
    if (!posthog?.__loaded || impersonating) return
    posthog.identify(userId, { email, name })
    posthog.group("organization", orgId, { name: orgName })
  }, [posthog, userId, email, name, orgId, orgName, impersonating])

  return null
}
