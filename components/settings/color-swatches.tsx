"use client"

import { Check } from "lucide-react"

import { IDENTITY_COLORS } from "@/lib/schemas/identity"
import { cn } from "@/lib/utils"

const NAMES: Record<(typeof IDENTITY_COLORS)[number], string> = {
  "#7c3aed": "Violet",
  "#2563eb": "Blue",
  "#0891b2": "Teal",
  "#16a34a": "Green",
  "#ca8a04": "Amber",
  "#ea580c": "Orange",
  "#db2777": "Pink",
  "#64748b": "Slate",
}

export function ColorSwatches({
  value,
  onChange,
  disabled,
  label,
}: {
  value?: string
  onChange: (color: string) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {IDENTITY_COLORS.map((color) => {
        const selected = value?.toLowerCase() === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={NAMES[color]}
            title={NAMES[color]}
            disabled={disabled}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-white transition-transform duration-150 ease-out",
              "ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "hover:scale-110 active:scale-95 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100",
              selected && "ring-2 ring-foreground/70",
            )}
          >
            {selected ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
          </button>
        )
      })}
    </div>
  )
}
