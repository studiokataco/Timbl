"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { TimblWordmark } from "@/components/brand/timbl-logo"
import { Button } from "@/components/ui/button"

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#agents", label: "AI agents" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)

  const scrollToAnchor = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.querySelector(href)
    if (!target) return
    e.preventDefault()
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    history.replaceState(null, "", href)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
        <TimblWordmark href="/" className="justify-self-start" />
        <div className="hidden items-center justify-center gap-8 md:flex">
          {NAV_LINKS.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                onClick={scrollToAnchor(link.href)}
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
        <div className="border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl flex-col px-6 py-2">
            {NAV_LINKS.map((link) =>
              link.href.startsWith("#") ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    setOpen(false)
                    scrollToAnchor(link.href)(e)
                  }}
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
