import { CalendarDays, Layers, Sparkles } from "lucide-react"

import { Reveal } from "./reveal"

const FEATURES = [
  {
    icon: CalendarDays,
    tint: "#8b5cf6",
    title: "Calendar first",
    body: "Plan in the same view you publish from. Months, campaigns and gaps are visible at a glance - no tab-switching, no pivot tables.",
  },
  {
    icon: Layers,
    tint: "#34d399",
    title: "Every brand in its place",
    body: "Workspaces keep each client's channels, categories and approvals separate, so one team can run many brands without crossed wires.",
  },
  {
    icon: Sparkles,
    tint: "#fb923c",
    title: "Agents do the busywork",
    body: "Ideation, drafting and scheduling agents work the plan you set. You approve what ships - nothing publishes without you.",
  },
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[13px] font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Why Timbl
          </span>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight">
            Spreadsheets weren&apos;t built for this
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            More channels, more clients, same week. The tools most teams plan
            on - spreadsheets, docs, list-first schedulers - were never made
            for running several brands at once.
          </p>
        </Reveal>
        <Reveal stagger className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, tint, title, body }) => (
            <div key={title} className="rounded-xl bg-secondary p-8">
              <span
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${tint}1f`, color: tint }}
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
