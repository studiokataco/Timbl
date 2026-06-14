"use client"

import { useRef } from "react"

import { CHANNEL_LABELS } from "@/lib/channels"

import { gsap, landingScroller, useGSAP } from "./gsap"

const STEPS = [
  {
    title: "Bring your brands together",
    body: "Give each client its own workspace, with their channels, categories and campaigns. One tidy home for everything social, instead of a dozen scattered docs.",
  },
  {
    title: "Plan on the calendar",
    body: "Drag posts onto the right day and watch the month take shape. Campaigns, categories and quiet gaps are visible at a glance - no clashes, no last-minute scrambles.",
  },
  {
    title: "Move it across the board",
    body: "Every post travels a kanban board from idea to ready - draft, review, approve. The whole team sees what's where, and nothing slips through the cracks.",
  },
]

export function HowItWorks() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: ".hiw-grid",
            scroller: landingScroller(root.current),
            start: "top 78%",
          },
        })
        tl.from(".hiw-line", { scaleX: 0, transformOrigin: "left center", duration: 0.9, ease: "power2.out" })
          .from(".hiw-step", { y: 28, autoAlpha: 0, stagger: 0.15, duration: 0.6, ease: "power2.out" }, "-=0.7")
          .from(".hiw-num", { scale: 0, stagger: 0.15, duration: 0.4, ease: "back.out(2)" }, "<")
      })
    },
    { scope: root }
  )

  return (
    <section ref={root} id="how-it-works" className="scroll-mt-16 bg-muted px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            Up and running in an afternoon
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Plan content for every channel your brands live on.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {Object.values(CHANNEL_LABELS).map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-card px-3 py-1 text-[13px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="hiw-grid relative mt-14">
          <div className="hiw-line absolute left-0 right-0 top-12 hidden h-px bg-border md:block" />
          <div className="relative grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="hiw-step rounded-xl border border-border bg-card p-8">
                <span className="hiw-num inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
