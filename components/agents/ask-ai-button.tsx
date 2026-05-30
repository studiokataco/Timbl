"use client"

import { Sparkles } from "lucide-react"

import { BrandGlowButton } from "@/components/ui/brand-glow-button"

export function AskAiButton() {
  const handleClick = () => {
    window.dispatchEvent(new Event("agent-modal:open"))
  }

  return (
    <BrandGlowButton
      aria-label="Ask AI"
      flashOnClick
      onClick={handleClick}
      className="fixed bottom-6 left-1/2 z-40 h-11 -translate-x-1/2 gap-2 px-5"
    >
      <Sparkles aria-hidden className="size-4 opacity-80" />
      <span>Ask AI</span>
      <kbd className="font-mono text-[11px] tracking-widest opacity-60 border border-border rounded px-1 py-0.5">
        ⌘J
      </kbd>
    </BrandGlowButton>
  )
}
