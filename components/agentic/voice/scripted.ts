"use client"

import { useEffect } from "react"
import type { EngineEvent } from "../types"

export type ScriptedVoice = "shorter" | "approve" | "reschedule"

let sent = false

export function scriptedVoiceParam(): ScriptedVoice | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.search).get("voice")
  if (value === "shorter" || value === "approve" || value === "reschedule") return value
  return null
}

export function scriptedAudio(): boolean {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("audio") === "scripted"
}

export function useScriptedUtterance(dispatch: (event: EngineEvent) => void, deckPostId: string | null) {
  useEffect(() => {
    if (sent) return
    const voice = scriptedVoiceParam()
    if (!voice || !deckPostId) return
    sent = true
    if (voice === "shorter" && deckPostId) {
      dispatch({ type: "deck_refine", postId: deckPostId, kind: "shorter" })
      return
    }
    if (voice === "approve" && deckPostId) {
      dispatch({ type: "deck_decided", postId: deckPostId, outcome: "approved" })
      return
    }
    dispatch({ type: "user_sent", text: "reschedule the carousel to Friday 18:00", source: "voice" })
  }, [deckPostId, dispatch])
}
