"use client"

import { useRef, type ReactNode } from "react"

import { gsap, useGSAP } from "./gsap"

export function Reveal({
  children,
  delay = 0,
  y = 28,
  stagger = false,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  stagger?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const node = ref.current
        if (!node) return
        const targets = stagger ? Array.from(node.children) : node
        gsap.from(targets, {
          y,
          autoAlpha: 0,
          duration: 0.7,
          delay,
          ease: "power2.out",
          stagger: stagger ? 0.1 : 0,
          scrollTrigger: {
            trigger: node,
            start: "top 88%",
          },
        })
      })
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
