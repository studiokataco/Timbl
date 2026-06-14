"use client"

import { useRef, type ReactNode } from "react"
import { CalendarDays, CheckCircle2, Sparkles } from "lucide-react"

import { gsap, landingScroller, useGSAP } from "./gsap"

function CalFragment() {
  const days = [["#fb923c"], ["#34d399"], ["#fb923c", "#8b5cf6"], [], ["#ec4899"], ["#fb923c"], ["#34d399"]]
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((bars, i) => (
        <div key={i} className="space-y-1 rounded-lg bg-muted p-1.5">
          {bars.map((b, j) => (
            <div key={j} className="h-2 rounded-full" style={{ backgroundColor: b }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function AgentFragment() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
        <Sparkles className="size-4 text-muted-foreground" />
        <span className="text-xs font-medium">Drafter agent</span>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          drafting...
        </span>
      </div>
      <div className="rounded-lg bg-muted px-3 py-2">
        <p className="text-[11px] font-medium">&ldquo;Spring drop is live - here is why it matters...&rdquo;</p>
      </div>
    </div>
  )
}

function ApproveFragment() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
        <CheckCircle2 className="size-4 text-success" />
        <span className="text-xs font-medium">Launch teaser</span>
        <span className="ml-auto rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-white">
          Approve
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
        <CalendarDays className="size-4" />
        <span className="text-[11px]">Scheduled · Instagram · Tue 9:00</span>
      </div>
    </div>
  )
}

type Card = { eyebrow: string; title: string; body: string; fragment: ReactNode }

const CARDS: Card[] = [
  {
    eyebrow: "Plan",
    title: "One calendar, every brand",
    body: "Drag posts onto the day they belong. Campaigns, categories and quiet gaps are visible at a glance - across every client you run.",
    fragment: <CalFragment />,
  },
  {
    eyebrow: "Draft",
    title: "Agents draft in each brand's voice",
    body: "Your crew fills the empty slots with real first drafts, tuned to each brand's tone. You start from something, never a blank page.",
    fragment: <AgentFragment />,
  },
  {
    eyebrow: "Ship",
    title: "You approve, then it ships",
    body: "Every draft waits for a human yes. Approve it and Timbl schedules it to the right channel at the right time. Nothing publishes without you.",
    fragment: <ApproveFragment />,
  },
]

export function ScrollStack() {
  const root = useRef<HTMLElement>(null)
  const pinWrap = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const cards = gsap.utils.toArray<HTMLElement>(".stack-card")
      const mm = gsap.matchMedia()

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(pinWrap.current, { height: "78vh" })
        gsap.set(cards, { position: "absolute", top: 0, left: 0, width: "100%", transformOrigin: "center top" })
        cards.forEach((c, i) => i > 0 && gsap.set(c, { yPercent: 110, autoAlpha: 0 }))

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: pinWrap.current,
            scroller: landingScroller(root.current),
            start: "top top",
            end: `+=${(cards.length - 1) * 100}%`,
            scrub: 0.6,
            pin: pinWrap.current,
          },
        })

        cards.forEach((c, i) => {
          if (i === 0) return
          tl.to(cards[i - 1], { scale: 0.93, yPercent: -7, autoAlpha: 0.45, ease: "none" }, i - 1)
          tl.to(c, { yPercent: 0, autoAlpha: 1, ease: "none" }, i - 1)
        })
      })
    },
    { scope: root }
  )

  return (
    <section ref={root} className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            From blank week to a month, planned
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Three moves, one calm flow. Scroll to watch it stack up.
          </p>
        </div>

        <div ref={pinWrap} className="relative mt-12 space-y-6">
          {CARDS.map((c) => (
            <article
              key={c.title}
              className="stack-card glass mx-auto grid max-w-4xl items-center gap-8 rounded-2xl p-8 shadow-[0_24px_80px_rgba(0,0,0,0.12)] md:grid-cols-2 md:p-10"
            >
              <div>
                <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.eyebrow}
                </span>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{c.title}</h3>
                <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">{c.fragment}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
