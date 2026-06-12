import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

import { CalendarPreview } from "./calendar-preview"

export function Hero() {
  return (
    <section className="px-6 pb-24 pt-20 md:pt-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[13px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            AI agents now draft alongside you
          </span>
          <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Run every brand&apos;s social from one calendar
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Timbl is a calendar-first social media planner for agencies and
            multi-brand teams. Drag posts into place, keep campaigns on track,
            and let AI agents handle the ideas, drafts and scheduling.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button className="h-11 px-6 text-sm" render={<Link href="/signup" />}>
              Get started free
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              variant="outline"
              className="h-11 px-6 text-sm"
              render={<Link href="/login" />}
            >
              Log in
            </Button>
          </div>
          <p className="mt-4 text-[13px] text-muted-foreground">
            Free plan included. No credit card required.
          </p>
        </div>
        <div className="mt-16">
          <CalendarPreview />
        </div>
      </div>
    </section>
  )
}
