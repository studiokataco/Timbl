import Link from "next/link"

import { TimblWordmark } from "@/components/brand/timbl-logo"

import { Reveal } from "./reveal"

export function MarketingFooter() {
  return (
    <footer className="bg-surface-dark px-6 py-16 text-zinc-400">
      <Reveal className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <TimblWordmark className="text-white" />
          <p className="mt-3 max-w-xs text-sm">
            An AI Planner that works with you.
          </p>
        </div>
        <nav className="flex gap-8 text-sm">
          <Link href="/pricing" className="transition-colors hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="transition-colors hover:text-white">
            Sign up
          </Link>
        </nav>
      </Reveal>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-zinc-500">
          © {new Date().getFullYear()} Timbl
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-zinc-500">
          <Link href="/privacy" className="transition-colors hover:text-zinc-300">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-zinc-300">
            Terms
          </Link>
          <Link href="/refunds" className="transition-colors hover:text-zinc-300">
            Refunds
          </Link>
          <Link href="/shipping" className="transition-colors hover:text-zinc-300">
            Delivery
          </Link>
          <Link href="/contact" className="transition-colors hover:text-zinc-300">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  )
}
