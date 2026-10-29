"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { driver, type Driver, type DriveStep } from "driver.js"
import "driver.js/dist/driver.css"

/*
 * driver.js product tour that teaches navigation. It only starts from an
 * explicit click (the welcome dialog's last step, or Settings). No autostart:
 * any per-browser "seen" flag replays it uninvited on a new browser, device
 * or workspace.
 *
 * Steps target sidebar links by href. When a target isn't visible (the sidebar
 * is a drawer on phones) the step renders as a centred popover instead.
 */

const STEPS: DriveStep[] = [
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
      title: "AI Studio",
      description:
        "Your agent team. Approve what they prepare, see how each one is doing, and add or tune agents.",
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
]

let active: Driver | null = null

function visible(selector: string): boolean {
  const el = document.querySelector(selector)
  return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
}

export function startProductTour(): void {
  if (typeof window === "undefined") return
  active?.destroy()
  const steps = STEPS.map((s) =>
    typeof s.element === "string" && visible(s.element) ? { ...s } : { popover: s.popover },
  )
  const d = driver({
    showProgress: true,
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Got it",
    steps,
    onDestroyed: () => {
      if (active === d) active = null
    },
  })
  active = d
  d.drive()
}

/* Mount once in the app layout: closes an open tour on navigation so a
 * popover never points at a page that's gone. */
export function ProductTourRouteGuard() {
  const pathname = usePathname()
  useEffect(() => {
    active?.destroy()
  }, [pathname])
  return null
}
