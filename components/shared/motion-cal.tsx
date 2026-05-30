"use client"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import type { RefObject } from "react"

/*
 * Cal-voice marquee motion. Two hooks, both honour `prefers-reduced-motion`
 * via `gsap.matchMedia()` per the GSAP core skill - under reduced-motion the
 * elements jump to their final state with no animation, never blocking the
 * paint or any user input.
 *
 * - `useGridReveal(scopeRef)`  - fade-up + stagger across children
 *   matching `[data-cal-reveal]`. Used on the calendar grid + the
 *   awareness rail's sections.
 * - `useHeadingReveal(scopeRef)` - fade-up of the page <h1> + immediate
 *   sibling description. Used on the shared <PageHeader>.
 *
 * Both clean up automatically via `useGSAP`'s scoped context.
 */

gsap.registerPlugin(useGSAP)

type Scope = RefObject<HTMLElement | null>

const REDUCED_MOTION_SELECTOR = "(prefers-reduced-motion: no-preference)"
const ENTRANCE_DURATION = 0.4
const ENTRANCE_DISTANCE = 8

export function useGridReveal(scope: Scope) {
  useGSAP(
    () => {
      const targets = gsap.utils.toArray<HTMLElement>("[data-cal-reveal]")
      if (targets.length === 0) return
      gsap.matchMedia().add(REDUCED_MOTION_SELECTOR, () => {
        gsap.from(targets, {
          opacity: 0,
          y: ENTRANCE_DISTANCE,
          duration: ENTRANCE_DURATION,
          ease: "power2.out",
          stagger: 0.03,
          clearProps: "transform,opacity",
        })
      })
    },
    { scope, dependencies: [] },
  )
}

export function useHeadingReveal(scope: Scope) {
  useGSAP(
    () => {
      const heading = scope.current?.querySelector("[data-cal-heading]")
      const description = scope.current?.querySelector("[data-cal-description]")
      const targets = [heading, description].filter(
        (el): el is HTMLElement => !!el,
      )
      if (targets.length === 0) return
      gsap.matchMedia().add(REDUCED_MOTION_SELECTOR, () => {
        gsap.from(targets, {
          opacity: 0,
          y: ENTRANCE_DISTANCE,
          duration: ENTRANCE_DURATION,
          ease: "power3.out",
          stagger: 0.06,
          clearProps: "transform,opacity",
        })
      })
    },
    { scope, dependencies: [] },
  )
}
