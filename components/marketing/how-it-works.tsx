import { Reveal } from "./reveal"
import { SceneAgents, ScenePlan, SceneSetup } from "./how-it-works-scenes"

const STEPS = [
  {
    title: "Setup your brand's workspace",
    body: "Set up your AI agents, categories, campaigns and templates to help you plan your content faster.",
    Scene: SceneSetup,
  },
  {
    title: "Shape the plan",
    body: "Drag-and-drop posts to the Calendar or Kanban view to manage ideas, statuses and seamlessly connect across teams.",
    Scene: ScenePlan,
  },
  {
    title: "MCP and CLI Integration",
    body: "Connect your AI to make autonomous drafts, research, reviews and approvals via our native AI integration capabilities.",
    Scene: SceneAgents,
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-muted px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight">
            How it Works
          </h2>
        </Reveal>
        <Reveal stagger className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => {
            const Scene = step.Scene
            return (
              <div key={step.title} className="rounded-2xl border border-border bg-card p-3">
                <Scene />
                <div className="px-3 pb-3 pt-5">
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </div>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
