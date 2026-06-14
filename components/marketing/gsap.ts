"use client"

import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP)
}

/**
 * The landing page scrolls inside its own overflow container, not the window
 * (the app `body` is `overflow-hidden h-screen`). Every ScrollTrigger must point
 * at this scroller or pinning silently does nothing.
 *
 * Resolve it from the trigger's own ref via `closest()` rather than a selector
 * string: the container is always an ancestor, so it can never miss. Passing a
 * string that resolves to null makes ScrollTrigger call getCache(undefined) and
 * throw, which unmounts the whole page.
 */
export const LANDING_SCROLLER_ID = "landing-scroll"

export function landingScroller(el: Element | null): HTMLElement | undefined {
  return (el?.closest(`#${LANDING_SCROLLER_ID}`) as HTMLElement | null) ?? undefined
}

/**
 * Tween an integer count into `el` (e.g. 0 -> 12000), formatting with a thousands
 * separator and an optional prefix/suffix. Returns the tween so callers can attach
 * it to a ScrollTrigger. Reduced-motion callers should set the final text directly.
 */
export function countUp(
  el: HTMLElement,
  to: number,
  { duration = 1.6, prefix = "", suffix = "" }: { duration?: number; prefix?: string; suffix?: string } = {}
) {
  const obj = { v: 0 }
  return gsap.to(obj, {
    v: to,
    duration,
    ease: "power2.out",
    onUpdate: () => {
      el.textContent = `${prefix}${Math.round(obj.v).toLocaleString("en-US")}${suffix}`
    },
  })
}

export { gsap, ScrollTrigger, useGSAP }
