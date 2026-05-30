"use client"

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import { signInAnonymously } from "firebase/auth"
import { useEffect } from "react"
import { getClientAuth, getClientDb } from "@/lib/firebase/client"
import { orgPostsPath } from "@/lib/firebase/paths"
import type { QueryClient } from "@tanstack/react-query"

/*
 * Subscribes to real-time changes on posts in the visible window. Calls
 * QueryClient.invalidateQueries on every snapshot so the calendar's
 * useQuery refetches and re-renders.
 *
 * Pre-Phase 7 (no real Firebase Auth user) the security rules reject
 * unauthenticated reads. We attempt anonymous sign-in to get past the
 * rule - works only if Anonymous provider is enabled in the console.
 * If sign-in or the snapshot fails we log and bail; mutations still
 * reconcile through router.refresh() + queryClient invalidation.
 */
export function usePostsRealtime(opts: {
  orgId: string
  start: string
  end: string
  queryClient: QueryClient
  enabled?: boolean
}) {
  const { orgId, start, end, queryClient, enabled = true } = opts
  useEffect(() => {
    if (!enabled) return
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return
    if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "demo-api-key") return

    let unsub: (() => void) | undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        const auth = getClientAuth()
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth)
          } catch (err) {
            console.warn("[realtime] anon sign-in failed; realtime disabled", err)
            return
          }
        }
        if (cancelled) return
        const db = getClientDb()
        const q = query(
          collection(db, orgPostsPath(orgId)),
          where("scheduledDate", ">=", start),
          where("scheduledDate", "<=", end),
          orderBy("scheduledDate", "asc"),
        )
        unsub = onSnapshot(
          q,
          () =>
            queryClient.invalidateQueries({
              queryKey: ["posts", orgId, start, end],
            }),
          (err) => {
            console.warn("[realtime] posts snapshot error", err)
          },
        )
      } catch (err) {
        console.warn("[realtime] init failed", err)
      }
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
      try {
        unsub?.()
      } catch {}
    }
  }, [orgId, start, end, queryClient, enabled])
}
