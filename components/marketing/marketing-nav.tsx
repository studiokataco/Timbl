import Link from "next/link"

import { TimblWordmark } from "@/components/brand/timbl-logo"
import { Button } from "@/components/ui/button"

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#agents", label: "AI agents" },
  { href: "#how-it-works", label: "How it works" },
]

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <TimblWordmark href="/" />
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/login" />}>
            Log in
          </Button>
          <Button render={<Link href="/signup" />}>Sign up free</Button>
        </div>
      </nav>
    </header>
  )
}
