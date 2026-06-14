"use client"

import { useRef } from "react"
import { ArrowRight } from "lucide-react"

import { ScrollTrigger, gsap, landingScroller, useGSAP } from "./gsap"

const STAGES = [
  { label: "Plan", color: "#8b5cf6" },
  { label: "Draft", color: "#fb923c" },
  { label: "Review", color: "#ec4899" },
  { label: "Schedule", color: "#34d399" },
  { label: "Publish", color: "#10b981" },
]

export function AgentPipeline() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const scroller = landingScroller(root.current)

        gsap.from(".pipe-pill", {
          y: 24,
          autoAlpha: 0,
          stagger: 0.1,
          duration: 0.5,
          ease: "power2.out",
          scrollTrigger: { trigger: root.current, scroller, start: "top 78%" },
        })

        const pulse = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true })
        pulse.to(".pipe-dot", {
          keyframes: { scale: [1, 1.9, 1] },
          duration: 0.5,
          stagger: 0.28,
          ease: "power1.inOut",
        })

        ScrollTrigger.create({
          trigger: root.current,
          scroller,
          start: "top 80%",
          end: "bottom 20%",
          onToggle: (self) => (self.isActive ? pulse.play() : pulse.pause()),
        })
      })
    },
    { scope: root }
  )

  return (
    <section ref={root} id="agents" className="scroll-mt-16 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            New in Timbl
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight">
            An agent crew, not another chatbot
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Timbl comes with a crew of specialised agents who work the plan
            with you. One fills empty slots with ideas, one drafts in each
            brand&apos;s voice, others keep the schedule honest. They propose.
            You approve.
          </p>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2 md:gap-3">
          {STAGES.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-2 md:gap-3">
              {i > 0 && <ArrowRight className="size-4 text-muted-foreground/60" />}
              <span className="pipe-pill glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium">
                <span
                  className="pipe-dot size-2 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
          Every agent run lands as a draft for review - nothing reaches your
          channels until someone on the team says so.
        </p>
      </div>
    </section>
  )
}
