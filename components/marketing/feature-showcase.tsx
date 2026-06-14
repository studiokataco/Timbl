"use client"

import { useRef } from "react"
import { BarChart3, Clock, TrendingUp } from "lucide-react"

import { gsap, landingScroller, useGSAP } from "./gsap"

const SOURCES = [
  { label: "Instagram", color: "#E1306C", pct: 90 },
  { label: "Facebook", color: "#1877F2", pct: 65 },
  { label: "LinkedIn", color: "#0A66C2", pct: 48 },
  { label: "X", color: "#0f0f0f", pct: 32 },
]

function PhoneMockup() {
  return (
    <div className="phone relative mx-auto w-[260px] rounded-[2.4rem] bg-[#0f0f0f] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] ring-1 ring-black/10">
      <div className="absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#0f0f0f]" />
      <div className="overflow-hidden rounded-[1.9rem] bg-background">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Engagement rate</p>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              30 days
            </span>
          </div>

          <div className="rounded-2xl border border-border p-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold leading-none">125k</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Reached</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                <TrendingUp className="size-3" />
                +6.8%
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="phone-bar h-full rounded-full bg-foreground" style={{ width: "72%" }} />
            </div>
          </div>

          <div className="rounded-2xl border border-border p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Social media source</p>
            <div className="mt-2.5 space-y-2">
              {SOURCES.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="w-16 shrink-0 text-[11px] font-medium">{s.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="phone-bar block h-full rounded-full"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeatureShowcase() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            scroller: landingScroller(root.current),
            start: "top 72%",
          },
        })
        tl.from(".phone", { y: 64, rotateY: -12, autoAlpha: 0, duration: 0.8, ease: "power3.out" })
          .from(
            ".showcase-card",
            { x: 48, autoAlpha: 0, duration: 0.6, stagger: 0.12, ease: "power2.out" },
            "-=0.4"
          )
          .from(
            ".phone-bar",
            { scaleX: 0, transformOrigin: "left center", duration: 0.7, stagger: 0.08, ease: "power2.out" },
            "-=0.4"
          )
      })
    },
    { scope: root }
  )

  return (
    <section ref={root} className="relative overflow-hidden px-6 py-24" style={{ perspective: "1200px" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/2 size-[480px] -translate-y-1/2 rounded-full bg-[#7B5EFF]/10 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <PhoneMockup />

        <div className="space-y-4">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your numbers, in plain sight
          </p>
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            Know what is working before the week is out
          </h2>

          <div className="showcase-card glass rounded-2xl p-6">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <Clock className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">Time-saving automation</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
              Agents draft and queue posts on the plan you set, so a month of
              content takes an afternoon - not a week.
            </p>
          </div>

          <div className="showcase-card rounded-2xl bg-surface-dark p-6 text-white">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <BarChart3 className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-semibold">Actionable insights</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/60">
              See reach, engagement and the channels carrying each brand - a
              clear read on what to do more of next.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
