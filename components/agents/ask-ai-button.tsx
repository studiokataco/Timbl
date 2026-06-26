"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"

import { BrandGlowButton } from "@/components/ui/brand-glow-button"

export function AskAiButton() {
  const [hidden, setHidden] = useState(false)
  const lastTops = useRef<WeakMap<EventTarget, number>>(new WeakMap())

  useEffect(() => {
    let frame = 0
    const onScroll = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const top = target.scrollTop
      const previous = lastTops.current.get(target) ?? top
      lastTops.current.set(target, top)
      const delta = top - previous
      if (Math.abs(delta) < 6) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setHidden(top > 80 && delta > 0)
      })
    }
    document.addEventListener("scroll", onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true })
      cancelAnimationFrame(frame)
    }
  }, [])

  const handleClick = () => {
    window.dispatchEvent(new Event("agent-modal:open"))
  }

  return (
    <div
      data-hidden={hidden || undefined}
      className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 transition-[transform,opacity] duration-300 ease-out data-[hidden]:pointer-events-none data-[hidden]:translate-y-[calc(100%+2rem)] data-[hidden]:opacity-0 motion-reduce:transition-none"
    >
      <BrandGlowButton
        aria-label="Ask AI"
        flashOnClick
        onClick={handleClick}
        className="h-11 gap-2 px-5"
      >
        <Sparkles aria-hidden className="size-4 opacity-80" />
        <span>Ask AI</span>
        <kbd className="font-mono text-[11px] tracking-widest opacity-60 border border-border rounded px-1 py-0.5">
          ⌘J
        </kbd>
      </BrandGlowButton>
    </div>
  )
}
