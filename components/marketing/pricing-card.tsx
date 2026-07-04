"use client"

import Link from "next/link"
import { ArrowRight, CircleCheck, Star } from "lucide-react"

import { cn } from "@/lib/utils"

export type PricingTier = {
  id: string
  label: string
  descriptor: string
  priceLabel: string
  priceSuffix: string | null
  perBrandNote: string | null
  highlights: string[]
  featured: boolean
  footnote: string
  cta: { label: string; href: string }
}

export function PricingCard({ tier, className }: { tier: PricingTier; className?: string }) {
  const dark = tier.featured
  return (
    <div className={cn("group flex flex-col", className)}>
      <div
        className={cn(
          "flex flex-1 flex-col rounded-2xl p-2 transition-all duration-300",
          dark
            ? "bg-surface-dark text-white ring-1 ring-badge-emerald/30 group-hover:shadow-[0_0_40px_-8px_var(--badge-emerald)] group-hover:ring-badge-emerald/60"
            : "bg-background ring-1 ring-hairline group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] group-hover:ring-foreground/25",
        )}
      >
        <div
          className={cn(
            "rounded-xl p-6",
            dark
              ? "bg-[radial-gradient(120%_140%_at_85%_0%,rgba(52,211,153,0.28),rgba(52,211,153,0.06)_45%,transparent_75%)]"
              : "bg-[radial-gradient(120%_140%_at_85%_0%,rgba(17,17,17,0.08),transparent_65%)]",
          )}
        >
          <Star
            aria-hidden
            className={cn("size-6", dark ? "fill-badge-emerald text-badge-emerald" : "fill-foreground text-foreground")}
          />
          <h3 className="mt-4 text-xl font-semibold tracking-tight">{tier.label}</h3>
          <p className={cn("mt-1 text-sm", dark ? "text-white/60" : "text-muted-foreground")}>
            {tier.descriptor}
          </p>
          <p className="mt-5 text-4xl font-semibold tracking-tight">
            {tier.priceLabel}
            {tier.priceSuffix ? (
              <span className={cn("text-lg font-medium", dark ? "text-white/60" : "text-muted-foreground")}>
                {tier.priceSuffix}
              </span>
            ) : null}
          </p>
          {tier.perBrandNote ? (
            <p className={cn("mt-1 text-xs", dark ? "text-white/50" : "text-muted-foreground")}>
              {tier.perBrandNote}
            </p>
          ) : null}
        </div>

        <ul className="flex-1 space-y-3.5 p-6">
          {tier.highlights.map((h) => (
            <li key={h} className="flex items-start gap-3 text-sm">
              <CircleCheck
                aria-hidden
                className={cn("mt-0.5 size-4.5 shrink-0", dark ? "text-badge-emerald" : "text-foreground")}
              />
              <span className={cn(dark ? "text-white/85" : "text-body")}>{h}</span>
            </li>
          ))}
        </ul>

        <p className={cn("px-6 pb-5 text-xs", dark ? "text-white/45" : "text-muted-foreground")}>
          {tier.footnote}
        </p>
      </div>

      <div
        className={cn(
          "mt-3 transition-all duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
          "[@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0",
          "group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100",
        )}
      >
        <Link
          href={tier.cta.href}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors",
            dark
              ? "bg-badge-emerald/90 text-surface-dark shadow-[0_0_24px_-6px_var(--badge-emerald)] hover:bg-badge-emerald"
              : "bg-primary text-primary-foreground hover:bg-primary/85",
          )}
        >
          {tier.cta.label}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </div>
  )
}
