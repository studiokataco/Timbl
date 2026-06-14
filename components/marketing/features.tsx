import { CalendarDays, Layers, Sparkles } from "lucide-react"

import { Reveal } from "./reveal"

const CAL_DAYS = [
  { d: "M", bars: ["#fb923c"] },
  { d: "T", bars: ["#34d399"] },
  { d: "W", bars: ["#fb923c", "#34d399"] },
  { d: "T", bars: [] },
  { d: "F", bars: ["#8b5cf6"] },
  { d: "S", bars: ["#ec4899"] },
  { d: "S", bars: ["#fb923c"] },
]

const BRANDS = [
  { name: "Sundial", fill: "#fb923c" },
  { name: "Northwind", fill: "#34d399" },
  { name: "Loop & Co", fill: "#8b5cf6" },
]

function CalendarChrome() {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {CAL_DAYS.map((c, i) => (
        <div key={i} className="rounded-md bg-card p-1.5">
          <p className="pb-1 text-center text-[9px] font-medium text-muted-foreground">{c.d}</p>
          <div className="space-y-1">
            {c.bars.map((b, j) => (
              <div key={j} className="h-1.5 rounded-full" style={{ backgroundColor: b }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BrandChrome() {
  return (
    <div className="space-y-2">
      {BRANDS.map((b) => (
        <div key={b.name} className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2">
          <span
            className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: b.fill }}
          >
            {b.name[0]}
          </span>
          <span className="text-xs font-medium">{b.name}</span>
          <span className="ml-auto flex gap-1">
            <span className="size-1.5 rounded-full bg-[#E1306C]" />
            <span className="size-1.5 rounded-full bg-[#1877F2]" />
            <span className="size-1.5 rounded-full bg-[#0A66C2]" />
          </span>
        </div>
      ))}
    </div>
  )
}

function AgentChrome() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Drafter agent</span>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          2 drafts
        </span>
      </div>
      <div className="rounded-lg bg-card px-2.5 py-2">
        <p className="text-[11px] font-medium">Launch teaser</p>
        <div className="mt-1.5 flex gap-1.5">
          <span className="rounded-full bg-success px-2 py-0.5 text-[9px] font-semibold text-white">
            Approve
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            Edit
          </span>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Plan where you publish",
    body: "See every month, campaign and quiet gap in the same view you post from. No tab-switching, no pivot tables, no nasty surprises.",
    chrome: <CalendarChrome />,
  },
  {
    icon: Layers,
    title: "Every brand in its place",
    body: "Each client gets its own workspace - channels, categories and approvals kept cleanly apart. One team, many brands, zero crossed wires.",
    chrome: <BrandChrome />,
  },
  {
    icon: Sparkles,
    title: "Agents do the busywork",
    body: "Your ideation, drafting and scheduling agents work the plan you set. They handle the busywork; you approve what ships. Nothing publishes without you.",
    chrome: <AgentChrome />,
  },
]

export function Features() {
  return (
    <section id="features" className="scroll-mt-16 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            More brands than hours in the day
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            More channels, more clients, the same seven days. The spreadsheets
            and docs you&apos;re holding it together with were never built to
            run a dozen brands at once. Timbl is.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, chrome }, i) => (
            <Reveal key={title} delay={i * 0.08} className="glass flex flex-col rounded-2xl p-6">
              <div className="rounded-xl bg-muted p-3">{chrome}</div>
              <Icon className="mt-5 size-5" />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
