"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ShaderBackground } from "@/components/auth/shader-background"

import { Reveal } from "./reveal"

export function PricingBanner() {
  return (
    <section className="px-6 pb-24 md:pb-32">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl px-6 py-20 text-center text-white ring-1 ring-white/10 md:py-28">
          <ShaderBackground flowSpeed={0.35} colorIntensity={2.2} mouseInfluence={0.15} />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_38%,transparent_60%)]"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold tracking-tight md:text-5xl">
              A month of content, planned in one sitting
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-white/70 md:text-base">
              Brief the agents, review the drafts, approve the calendar. As simple as that.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup?plan=trial"
                className="flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#0a0a0a] transition-all hover:bg-white/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                Start 30-day free trial
                <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="mailto:hello@kataco.in?subject=Timbl%20demo"
                className="flex h-11 items-center rounded-xl px-6 text-sm font-semibold text-white ring-1 ring-white/30 transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
