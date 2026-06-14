"use client"

import { useId, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export type SegmentedTab = {
  id: string
  label: ReactNode
}

type Props = {
  tabs: SegmentedTab[]
  value: string
  onChange: (id: string) => void
  className?: string
  listClassName?: string
  scrollable?: boolean
}

export function SegmentedTabs({
  tabs,
  value,
  onChange,
  className,
  listClassName,
  scrollable = false,
}: Props) {
  const reduced = useReducedMotion()
  const pillLayoutId = useId()

  return (
    <div
      className={cn(
        "rounded-full bg-muted p-1",
        scrollable && "overflow-x-auto no-scrollbar",
        className,
      )}
    >
      <div
        role="tablist"
        className={cn(
          "relative flex items-center",
          scrollable ? "min-w-max gap-0.5" : "w-full gap-0.5",
          listClassName,
        )}
      >
        {tabs.map((tab) => {
          const active = tab.id === value
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative z-10 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-background/40 hover:text-foreground",
              )}
            >
              {active ? (
                reduced ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-background shadow-sm"
                  />
                ) : (
                  <motion.span
                    layoutId={pillLayoutId}
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-background shadow-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
