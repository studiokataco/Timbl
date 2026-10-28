"use client"

import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import { ScrollToPlugin } from "gsap/ScrollToPlugin"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP)
  // Mobile browsers fire resize on every URL-bar show/hide; without this the
  // scroller recalculates mid-gesture and pinned sections jump.
  ScrollTrigger.config({ ignoreMobileResize: true })
  // The browser restores window scroll before pin spacers exist, landing mid-pin.
  ScrollTrigger.clearScrollMemory("manual")
}

/**
 * Pinning + scrub only behaves on a precise pointer that can drive the scroll
 * frame-by-frame. On touch (any width - phones AND tablets) the pin fights
 * momentum scrolling and the section feels like it sticks and loops, so those
 * devices get a plain reveal instead. Width alone can't tell the two apart.
 */
export const PIN_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)"

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

const HEADER_HEIGHT = 64
const MAX_OVERSHOOT = 20

let sectionScroll: gsap.core.Timeline | undefined

export function scrollToSection(id: string, { instant = false } = {}) {
  const el = document.getElementById(id)
  if (!el) return false

  sectionScroll?.kill()
  const max = ScrollTrigger.maxScroll(window)
  const from = window.scrollY
  const to = gsap.utils.clamp(0, max, el.getBoundingClientRect().top + from - HEADER_HEIGHT)
  const distance = Math.abs(to - from)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  if (instant || reduce || distance < 2) {
    window.scrollTo(0, to)
    return true
  }

  const overshoot = Math.sign(to - from) * Math.min(MAX_OVERSHOOT, distance * 0.04)
  const stop = () => sectionScroll?.kill()
  sectionScroll = gsap
    .timeline()
    .to(window, {
      scrollTo: { y: gsap.utils.clamp(0, max, to + overshoot), autoKill: true, onAutoKill: stop },
      duration: gsap.utils.clamp(0.7, 1.5, 0.6 + distance / 3500),
      ease: "power2.inOut",
    })
    .to(window, {
      scrollTo: { y: to, autoKill: true, onAutoKill: stop },
      duration: 0.45,
      ease: "sine.inOut",
    })
  return true
}

export { gsap, ScrollTrigger, useGSAP }
