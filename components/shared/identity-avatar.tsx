"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

const FALLBACK_COLORS = ["#7c3aed", "#16a34a", "#ea580c", "#db2777"] as const

function isMidTone(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return false
  const n = parseInt(m[1], 16)
  const lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return lum > 0.12 && lum < 0.8
}

/* Near-black or near-white tones vanish against one of the two themes. */
export function identityColorFor(name: string, color?: string) {
  if (color && isMidTone(color)) return color
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

export function initialsFor(name: string, max = 1) {
  return (
    name
      .trim()
      .split(/[\s_-]+/)
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, max)
      .toUpperCase() || "?"
  )
}

export function IdentityAvatar({
  name,
  src,
  color,
  shape = "square",
  initials = 1,
  className,
}: {
  name: string
  src?: string | null
  color?: string
  shape?: "square" | "circle"
  initials?: number
  className?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const tone = identityColorFor(name, color)
  const showImage = src && failedSrc !== src

  return (
    <span
      aria-hidden
      style={
        showImage
          ? undefined
          : {
              backgroundColor: `color-mix(in oklab, ${tone} 14%, var(--background))`,
              color: tone,
            }
      }
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden text-sm font-semibold select-none",
        "after:pointer-events-none after:absolute after:inset-0 after:border after:border-foreground/10",
        shape === "circle" ? "rounded-full after:rounded-full" : "rounded-lg after:rounded-lg",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Storage token URLs, sized by CSS
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        initialsFor(name, initials)
      )}
    </span>
  )
}
