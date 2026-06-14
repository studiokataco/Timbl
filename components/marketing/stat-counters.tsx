"use client"

import { useRef } from "react"

import { ScrollTrigger, countUp, gsap, landingScroller, useGSAP } from "./gsap"

type Stat = { to: number; prefix?: string; suffix?: string; label: string }

const STATS: Stat[] = [
  { to: 12000, suffix: "+", label: "Posts planned" },
  { to: 500, suffix: "+", label: "Brands managed" },
  { to: 40, suffix: "h", label: "Saved per brand, monthly" },
  { to: 6, label: "Channels, one calendar" },
]

function fmt(s: Stat) {
  return `${s.prefix ?? ""}${s.to.toLocaleString("en-US")}${s.suffix ?? ""}`
}

export function StatCounters() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const nums = gsap.utils.toArray<HTMLElement>(".stat-num")
      const scroller = landingScroller(root.current)
      const mm = gsap.matchMedia()

      mm.add("(prefers-reduced-motion: reduce)", () => {
        nums.forEach((el) => (el.textContent = el.dataset.full ?? el.textContent))
      })

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        nums.forEach((el) => (el.textContent = `${el.dataset.prefix ?? ""}0${el.dataset.suffix ?? ""}`))

        gsap.from(".stat-card", {
          y: 28,
          autoAlpha: 0,
          stagger: 0.1,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: root.current, scroller, start: "top 80%" },
        })

        ScrollTrigger.create({
          trigger: root.current,
          scroller,
          start: "top 78%",
          once: true,
          onEnter: () =>
            nums.forEach((el) =>
              countUp(el, Number(el.dataset.to), {
                prefix: el.dataset.prefix,
                suffix: el.dataset.suffix,
              })
            ),
        })
      })
    },
    { scope: root }
  )

  return (
    <section ref={root} className="relative px-6 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#7B5EFF]/8 via-transparent to-transparent"
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="stat-card glass rounded-2xl p-6 text-center md:text-left">
            <p
              className="stat-num bg-gradient-to-br from-[#00E89A] via-[#7B5EFF] to-[#FF5040] bg-clip-text text-4xl font-semibold tracking-tight text-transparent md:text-5xl"
              data-to={s.to}
              data-prefix={s.prefix ?? ""}
              data-suffix={s.suffix ?? ""}
              data-full={fmt(s)}
            >
              {fmt(s)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
