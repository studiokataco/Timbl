import { CHANNEL_LABELS } from "@/lib/channels"

import { Reveal } from "./reveal"

const STEPS = [
  {
    title: "Setup your brand's workspace",
    body: "Set up your AI agents, categories, campaigns and templates to help you plan your content faster.",
  },
  {
    title: "Shape the plan",
    body: "Drag-and-drop posts to the Calendar or Kanban view to manage ideas, statuses and seamlessly connect across teams.",
  },
  {
    title: "Let the agents run",
    body: "Drafts and research arrives for review in your brand voice. Approved posts create drafts on your calendar.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-muted px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            How it Works
          </h2>
        </Reveal>
        <Reveal stagger className="mt-14 grid gap-6 md:grid-cols-3">
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
        </Reveal>
      </div>
    </section>
  )
}
