"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useAgenticMotion } from "../prototype-context"
import { MESH, meshAmplitude } from "./motion"

export type MeshBackdropProps = { motion: boolean }

const FIELDS = [
  { id: "b1", token: "var(--badge-emerald)", left: "-10%", top: "-18%", size: "72%", period: MESH.periodsSec[0], dirX: 1, dirY: 1 },
  { id: "b2", token: "var(--badge-violet)", left: "42%", top: "36%", size: "64%", period: MESH.periodsSec[1], dirX: -1, dirY: 1 },
] as const

export function MeshBackdrop({ motion: allowMotion }: MeshBackdropProps): React.JSX.Element {
  const { reduced } = useAgenticMotion()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [amp, setAmp] = useState<{ x: number; y: number }>(() => meshAmplitude(480))
  const animate = allowMotion && !reduced

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 480
      setAmp(meshAmplitude(width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-slot="agentic-mesh-backdrop"
      data-state={animate ? "drifting" : "static"}
      data-figma="MeshBackdrop/root"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-background"
    >
      <div className="relative size-full opacity-40 dark:opacity-20">
        {FIELDS.map((field) => {
          const style: React.CSSProperties = {
            left: field.left,
            top: field.top,
            width: field.size,
            height: field.size,
            backgroundImage: `radial-gradient(closest-side, color-mix(in oklab, ${field.token} 32%, transparent), transparent)`,
          }
          if (!animate) {
            return <div key={field.id} data-figma={`MeshBackdrop/${field.id}`} className="absolute rounded-full" style={style} />
          }
          return (
            <motion.div
              key={field.id}
              data-figma={`MeshBackdrop/${field.id}`}
              className="absolute rounded-full"
              style={style}
              animate={{ x: [0, amp.x * field.dirX, -amp.x * 0.6 * field.dirX], y: [0, amp.y * field.dirY, -amp.y * 0.5 * field.dirY] }}
              transition={{ duration: field.period, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
            />
          )
        })}
      </div>
    </div>
  )
}
