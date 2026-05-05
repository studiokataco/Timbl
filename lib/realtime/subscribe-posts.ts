"use client"

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore"
import { useEffect } from "react"
import { getClientDb } from "@/lib/firebase/client"
import { orgPostsPath } from "@/lib/firebase/paths"
import type { QueryClient } from "@tanstack/react-query"

/*
 * Subscribes to real-time changes on posts in the visible window. Calls
 * QueryClient.invalidateQueries on every snapshot so the calendar's
 * useQuery refetches and re-renders.
 *
 * NOTE: until Phase 7 the client-side Firestore SDK runs against the
 * emulator only when the app is configured to talk to it. For Phase 2 we
 * simply skip the subscription if no real Firebase config is present —
 * the calendar still updates after every server-action mutation via the
 * router refresh, just without cross-tab realtime.
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
    try {
      const db = getClientDb()
      const q = query(
        collection(db, orgPostsPath(orgId)),
        where("scheduledDate", ">=", start),
        where("scheduledDate", "<=", end),
        orderBy("scheduledDate", "asc"),
      )
      unsub = onSnapshot(
        q,
        () => queryClient.invalidateQueries({ queryKey: ["posts", orgId, start, end] }),
        () => undefined,
      )
    } catch {
      /* No-op — realtime is best-effort during dev. */
    }
    return () => {
      unsub?.()
    }
  }, [orgId, start, end, queryClient, enabled])
}
