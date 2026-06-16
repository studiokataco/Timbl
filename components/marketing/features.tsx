import { CalendarDays, Layers, Sparkles } from "lucide-react"

import { Reveal } from "./reveal"

const FEATURES = [
  {
    icon: CalendarDays,
    tint: "#8b5cf6",
    title: "Planning Environment",
    body: "Plan in the same view you publish from. Months, campaigns and gaps are visible at a glance; and a Kanban view to plan faster.",
  },
  {
    icon: Layers,
    tint: "#34d399",
    title: "Every brand has a home",
    body: "Workspaces keep each client's channels, categories and approvals separate, teams can run many brands without crossovers.",
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
            Why Timbl
       
          </span>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight">
          You’re not a supposed to be a professional spreadsheet manager!
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Increasing channels, clients and same week deadlines are making it harder to plan. Spreadsheets, Docs, Whatsapp; none of which were made
            for managing multiple brands, creators and channels at once. Timbl helps you fix that.
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
