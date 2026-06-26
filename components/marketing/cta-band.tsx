"use client"

import Link from "next/link"
import { useRef } from "react"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

import { gsap, useGSAP } from "./gsap"
import { Reveal } from "./reveal"

const RING_COUNT = 7
const RING_DURATION = 11
const RING_COLORS = ["#fb923c", "#10b981", "#f59e0b"]
const RING_SIZE = "min(120vw, 1100px)"

function RippleRings() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const rings = ref.current?.querySelectorAll<HTMLElement>("[data-ring]")
        if (!rings?.length) return
        rings.forEach((ring, i) => {
          gsap.to(ring, {
            keyframes: {
              scale: [0.08, 1],
              opacity: [0, 0.4, 0.4, 0],
            },
            duration: RING_DURATION,
            ease: "none",
            repeat: -1,
            delay: (-RING_DURATION / RING_COUNT) * i,
          })
        })
      })
    },
    { scope: ref }
  )

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        maskImage:
          "radial-gradient(ellipse 60% 55% at center, transparent 30%, black 70%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 60% 55% at center, transparent 30%, black 70%)",
      }}
    >
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <div
          key={i}
          data-ring
          className="absolute left-1/2 top-1/2 aspect-square rounded-full will-change-transform"
          style={{
            width: RING_SIZE,
            marginLeft: `calc(${RING_SIZE} / -2)`,
            marginTop: `calc(${RING_SIZE} / -2)`,
            border: `1.5px solid ${RING_COLORS[i % RING_COLORS.length]}`,
            transform: `scale(${0.18 + i * 0.13})`,
            opacity: 0.3 - i * 0.03,
          }}
        />
      ))}
    </div>
  )
}

export function CtaBand() {
  return (
    <section className="relative overflow-hidden px-6 py-32 md:py-48">
      <RippleRings />
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-foreground/[0.06] blur-3xl" />

      <Reveal stagger className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className="text-balance text-2xl font-bold tracking-tight md:text-4xl">
          Bring next month&apos;s content to Timbl
        </h2>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Try the free trial. No credit card required.
        </p>
        <div className="mt-8">
          <Button className="h-11 ps-6 text-sm flex items-center" render={<Link href="/signup" />}>
            Request a Free Workspace
            <span className="ms-2 flex items-center pe-[17.6px]">
              <ArrowRight data-icon="inline-end" />
            </span>
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
