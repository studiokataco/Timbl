"use client"

import { useRef, useState } from "react"
import { ArrowRight, Check } from "lucide-react"

import { cn } from "@/lib/utils"

import { gsap } from "./gsap"
import { PricingCard, type PricingTier } from "./pricing-card"
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
    <section id="pricing" className="px-6 py-24 md:py-32">
      <Reveal className="mx-auto max-w-6xl">
        <div className="rounded-3xl bg-surface-soft p-6 ring-1 ring-hairline-soft sm:p-10 md:p-14">
          <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-14">
            <div>
              <span className="inline-flex rounded-full bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-hairline">
                Our pricing
              </span>
              <h2 className="mt-5 text-3xl tracking-tight md:text-4xl">
                <span className="font-normal">Find your </span>
                <span className="font-bold">perfect plan</span>
              </h2>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground md:text-base">
                Transparent pricing that scales with your needs. No hidden fees,
                cancel anytime.
              </p>

              <div className="mt-8 space-y-3" role="tablist" aria-label="Plans">
                {tiers.map((tier) => {
                  const active = tier.id === selectedId
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => select(tier.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 rounded-2xl bg-background px-5 py-4 text-left transition-all",
                        active
                          ? "shadow-[0_4px_16px_rgba(0,0,0,0.08)] ring-1 ring-foreground/15"
                          : "ring-1 ring-hairline hover:ring-foreground/20",
                      )}
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
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground ring-1 ring-hairline",
                        )}
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

            <div ref={cardRef} className="min-w-0">
              {selected ? <PricingCard tier={selected} /> : null}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
