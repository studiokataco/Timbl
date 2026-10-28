"use client"

import { useRef } from "react"
import { ArrowRight } from "lucide-react"

import { ScrollTrigger, gsap, useGSAP } from "./gsap"
import { Reveal } from "./reveal"

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
        gsap.from(".pipe-pill", {
          y: 24,
          autoAlpha: 0,
          stagger: 0.1,
          duration: 0.5,
          ease: "power2.out",
          scrollTrigger: { trigger: root.current, start: "top 78%" },
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
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            New in Timbl
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight">
            An agent crew, not another chatbot
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Timbl ships with a specialised set of AI agents that work and plan together with you - suggesting ideas, searching the web for ideas, drafting in your brand voice and more.
          </p>
        </Reveal>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2 md:gap-3">
          {STAGES.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-2 md:gap-3">
              {i > 0 && <ArrowRight className="size-4 text-muted-foreground/60" />}
              <span className="pipe-pill inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
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
          Choose from a range of agents to draft, schedule and even manage onboardings. <br/> AI proposes, you approve.
        </p>
      </div>
    </section>
  )
}
