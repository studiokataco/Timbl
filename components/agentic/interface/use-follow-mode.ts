"use client"

import { useCallback, useEffect, useState } from "react"
import { useAnnounce } from "../live-announcer"
import { usePrototype } from "../prototype-context"
import type { TeamMember } from "../types"

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

export function useFollowMode(
  peers: TeamMember[],
  regionRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
): {
  following: string | null
  follow: (userId: string) => void
  stop: () => void
} {
  const { copy, prefs } = usePrototype()
  const announce = useAnnounce()
  const [following, setFollowing] = useState<string | null>(null)

  const stop = useCallback(() => {
    setFollowing((prev) => {
      if (prev) announce(copy.iface.cursors.stop)
      return null
    })
  }, [announce, copy.iface.cursors.stop])

  const follow = useCallback(
    (userId: string) => {
      const peer = peers.find((p) => p.id === userId)
      if (!peer) return
      setFollowing(userId)
      announce(copy.iface.cursors.following(peer.name))
    },
    [announce, copy.iface.cursors, peers],
  )

  useEffect(() => {
    const el = regionRef.current
    if (!el || !enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && following) {
        e.preventDefault()
        stop()
        return
      }
      if (!prefs.shortcuts || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "f" || e.key === "F") {
        e.preventDefault()
        if (peers.length === 0) return
        const idx = following ? peers.findIndex((p) => p.id === following) : -1
        const next = peers[(idx + 1) % peers.length]
        if (next) follow(next.id)
      } else if (following) {
        stop()
      }
    }
    const onWheel = () => {
      if (following) stop()
    }
    const onPointerDown = () => {
      if (following) stop()
    }
    el.addEventListener("keydown", onKeyDown)
    el.addEventListener("wheel", onWheel, { passive: true })
    el.addEventListener("pointerdown", onPointerDown)
    return () => {
      el.removeEventListener("keydown", onKeyDown)
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("pointerdown", onPointerDown)
    }
  }, [enabled, follow, following, peers, prefs.shortcuts, regionRef, stop])

  return { following, follow, stop }
}
