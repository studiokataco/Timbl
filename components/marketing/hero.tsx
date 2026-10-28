"use client"

import { useRef } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"

import { CalendarPreview } from "./calendar-preview"
import { FacebookIcon, InstagramIcon, LinkedInIcon, XIcon } from "./brand-icons"
import { PIN_QUERY, gsap, useGSAP } from "./gsap"
import { TypewriterWord } from "./typewriter-word"

const HERO_AUDIENCES = ["Creators", "Agencies", "Studios", "Teams"]

const FLOATERS = [
  { label: "Instagram", Icon: InstagramIcon, pos: "-right-1 top-[8%] md:left-[1%] md:right-auto md:top-[10%]", from: { x: 150, y: 60 } },
  { label: "Facebook", Icon: FacebookIcon, pos: "-right-1 top-[33%] md:right-[2%] md:top-[6%]", from: { x: -150, y: 70 } },
  { label: "LinkedIn", Icon: LinkedInIcon, pos: "-right-1 top-[60%] md:left-[3%] md:right-auto md:top-[58%]", from: { x: 120, y: -10 } },
  { label: "X", Icon: XIcon, pos: "-right-1 top-[85%] md:right-[3%] md:top-[54%]", from: { x: -120, y: -10 } },
]

function PostFragment() {
  return (
    <div className="w-[190px] origin-top-left scale-[0.62] rounded-2xl border border-border bg-card p-3 shadow-[0_12px_40px_rgba(0,0,0,0.10)] sm:scale-75 lg:scale-100">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-[#fb923c]" />
        Announcements
      </span>
      <p className="mt-2 text-[13px] font-semibold">Launch teaser</p>
      <p className="mt-1 text-[11px] text-muted-foreground">Instagram · Tue 9:00</p>
    </div>
  )
}

function AgentFragment() {
  return (
    <div className="flex w-[210px] origin-bottom-right scale-[0.62] items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-[0_12px_40px_rgba(0,0,0,0.10)] sm:scale-75 lg:scale-100">
      <span className="flex size-8 items-center justify-center rounded-xl bg-secondary">
        <Sparkles className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold">Drafter agent</p>
        <p className="text-[11px] text-muted-foreground">2 drafts ready for review</p>
      </div>
    </div>
  )
}

export function Hero() {
  const root = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const device = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(
        { canPin: PIN_QUERY, motion: "(prefers-reduced-motion: no-preference)" },
        (ctx) => {
          const { canPin, motion } = ctx.conditions as { canPin: boolean; motion: boolean }
          if (!motion) return

          if (!canPin) {
            const scrubbed = (start: string, end: string) => ({
              trigger: stage.current,
              start,
              end,
              scrub: 0.5,
            })

            const tlm = gsap.timeline({ scrollTrigger: scrubbed("top 92%", "top 45%") })
            tlm
              .from(device.current, {
                y: 36,
                scale: 0.94,
                autoAlpha: 0,
                duration: 0.7,
                ease: "power2.out",
              })
              .from(
                ".hero-floater",
                { x: 80, scale: 0.5, autoAlpha: 0, duration: 0.5, stagger: 0.07, ease: "power2.out" },
                0.15
              )
              .from(
                ".hero-fragment",
                {
                  x: (i: number) => (i % 2 === 0 ? -150 : 150),
                  y: 10,
                  scale: 0.85,
                  autoAlpha: 0,
                  duration: 0.55,
                  stagger: 0.12,
                  ease: "power2.out",
                },
                0.2
              )

            gsap.from(".cal-post", {
              y: 14,
              scale: 0.8,
              autoAlpha: 0,
              duration: 0.5,
              ease: "power2.out",
              stagger: { each: 0.04, from: "center" },
              scrollTrigger: scrubbed("top 85%", "top 40%"),
            })
            return
          }

          const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "+=60%",
            scrub: 0.8,
            pin: pin.current,
            anticipatePin: 1,
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
              x: (_i: number, el: Element) =>
                (el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 - cx) * 0.7,
              y: (_i: number, el: Element) =>
                (el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2 - cy) * 0.7,
              scale: 0.5,
              autoAlpha: 0,
              stagger: { each: 0.06, from: "center" },
              ease: "power2.out",
            },
            0.3
          )
          }

        tl.to({}, { duration: 0.15 })
        }
      )
    },
    { scope: root }
  )

  return (
    <section ref={root} className="relative min-h-screen overflow-x-clip px-6">
      <div
        ref={pin}
        className="mx-auto flex min-h-screen max-w-6xl flex-col items-center pb-24 pt-20 md:pt-28"
        style={{ perspective: "1400px" }}
      >
        <div className="hero-lead mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[13px] font-medium text-muted-foreground">
            <span className="font-semibold">
              A Planner that works{' '}
              <span className="font-extrabold">with</span>
              {' '}you
            </span>
          </span>
     
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
            Planning content for <br className="hidden md:block" />{' '}
            <TypewriterWord words={HERO_AUDIENCES} /> has never been easier
            
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground">
            Timbl is an Agentic Planner with efficient workflows and tools to manage your content, campaigns, projects, and multimedia.</p>
            <div className="flex flex-col items-center mt-8">
              <hr className="h-px border-0 bg-muted-foreground/20 w-[340px] md:w-[430px]" />
            </div>
            <h2 className="mt-8 text-xl font-semibold">
       
              You focus on the big picture,
              <br />
              Timbl handles the details.
            </h2>
       
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button className="h-11 ps-6 text-sm flex items-center" render={<Link href="/signup" />}>
            Request a Free Workspace
              <span className="ms-2 flex items-center pe-[17.6px]">
                <ArrowRight data-icon="inline-end" />
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-11 px-6 text-sm"
              render={<Link href="/login" />}
            >
       
              Log In
            </Button>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            No credit card required. Free trial included on signup.
          </p>
        </div>

        <div ref={stage} className="relative mt-16 w-full">
          {FLOATERS.map(({ label, Icon, pos }, i) => (
            <div
              key={i}
              aria-label={label}
              className={`hero-floater pointer-events-none absolute z-30 flex size-10 items-center justify-center rounded-2xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:size-12 ${pos}`}
            >
              <Icon className="size-6 md:size-7" />
            </div>
          ))}

          <div className="hero-fragment pointer-events-none absolute -left-2 -top-9 z-20 block lg:top-12">
            <PostFragment />
          </div>
          <div className="hero-fragment pointer-events-none absolute -right-3 -bottom-9 z-20 block lg:bottom-8">
            <AgentFragment />
          </div>

          <div
            ref={device}
            className="hero-device relative z-10 mx-auto max-w-4xl rounded-2xl border border-border bg-card p-2 shadow-[0_40px_120px_rgba(0,0,0,0.14)]"
          >
            <CalendarPreview />
          </div>
        </div>
      </div>
    </section>
  )
}
