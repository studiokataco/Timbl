"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px bg-border lg:grid-cols-4", className)}>{children}</div>
  )
}

export function StatCell({ label, value, sub, visual }: { label: ReactNode; value: ReactNode; sub?: ReactNode; visual?: ReactNode }) {
  return (
    <div className="min-w-0 bg-background px-4 py-3">
      <div className="flex h-7 items-center justify-between gap-2">
        <p className="truncate text-[12px] text-muted-foreground">{label}</p>
        {visual}
      </div>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[20px] font-semibold leading-tight tracking-tight tabular-nums text-foreground">{value}</span>
        {sub && <span className="truncate text-[12px] tabular-nums text-muted-foreground">{sub}</span>}
      </p>
    </div>
  )
}

export function MiniRing({ value, tone, label }: { value: number; tone: string; label: string }) {
  const reduced = useReducedMotion()
  const size = 28
  const stroke = 3.5
  const r = (size - stroke) / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-secondary" />
      {value > 0 && (
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={tone}
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: Math.max(0.03, Math.min(1, value)) }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      )}
    </svg>
  )
}
