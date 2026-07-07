"use client"

import { useRef, useState, type CSSProperties } from "react"
import { ArrowRight, Check } from "lucide-react"

import { cn } from "@/lib/utils"

import { gsap } from "./gsap"
import { PricingCard, tierTint, type PricingTier } from "./pricing-card"
import { Reveal } from "./reveal"

export function PricingSection({ tiers }: { tiers: PricingTier[] }) {
  const [selectedId, setSelectedId] = useState(
    tiers.find((t) => t.featured)?.id ?? tiers[0]?.id,
  )
  const cardRef = useRef<HTMLDivElement>(null)
  const selected = tiers.find((t) => t.id === selectedId) ?? tiers[0]

  const select = (id: string) => {
    if (id === selectedId) return
    const node = cardRef.current
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!node || reduce) {
      setSelectedId(id)
      return
    }
    gsap.to(node, {
      autoAlpha: 0,
      x: -16,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => {
        setSelectedId(id)
        gsap.fromTo(
          node,
          { autoAlpha: 0, x: 16 },
          { autoAlpha: 1, x: 0, duration: 0.28, ease: "power2.out" },
        )
      },
    })
  }

  return (
    <section id="pricing" className="px-6 pb-24 pt-14 md:pb-32 md:pt-20">
      <Reveal className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <span className="inline-flex rounded-full bg-surface-soft px-3.5 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-hairline">
            Our pricing
          </span>
          <h1 className="mt-5 text-balance text-4xl tracking-tight md:text-5xl">
            <span className="font-normal">Find your </span>
            <span className="font-bold">perfect plan</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground md:text-base">
            Start free, upgrade when your content engine does. Transparent
            pricing, no hidden fees, cancel anytime.
          </p>
        </div>

        <div className="rounded-3xl bg-surface-soft p-6 ring-1 ring-hairline-soft sm:p-10 md:p-14">
          <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-14">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Pick a plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select a tier to see everything it unlocks.
              </p>

              <div className="mt-6 space-y-3" role="tablist" aria-label="Plans">
                {tiers.map((tier) => {
                  const active = tier.id === selectedId
                  const tint = tierTint(tier.id)
                  const circleStyle = active
                    ? { background: `rgb(${tint ?? "255,255,255"})`, color: "#0a0a0a" }
                    : undefined
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      role="tab"
                      id={`pricing-tab-${tier.id}`}
                      aria-selected={active}
                      aria-controls="pricing-tier-panel"
                      onClick={() => select(tier.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 rounded-2xl bg-background px-5 py-4 text-left transition-all",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-soft",
                        active
                          ? "shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-[rgba(var(--tint),0.55)]"
                          : "ring-1 ring-hairline hover:ring-foreground/20",
                      )}
                      style={{ "--tint": tint ?? "255,255,255" } as CSSProperties}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{tier.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {tier.descriptor}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          !active && "text-muted-foreground ring-1 ring-hairline",
                        )}
                        style={circleStyle}
                      >
                        {active ? (
                          <Check aria-hidden className="size-4" />
                        ) : (
                          <ArrowRight aria-hidden className="size-4" />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div
              ref={cardRef}
              id="pricing-tier-panel"
              role="tabpanel"
              aria-labelledby={selected ? `pricing-tab-${selected.id}` : undefined}
              className="min-w-0 md:min-h-[560px]"
            >
              {selected ? <PricingCard tier={selected} className="h-full" /> : null}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
