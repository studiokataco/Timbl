"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import type { ReactNode } from "react"

/*
 * Exposes the PostHog client (initialized in instrumentation-client.ts) to the
 * React tree so components can `usePostHog()` for custom event capture and,
 * once auth ships in Phase 7, identify(). When analytics is disabled (no key
 * or emulator mode) the client is simply un-initialized and the hooks no-op.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>
}
