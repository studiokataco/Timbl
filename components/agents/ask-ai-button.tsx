"use client"

import { useEffect, useRef } from "react"
import { Sparkles } from "lucide-react"
import gsap from "gsap"

/**
 * Ask-AI hero button — top-bar trigger for the centered popup modal.
 *
 * Visuals:
 *  - Solid 1.5px brand-accent outline.
 *  - Animated glow (box-shadow) pulses via GSAP-driven --ai-glow (0..1).
 *  - Subtle scale breathe.
 *  - White flash on click; dispatches `agent-modal:open`.
 *
 * Reduced motion: static outline + static dim glow, no animation.
 */
export function AskAiButton() {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const flashRef = useRef<HTMLSpanElement | null>(null)
  const breatheTweenRef = useRef<gsap.core.Tween | null>(null)
  const glowTweenRef = useRef<gsap.core.Tween | null>(null)
  const reducedRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    reducedRef.current = reduce
    if (reduce) {
      if (btnRef.current) {
        btnRef.current.style.setProperty("--ai-glow", "0.5")
      }
      return
    }

    const ctx = gsap.context(() => {
      glowTweenRef.current = gsap.to(btnRef.current, {
        "--ai-glow": 1,
        duration: 1.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      })
      breatheTweenRef.current = gsap.to(btnRef.current, {
        scale: 1.006,
        duration: 4,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      })
    }, btnRef)

    return () => ctx.revert()
  }, [])

  const handleEnter = () => {
    if (reducedRef.current) return
    breatheTweenRef.current?.pause()
    glowTweenRef.current?.pause()
    gsap.to(btnRef.current, {
      scale: 1.02,
      "--ai-glow": 1,
      duration: 0.25,
      ease: "power2.out",
    })
  }

  const handleLeave = () => {
    if (reducedRef.current) return
    gsap.to(btnRef.current, { scale: 1, duration: 0.25, ease: "power2.out" })
    breatheTweenRef.current?.resume()
    glowTweenRef.current?.resume()
  }

  const handleClick = () => {
    if (!reducedRef.current && flashRef.current) {
      gsap
        .timeline()
        .to(flashRef.current, { opacity: 0.35, duration: 0.1, ease: "power1.out" })
        .to(flashRef.current, { opacity: 0, duration: 0.2, ease: "power1.in" })
    }
    window.dispatchEvent(new Event("agent-modal:open"))
  }

  // Outer glow alpha driven by --ai-glow (0..1).
  const boxShadow =
    "0 0 0 1.5px color-mix(in oklab, var(--color-brand-accent, #3b82f6) 80%, transparent), " +
    "0 0 20px -2px color-mix(in oklab, var(--color-brand-accent, #3b82f6) calc(var(--ai-glow, 0) * 70%), transparent)"

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      aria-label="Ask AI"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 inline-flex items-center h-11 rounded-full bg-background will-change-transform shadow-lg"
      style={{ boxShadow }}
    >
      {/* Click flash */}
      <span
        ref={flashRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-white opacity-0"
      />

      {/* Content */}
      <span className="relative flex items-center gap-2 px-5 text-body-sm text-foreground transition-colors">
        <Sparkles aria-hidden className="size-4 opacity-80" />
        <span>Ask AI</span>
        <kbd className="font-mono text-[11px] tracking-widest opacity-60 border border-border rounded px-1 py-0.5">
          ⌘J
        </kbd>
      </span>
    </button>
  )
}
