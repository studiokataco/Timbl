"use client"

import Link from "next/link"
import { ArrowRight, CircleCheckBig, Star } from "lucide-react"

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

const SILK_DARK = [
  "radial-gradient(90% 120% at 88% -10%, rgba(52,211,153,0.34), transparent 60%)",
  "radial-gradient(70% 100% at 12% 110%, rgba(52,211,153,0.14), transparent 55%)",
  "conic-gradient(from 210deg at 70% 20%, rgba(255,255,255,0.05), transparent 22%, rgba(52,211,153,0.10) 38%, transparent 55%, rgba(255,255,255,0.04) 74%, transparent 90%)",
  "conic-gradient(from 30deg at 25% 75%, transparent, rgba(16,185,129,0.09) 18%, transparent 40%, rgba(255,255,255,0.03) 60%, transparent 80%)",
  "linear-gradient(160deg, #101c17 0%, #0b0f0d 55%, #10171310 100%)",
].join(", ")

const SILK_LIGHT = [
  "radial-gradient(90% 120% at 88% -10%, rgba(17,17,17,0.10), transparent 60%)",
  "conic-gradient(from 210deg at 70% 20%, rgba(17,17,17,0.04), transparent 25%, rgba(17,17,17,0.06) 45%, transparent 70%)",
  "linear-gradient(160deg, #f3f4f6, #fafafa)",
].join(", ")

export function PricingCard({ tier, className }: { tier: PricingTier; className?: string }) {
  const dark = tier.featured
  return (
    <div className={cn("group flex flex-col", className)}>
      <div
        className={cn(
          "flex flex-1 flex-col rounded-3xl p-2.5 transition-all duration-300",
          dark
            ? "bg-[#161616] text-white ring-1 ring-white/10 group-hover:shadow-[0_0_48px_-10px_var(--badge-emerald)] group-hover:ring-badge-emerald/70"
            : "bg-background ring-1 ring-hairline group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] group-hover:ring-foreground/25",
        )}
      >
        <div
          className="rounded-2xl px-6 pb-6 pt-7"
          style={{ background: dark ? SILK_DARK : SILK_LIGHT }}
        >
          <Star
            aria-hidden
            className={cn(
              "size-7",
              dark ? "fill-badge-emerald text-badge-emerald" : "fill-foreground text-foreground",
            )}
          />
          <h3 className="mt-5 text-2xl font-semibold tracking-tight">{tier.label}</h3>
          <p className={cn("mt-1.5 text-[15px]", dark ? "text-white/55" : "text-muted-foreground")}>
            {tier.descriptor}
          </p>
          <p className="mt-7 text-4xl font-semibold tracking-tight md:text-[2.6rem] md:leading-none">
            {tier.priceLabel}
            {tier.priceSuffix ?? ""}
          </p>
          {tier.perBrandNote ? (
            <p className={cn("mt-2 text-xs", dark ? "text-white/45" : "text-muted-foreground")}>
              {tier.perBrandNote}
            </p>
          ) : null}
        </div>

        <ul className="flex-1 space-y-4.5 px-5 pb-4 pt-7">
          {tier.highlights.map((h) => (
            <li key={h} className="flex items-start gap-3.5 text-[15px]">
              <CircleCheckBig
                aria-hidden
                className={cn("mt-0.5 size-5 shrink-0", dark ? "text-badge-emerald" : "text-foreground")}
              />
              <span className={cn(dark ? "text-white/85" : "text-body")}>{h}</span>
            </li>
          ))}
        </ul>

        <p className={cn("px-5 pb-4 text-xs", dark ? "text-white/40" : "text-muted-foreground")}>
          {tier.footnote}
        </p>
      </div>

      <div
        className={cn(
          "mt-3.5 transition-all duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
          "[@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0",
          "group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100",
        )}
      >
        <div
          className={cn(
            "rounded-2xl p-1.5",
            dark ? "bg-[#161616] ring-1 ring-white/10" : "bg-surface-soft ring-1 ring-hairline",
          )}
        >
          <Link
            href={tier.cta.href}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              dark
                ? "bg-[linear-gradient(180deg,rgba(52,211,153,0.85),rgba(16,185,129,0.75))] text-[#08130e] ring-1 ring-badge-emerald/80 shadow-[0_0_28px_-6px_var(--badge-emerald)] hover:brightness-110"
                : "bg-primary text-primary-foreground hover:bg-primary/85",
            )}
          >
            {tier.cta.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
