"use client"

import {
  useEffect,
  useRef,
  type ComponentProps,
  type MouseEvent,
} from "react"
import gsap from "gsap"

import { brandGlowBoxShadow } from "@/lib/ui/brand-glow-box-shadow"
import { cn } from "@/lib/utils"

export function BrandGlowButton({
  className,
  children,
  onClick,
  flashOnClick = true,
  style,
  ...props
}: ComponentProps<"button"> & { flashOnClick?: boolean }) {
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
      btnRef.current?.style.setProperty("--ai-glow", "0.5")
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
    if (reducedRef.current || props.disabled) return
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
    if (reducedRef.current || props.disabled) return
    gsap.to(btnRef.current, { scale: 1, duration: 0.25, ease: "power2.out" })
    breatheTweenRef.current?.resume()
    glowTweenRef.current?.resume()
  }

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!reducedRef.current && flashOnClick && flashRef.current) {
      gsap
        .timeline()
        .to(flashRef.current, { opacity: 0.35, duration: 0.1, ease: "power1.out" })
        .to(flashRef.current, { opacity: 0, duration: 0.2, ease: "power1.in" })
    }
    onClick?.(e)
  }

  return (
    <button
      ref={btnRef}
      type="button"
      {...props}
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-background text-sm font-medium text-foreground will-change-transform disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      style={{ ...style, boxShadow: brandGlowBoxShadow() }}
    >
      <span
        ref={flashRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-white opacity-0"
      />
      <span className="relative inline-flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  )
}
