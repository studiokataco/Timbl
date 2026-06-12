import { CHANNEL_LABELS } from "@/lib/channels"

const STEPS = [
  {
    title: "Connect your channels",
    body: "Bring every brand's accounts into one workspace and post to all of them from a single plan.",
  },
  {
    title: "Shape the plan",
    body: "Lay out categories, campaigns and templates on a drag-and-drop calendar. Gaps and clashes show up before they cost you.",
  },
  {
    title: "Let the agents run",
    body: "Drafts arrive for review in your brand voice. Approved posts publish on schedule, channel by channel.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-muted px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            Up and running in an afternoon
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {Object.values(CHANNEL_LABELS).map((label) => (
              <span
                key={label}
                className="rounded-full border border-border bg-card px-3 py-1 text-[13px] font-medium text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-xl border border-border bg-card p-8">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
