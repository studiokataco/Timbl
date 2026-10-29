"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export const CATEGORY_COLORS = [
  { hex: "#fb923c", label: "Coral" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#34d399", label: "Emerald" },
  { hex: "#10b981", label: "Forest" },
  { hex: "#f59e0b", label: "Yellow" },
  { hex: "#fbcfe8", label: "Peach" },
  { hex: "#fde68a", label: "Cream" },
] as const

export const DEFAULT_CATEGORY_COLOR: string = CATEGORY_COLORS[0].hex

function isLight(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 170
}

export function CategoryColorSwatches({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string
  onChange: (hex: string) => void
  label: string
  disabled?: boolean
}) {
  const current = value.toLowerCase()
  const custom = CATEGORY_COLORS.some((c) => c.hex === current) ? null : current
  const options = custom ? [{ hex: custom, label: "Current colour" }, ...CATEGORY_COLORS] : CATEGORY_COLORS

  return (
    <div role="radiogroup" aria-label={label} className="-m-1 flex flex-wrap gap-0.5 sm:gap-1">
      {options.map((swatch) => {
        const selected = current === swatch.hex
        return (
          <button
            key={swatch.hex}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={swatch.label}
            title={swatch.label}
            disabled={disabled}
            onClick={() => onChange(swatch.hex)}
            className="group/swatch grid size-9 place-items-center rounded-full focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 sm:size-8"
          >
            <span
              style={{ backgroundColor: swatch.hex }}
              className={cn(
                "grid size-7 place-items-center rounded-full inset-ring inset-ring-foreground/10 transition-transform duration-150 ease-out sm:size-6",
                "ring-offset-2 ring-offset-background group-focus-visible/swatch:ring-2 group-focus-visible/swatch:ring-ring",
                "group-hover/swatch:scale-110 group-active/swatch:scale-95 motion-reduce:transition-none motion-reduce:group-hover/swatch:scale-100",
                selected && "ring-2 ring-foreground/70",
                isLight(swatch.hex) ? "text-black/70" : "text-white",
              )}
            >
              {selected ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
