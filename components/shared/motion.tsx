"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

/*
 * Tiny motion primitives. We don't need a kitchen-sink animation library, just
 * a couple of polished entrance behaviours that honour `prefers-reduced-motion`
 * automatically. Duration sits in the 150-250ms range per DESIGN.md.
 */

type FadeInProps = {
  children: ReactNode
  delay?: number
  className?: string
  /** Slight upward translate on enter. Off by default. */
  rise?: boolean
}

export function FadeIn({ children, delay = 0, className, rise = false }: FadeInProps) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: rise ? 4 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

type StaggerProps = {
  children: ReactNode
  className?: string
  /** Per-child delay in seconds. */
  step?: number
}

export function Stagger({ children, className, step = 0.04 }: StaggerProps) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: step },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 6 },
        show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
      }}
    >
      {children}
    </motion.div>
  )
}
