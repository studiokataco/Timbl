"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string
  options: { key: T; label: ReactNode }[]
  value: T
  onChange: (key: T) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          disabled={disabled}
          onClick={() => onChange(o.key)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 sm:h-8 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
            value === o.key
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
