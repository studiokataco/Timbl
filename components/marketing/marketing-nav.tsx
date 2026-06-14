"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import { TimblWordmark } from "@/components/brand/timbl-logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#agents", label: "AI agents" },
  { href: "#how-it-works", label: "How it works" },
]

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const sc = document.getElementById("landing-scroll")
    if (!sc) return
    const onScroll = () => setScrolled(sc.scrollTop > 60)
    sc.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => sc.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        scrolled ? "glass border-b border-border" : "border-b border-transparent bg-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <TimblWordmark href="/" className={cn(!scrolled && "text-white")} />
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                scrolled
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-white/75 hover:text-white"
              )}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className={cn(!scrolled && "text-white hover:bg-white/10 hover:text-white")}
            render={<Link href="/login" />}
          >
            Log in
          </Button>
          <Button
            className={cn(!scrolled && "bg-white text-[#0c1224] hover:bg-white/90")}
            render={<Link href="/signup" />}
          >
            Sign up free
          </Button>
        </div>
      </nav>
    </header>
  )
}
