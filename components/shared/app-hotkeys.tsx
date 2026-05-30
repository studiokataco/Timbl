"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useDialogs } from "@/components/shared/dialogs-provider"

const NAV_BY_DIGIT: Record<string, string> = {
  "1": "/calendar",
  "2": "/posts",
  "3": "/kanban",
  "4": "/library",
  "5": "/awareness",
  "6": "/campaigns",
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  )
}

export function AppHotkeys() {
  const router = useRouter()
  const { openQuickAdd } = useDialogs()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (!meta || e.altKey) return
      if (isTypingTarget(e.target)) return

      if (!e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault()
        openQuickAdd({ source: "other" })
        return
      }

      if (!e.shiftKey && e.key === ",") {
        e.preventDefault()
        router.push("/settings")
        return
      }

      const href = !e.shiftKey ? NAV_BY_DIGIT[e.key] : undefined
      if (href) {
        e.preventDefault()
        router.push(href)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openQuickAdd, router])

  return null
}
