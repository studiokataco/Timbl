import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

/*
 * Phase 0 placeholder. A single hero with one Airtable-flavoured pill and one
 * primary CTA — enough to confirm DESIGN.md tokens (canvas, ink, signature
 * coral) are flowing into shadcn primitives. Phase 2 replaces this with a
 * redirect to /calendar.
 */
export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl flex flex-col items-start gap-8">
        <Badge
          variant="outline"
          className="rounded-full border-[var(--color-signature-coral)] text-[var(--color-signature-coral)] bg-[var(--color-signature-cream)] px-3 py-1"
        >
          Phase 0 — scaffold
        </Badge>

        <div className="flex flex-col gap-4">
          <h1 className="text-4xl sm:text-5xl font-medium tracking-tight leading-[1.1]">
            BecksUp Planner
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            A calendar-first social planning tool for the SAFE Foundation team.
            Replaces the 9-tab spreadsheet. Quick-add in three taps. Empty days
            that suggest, not accuse.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button size="lg" className="rounded-full px-6">
            Coming soon
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-6">
            Read the PRD
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-8">
          {[
            { label: "Ethical Boutique", color: "var(--color-signature-coral)" },
            { label: "Meet the Team", color: "var(--color-signature-forest)" },
            { label: "Awareness Day", color: "var(--color-signature-peach)" },
            { label: "20th Anniversary", color: "var(--color-signature-mint)" },
            { label: "Did You Know", color: "var(--color-signature-yellow)" },
          ].map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-[#181d26]"
              style={{ backgroundColor: c.color }}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-[#181d26]"
              />
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}
