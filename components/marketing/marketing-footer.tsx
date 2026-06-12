import Link from "next/link"

import { TimblWordmark } from "@/components/brand/timbl-logo"

export function MarketingFooter() {
  return (
    <footer className="bg-surface-dark px-6 py-16 text-zinc-400">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <TimblWordmark className="text-white" />
          <p className="mt-3 max-w-xs text-sm">
            Calendar-first social media planning for agencies and brands.
          </p>
        </div>
        <nav className="flex gap-8 text-sm">
          <Link href="/login" className="transition-colors hover:text-white">
            Log in
          </Link>
          <Link href="/signup" className="transition-colors hover:text-white">
            Sign up
          </Link>
        </nav>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6">
        <p className="text-[13px] text-zinc-500">
          © {new Date().getFullYear()} Timbl
        </p>
      </div>
    </footer>
  )
}
