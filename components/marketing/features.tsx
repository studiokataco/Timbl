import { CalendarDays, Layers, Sparkles } from "lucide-react"

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Calendar first",
    body: "Plan in the same view you publish from. Months, campaigns and gaps are visible at a glance - no tab-switching, no pivot tables.",
  },
  {
    icon: Layers,
    title: "Every brand in its place",
    body: "Workspaces keep each client's channels, categories and approvals separate, so one team can run many brands without crossed wires.",
  },
  {
    icon: Sparkles,
    title: "Agents do the busywork",
    body: "Ideation, drafting and scheduling agents work the plan you set. You approve what ships - nothing publishes without you.",
  },
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            Spreadsheets weren&apos;t built for this
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            More channels, more clients, same week. The tools most teams plan
            on - spreadsheets, docs, list-first schedulers - were never made
            for running several brands at once.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl bg-secondary p-8">
              <Icon className="size-5" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
