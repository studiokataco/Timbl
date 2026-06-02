"use client"

import { useCallback, useEffect, useRef } from "react"
import { driver, type Driver } from "driver.js"
import "driver.js/dist/driver.css"

/*
 * driver.js-powered product tour. Independent of the setup wizard at
 * /onboarding (which collects data) - this one teaches navigation.
 *
 * Stops point at sidebar links via stable href selectors, so the tour
 * works without seeding data-tour attributes across every component.
 *
 * Auto-launch: fires once per browser on first /calendar landing, gated by
 * a localStorage flag. Re-run is available from Settings → Workspace.
 */

const STORAGE_KEY = "safe.tour.completed.v1"

const STEPS = [
  {
    element: 'a[href="/calendar"]',
    popover: {
      title: "Calendar",
      description:
        "Your editorial calendar. Every scheduled post lands here with a status glyph and category tint. Drag to reschedule.",
    },
  },
  {
    element: 'a[href="/posts"]',
    popover: {
      title: "All posts",
      description:
        "Every post in one searchable table. Quick-filter by Ideas, Drafts, or Scheduled. Export to CSV for clients.",
    },
  },
  {
    element: 'a[href="/kanban"]',
    popover: {
      title: "Kanban",
      description:
        "Drag posts between status columns. Agent-generated ideas show an Approve / Reject control until you decide.",
    },
  },
  {
    element: 'a[href="/studio"]',
    popover: {
      title: "Studio",
      description:
        "Where your AI agents live. Ideate, draft, review, and schedule. Switch the model per conversation from the composer.",
    },
  },
  {
    element: 'a[href="/templates"]',
    popover: {
      title: "Templates",
      description:
        "Save reusable templates for recurring posts (work anniversaries, weekly recaps). Click New template to build one.",
    },
  },
  {
    element: 'a[href="/settings"]',
    popover: {
      title: "Settings",
      description:
        "Connect channels, invite teammates, re-run the setup wizard, or replay this tour.",
    },
  },
] as const

export function startProductTour(): void {
  if (typeof window === "undefined") return
  const d: Driver = driver({
    showProgress: true,
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Got it",
    steps: STEPS.map((s) => ({ ...s })),
    onDestroyed: () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      } catch {
        /* private-mode storage blocked - tour will offer again next visit */
      }
    },
  })
  d.drive()
}

export function hasSeenProductTour(): boolean {
  if (typeof window === "undefined") return true
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return true
  }
}

export function resetProductTourSeen(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/* Mount in the app layout. Fires once on first paint if the user has
 * never seen the tour. Skips if the sidebar isn't mounted yet (eg. a
 * non-app route somehow lands here). */
export function ProductTourAutostart({
  enabled,
}: {
  enabled: boolean
}) {
  const startedRef = useRef(false)
  const start = useCallback(() => {
    if (startedRef.current) return
    if (hasSeenProductTour()) return
    if (!document.querySelector('a[href="/calendar"]')) return
    startedRef.current = true
    startProductTour()
  }, [])

  useEffect(() => {
    if (!enabled) return
    const t = window.setTimeout(start, 600)
    return () => window.clearTimeout(t)
  }, [enabled, start])

  return null
}
