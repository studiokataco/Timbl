"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { ShaderBackground } from "@/components/auth/shader-background"
import { Button } from "@/components/ui/button"

import { CalendarPreview } from "./calendar-preview"
import { gsap, landingScroller, useGSAP } from "./gsap"

const FLOATERS = [
  { label: "Instagram", short: "Ig", color: "#E1306C", pos: "left-[1%] top-[8%]", from: { x: 150, y: 60 } },
  { label: "Facebook", short: "f", color: "#1877F2", pos: "right-[2%] top-[5%]", from: { x: -150, y: 70 } },
  { label: "LinkedIn", short: "in", color: "#0A66C2", pos: "left-[4%] top-[52%]", from: { x: 120, y: -10 } },
  { label: "X", short: "X", color: "#0f0f0f", pos: "right-[3%] top-[48%]", from: { x: -120, y: -10 } },
]

function PostFragment() {
  return (
    <div className="glass-dark w-[190px] rounded-2xl p-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium">
        <span className="size-1.5 rounded-full bg-[#fb923c]" />
        Announcements
      </span>
      <p className="mt-2 text-[13px] font-semibold">Launch teaser</p>
      <p className="mt-1 text-[11px] text-white/55">Instagram · Tue 9:00</p>
    </div>
  )
}

function AgentFragment() {
  return (
    <div className="glass-dark flex w-[210px] items-center gap-2.5 rounded-2xl p-3 text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <span className="flex size-8 items-center justify-center rounded-xl bg-white/10">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold">Drafter agent</p>
        <p className="text-[11px] text-white/55">2 drafts ready for review</p>
      </div>
    </div>
  )
}

export function Hero() {
  const root = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const device = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            scroller: landingScroller(root.current),
            start: "top top",
            end: "+=110%",
            scrub: 0.6,
            pin: pin.current,
          },
        })

        tl.from(device.current, {
          yPercent: 14,
          scale: 0.86,
          rotateX: 16,
          autoAlpha: 0.3,
          ease: "none",
        })

        tl.from(
          ".hero-floater",
          {
            x: (i: number) => FLOATERS[i].from.x,
            y: (i: number) => FLOATERS[i].from.y,
            scale: 0.4,
            autoAlpha: 0,
            stagger: 0.08,
            ease: "power2.out",
          },
          0.1
        )

        tl.from(
          ".hero-fragment",
          {
            x: (i: number) => (i % 2 === 0 ? -80 : 80),
            y: 50,
            scale: 0.7,
            autoAlpha: 0,
            stagger: 0.12,
            ease: "power2.out",
          },
          0.15
        )

        const grid = root.current?.querySelector(".cal-grid")
        if (grid) {
          const gr = grid.getBoundingClientRect()
          const cx = gr.left + gr.width / 2
          const cy = gr.top + gr.height / 2
          tl.from(
            ".cal-post",
            {
              x: (_i: number, el: Element) => (el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 - cx) * 0.7,
              y: (_i: number, el: Element) => (el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 - cy) * 0.7,
              scale: 0.5,
              autoAlpha: 0,
              stagger: { each: 0.06, from: "center" },
              ease: "power2.out",
            },
            0.3
          )
        }
      })
    },
    { scope: root }
  )

  return (
    <section
      ref={root}
      className="relative isolate min-h-screen overflow-hidden bg-[#0c1224] px-6 text-white"
    >
      <ShaderBackground className="opacity-90" />

      <div
        ref={pin}
        className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col items-center pb-24 pt-28 md:pt-32"
        style={{ perspective: "1400px" }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium text-white/80">
            <span className="size-1.5 rounded-full bg-[#00E89A]" />
            AI agents now draft alongside you
          </span>
          <h1 className="mt-6 text-balance text-5xl font-medium leading-[1.04] tracking-tight md:text-7xl">
            Every brand&apos;s{" "}
            <span className="bg-gradient-to-r from-[#00E89A] via-[#7B5EFF] to-[#FF5040] bg-clip-text text-transparent">
              social
            </span>
            , one calm calendar
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-white/65">
            Timbl brings every client, channel and campaign into a single
            drag-and-drop calendar. Your AI agents handle the ideas, the first
            drafts and the scheduling - you keep the seat that matters,
            approving what goes live.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              className="h-11 bg-white px-6 text-sm text-[#0c1224] hover:bg-white/90"
              render={<Link href="/signup" />}
            >
              Get started free
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              className="glass-dark h-11 px-6 text-sm text-white hover:bg-white/15"
              render={<Link href="/login" />}
            >
              Log in
            </Button>
          </div>
          <p className="mt-4 text-[13px] text-white/45">
            Free plan included. No credit card required.
          </p>
        </div>

        <div className="relative mt-16 w-full">
          {FLOATERS.map(({ label, short, color, pos }, i) => (
            <div
              key={i}
              aria-label={label}
              className={`hero-floater pointer-events-none absolute z-30 hidden size-12 items-center justify-center rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] md:flex ${pos}`}
            >
              <span
                className="flex size-7 items-center justify-center rounded-full text-xs font-bold lowercase text-white"
                style={{ backgroundColor: color }}
              >
                {short}
              </span>
            </div>
          ))}

          <div className="hero-fragment pointer-events-none absolute -left-2 top-12 z-20 hidden lg:block">
            <PostFragment />
          </div>
          <div className="hero-fragment pointer-events-none absolute -right-3 bottom-8 z-20 hidden lg:block">
            <AgentFragment />
          </div>

          <div
            ref={device}
            className="glass-dark relative z-10 mx-auto max-w-4xl rounded-2xl p-2 shadow-[0_40px_120px_rgba(0,0,0,0.5)]"
          >
            <CalendarPreview />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-b from-transparent to-background" />
    </section>
  )
}
