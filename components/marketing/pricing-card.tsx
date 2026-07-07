"use client"

import type { CSSProperties } from "react"
import Link from "next/link"
import { ArrowRight, CircleCheckBig, Star } from "lucide-react"

import { ShaderBackground } from "@/components/auth/shader-background"
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

export const TIER_HEX: Record<string, string> = {
  free_v1: "#00E89A",
  studio_v1: "#FF5040",
  agency_v1: "#7B5EFF",
}

export function tierTint(id: string): string | null {
  const hex = TIER_HEX[id]
  if (!hex) return null
  return hexChannels(hex)
}

function hexChannels(hex: string): string {
  return [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
    .map((c) => parseInt(c, 16))
    .join(",")
}

function mixHex(hex: string, target: string, t: number): string {
  const mix = (i: number) => {
    const a = parseInt(hex.slice(i, i + 2), 16)
    const b = parseInt(target.slice(i, i + 2), 16)
    return Math.round(a + (b - a) * t)
      .toString(16)
      .padStart(2, "0")
  }
  return `#${mix(1)}${mix(3)}${mix(5)}`
}

function shaderColors(hex: string | undefined) {
  if (!hex) return undefined
  return {
    a: hex,
    b: mixHex(hex, "#000000", 0.3),
    c: mixHex(hex, "#ffffff", 0.55),
    base: mixHex(hex, "#060608", 0.85),
  }
}

function glassLayer(hex: string | undefined): string {
  const tintGlow = hex
    ? `rgba(${hexChannels(hex)},0.16)`
    : "rgba(255,255,255,0.06)"
  return [
    `conic-gradient(from 210deg at 68% 24%, transparent, rgba(255,255,255,0.09) 16%, transparent 34%, ${tintGlow} 52%, transparent 70%, rgba(255,255,255,0.07) 84%, transparent)`,
    `conic-gradient(from 30deg at 26% 74%, transparent, rgba(255,255,255,0.05) 18%, transparent 42%)`,
  ].join(", ")
}

export function PricingCard({ tier, className }: { tier: PricingTier; className?: string }) {
  const hex = TIER_HEX[tier.id]
  const tint = hex ? hexChannels(hex) : "255,255,255"

  return (
    <div
      className={cn("group flex flex-col", className)}
      style={{ "--tint": tint } as CSSProperties}
    >
      <div
        className={cn(
          "flex flex-1 flex-col rounded-3xl bg-[#101012] p-2.5 text-white ring-1 ring-white/10",
          "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "group-hover:ring-[rgba(var(--tint),0.55)] group-hover:shadow-[0_0_56px_-12px_rgba(var(--tint),0.5)]",
        )}
      >
        <div className="relative overflow-hidden rounded-2xl bg-[#0b0b0d] px-6 pb-6 pt-7">
          <ShaderBackground
            colors={shaderColors(hex)}
            flowSpeed={0.35}
            colorIntensity={2.4}
            mouseInfluence={0.12}
          />
          <div
            aria-hidden
            className="pricing-glass absolute -inset-[30%] blur-xl"
            style={{ background: glassLayer(hex) }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02)_38%,transparent_60%)]"
          />
          <div aria-hidden className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
          <div className="relative">
            <Star
              aria-hidden
              className="size-7"
              style={{ color: hex ?? "#ffffff", fill: hex ?? "#ffffff" }}
            />
            <h3 className="mt-5 text-2xl font-semibold tracking-tight">{tier.label}</h3>
            <p className="mt-1.5 text-[15px] text-white/60">{tier.descriptor}</p>
            <p className="mt-7 text-4xl font-semibold tracking-tight md:text-[2.6rem] md:leading-none">
              {tier.priceLabel}
              {tier.priceSuffix ?? ""}
            </p>
            {tier.perBrandNote ? (
              <p className="mt-2 text-xs text-white/50">{tier.perBrandNote}</p>
            ) : null}
          </div>
        </div>

        <ul className="flex-1 space-y-4.5 px-5 pb-4 pt-7">
          {tier.highlights.map((h) => (
            <li key={h} className="flex items-start gap-3.5 text-[15px]">
              <CircleCheckBig
                aria-hidden
                className="mt-0.5 size-5 shrink-0"
                style={{ color: hex ?? "#ffffff" }}
              />
              <span className="text-white/85">{h}</span>
            </li>
          ))}
        </ul>

        <p className="px-5 pb-4 text-xs text-white/40">{tier.footnote}</p>
      </div>

      <div
        className={cn(
          "mt-3.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
          "[@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0",
          "group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100",
        )}
      >
        <div className="rounded-2xl bg-[#101012] p-1.5 ring-1 ring-white/10">
          <Link
            href={tier.cta.href}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#0a0a0a]",
              "transition-all hover:brightness-110 active:scale-[0.99]",
              "ring-1 ring-[rgba(var(--tint),0.8)] shadow-[0_0_28px_-6px_rgba(var(--tint),0.7)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#101012]",
            )}
            style={{
              background: hex
                ? `linear-gradient(180deg, ${mixHex(hex, "#ffffff", 0.08)}, ${mixHex(hex, "#000000", 0.16)})`
                : "linear-gradient(180deg, #ffffff, #e4e4e7)",
            }}
          >
            {tier.cta.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
