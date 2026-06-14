import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

export function CtaBand() {
  return (
    <section className="px-6 py-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0c1224] px-8 py-20 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(123,94,255,0.25),transparent_60%)]"
        />
        <div className="relative">
          <h2 className="text-balance text-3xl font-medium tracking-tight md:text-5xl">
            Next month doesn&apos;t have to feel like{" "}
            <span className="bg-gradient-to-r from-[#00E89A] via-[#7B5EFF] to-[#FF5040] bg-clip-text text-transparent">
              last month
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-white/65">
            Start free, invite the team, and watch the calendar fill itself in.
            Upgrade only when you outgrow it - no credit card to begin.
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              className="h-11 bg-white px-6 text-sm text-[#0c1224] hover:bg-white/90"
              render={<Link href="/signup" />}
            >
              Get started free
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
