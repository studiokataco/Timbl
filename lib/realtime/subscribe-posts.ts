"use client"

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import type { User } from "firebase/auth"
import { useEffect } from "react"
import { usePostHog } from "posthog-js/react"
import { reportRealtimeDegrade } from "@/lib/actions/realtime-health"
import { getClientAuth, getClientDb } from "@/lib/firebase/client"
import { useRealtimeDegraded } from "@/lib/realtime/degraded-state"
import { orgPostsPath } from "@/lib/firebase/paths"
import type { QueryClient } from "@tanstack/react-query"

/*
 * Live-updates listener for the posts in the visible window. STRICTLY
 * ADDITIVE: every surface already renders from server-fetched data (Admin SDK,
 * rules-immune), so this only triggers refetches. It must never throw, block a
 * render, or leave a surface stale with no recovery path.
 *
 * Engagement is gated server-side via `enabled` (the resolved `realtime_v1`
 * flag - see realtime-enabled.ts). Even when enabled it only runs for a real,
 * non-anonymous signed-in user whose org claim satisfies firestore.rules. When
 * realtime can't run - no user yet, claim denied, snapshot error - it degrades
 * to a slow polling refetch so cross-tab data still converges, and reports the
 * degradation to telemetry. Never `signInAnonymously` (anon has no org claim,
 * so the read is guaranteed denied).
 */

const POLL_FALLBACK_MS = 60_000

export function usePostsRealtime(opts: {
  orgId: string
  start: string
  end: string
  queryClient: QueryClient
  enabled?: boolean
}) {
  const { orgId, start, end, queryClient, enabled = true } = opts
  const posthog = usePostHog()
  const { setDegraded } = useRealtimeDegraded()

  useEffect(() => {
    if (!enabled) return
    /* Testing accounts / dev shim: no real client auth user, so realtime would
     * only hit denied reads. Server fetch + invalidation already keep dev fresh. */
    if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1") return
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (!apiKey || apiKey === "demo-api-key") return

    let snapshotUnsub: (() => void) | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let cancelled = false
    let degradeReported = false

    const refetch = () =>
      queryClient.invalidateQueries({ queryKey: ["posts", orgId] })

    const startPolling = (reason: string) => {
      if (pollTimer || cancelled) return
      pollTimer = setInterval(refetch, POLL_FALLBACK_MS)
      setDegraded(true)
      if (!degradeReported) {
        degradeReported = true
        posthog?.capture?.("realtime_degraded", { orgId, reason })
        void reportRealtimeDegrade({ orgId, reason }).catch(() => {})
      }
    }

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = undefined
      setDegraded(false)
    }

    const subscribe = (user: User | null) => {
      if (cancelled) return
      /* No real user (or anonymous) -> org-claim rule denies the read. Hold on
       * polling until auth resolves; onIdTokenChanged re-runs this on sign-in. */
      if (!user || user.isAnonymous) {
        startPolling("no_authenticated_user")
        return
      }
      try {
        const db = getClientDb()
        const q = query(
          collection(db, orgPostsPath(orgId)),
          where("scheduledDate", ">=", start),
          where("scheduledDate", "<=", end),
          orderBy("scheduledDate", "asc"),
        )
        snapshotUnsub = onSnapshot(
          q,
          () => {
            /* Live and healthy - stop any fallback polling. */
            stopPolling()
            refetch()
          },
          (err) => {
            /* permission-denied / unavailable - degrade, never throw. */
            console.warn("[realtime] posts snapshot error", err)
            try {
              snapshotUnsub?.()
            } catch {}
            snapshotUnsub = undefined
            startPolling((err as { code?: string })?.code ?? "snapshot_error")
          },
        )
      } catch (err) {
        console.warn("[realtime] init failed", err)
        startPolling("init_failed")
      }
    }

    const auth = getClientAuth()
    /* Re-evaluate on every auth/token change: handles the initial null->user
     * race and the claim landing after first-login activation. */
    const authUnsub = auth.onIdTokenChanged((user) => {
      try {
        snapshotUnsub?.()
      } catch {}
      snapshotUnsub = undefined
      subscribe(user)
    })

    return () => {
      cancelled = true
      stopPolling()
      try {
        authUnsub()
      } catch {}
      try {
        snapshotUnsub?.()
      } catch {}
    }
  }, [orgId, start, end, queryClient, enabled, posthog, setDegraded])
}
