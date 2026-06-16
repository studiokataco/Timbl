import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"

import { Reveal } from "./reveal"

export function CtaBand() {
  return (
    <section className="px-6 py-24">
      <Reveal className="mx-auto max-w-6xl rounded-2xl bg-secondary px-8 py-16 text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Bring next month&apos;s content to Timbl
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
          Try the free plan for 30 days. No credit
          card required.
        </p>
        <div className="mt-8 flex justify-center">
          <Button className="h-11 px-6 text-sm" render={<Link href="/signup" />}>
            Get started free
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
