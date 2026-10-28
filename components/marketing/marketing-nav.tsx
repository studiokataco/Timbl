"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, X } from "lucide-react"

import { TimblWordmark } from "@/components/brand/timbl-logo"
import { Button } from "@/components/ui/button"

import { ScrollTrigger, scrollToSection } from "./gsap"

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#agents", label: "AI agents" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
]

let pendingSection: string | null = null

const isPlainClick = (e: React.MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useLayoutEffect(() => {
    const id = window.location.hash.slice(1)
    if (pendingSection !== null || !id) return
    // Runs after the sections' pin spacers are inserted, before first paint.
    queueMicrotask(() => scrollToSection(id, { instant: true }))
  }, [])

  useEffect(() => {
    const smooth = pendingSection !== null
    const id = pendingSection ?? window.location.hash.slice(1)
    if (!id || !document.getElementById(id)) {
      pendingSection = null
      return
    }

    let cancelled = false
    let frame = 0
    // Pin spacers and font swaps settle after mount; measure only once they have.
    void document.fonts.ready.then(() => {
      if (cancelled) return
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          pendingSection = null
          ScrollTrigger.refresh()
          scrollToSection(id, { instant: !smooth })
          if (smooth) history.replaceState(null, "", `#${id}`)
        })
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [])

  const goToSection = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return
    e.preventDefault()
    flushSync(() => setOpen(false))
    const id = href.slice(2)
    if (scrollToSection(id)) {
      history.replaceState(null, "", `#${id}`)
      return
    }
    pendingSection = id
    router.push("/")
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
        <TimblWordmark href="/" className="justify-self-start" />
        <div className="hidden items-center justify-center gap-8 md:flex">
          {NAV_LINKS.map((link) =>
            link.href.startsWith("/#") ? (
              <a
                key={link.href}
                href={link.href}
                onClick={goToSection(link.href)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
        <div className="flex items-center justify-end gap-2 justify-self-end">
          <Button
            variant="ghost"
            className="hidden md:inline-flex"
            render={<Link href="/login" />}
          >
            Log in
          </Button>
          <Button render={<Link href="/signup" />}>Sign up free</Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="absolute inset-x-0 top-full border-y border-border/60 bg-background shadow-[0_12px_32px_rgba(0,0,0,0.25)] md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-6 py-2">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("/#") ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={goToSection(link.href)}
                  className="py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ),
            )}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="border-t border-border/60 py-2.5 text-sm font-medium text-foreground"
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
