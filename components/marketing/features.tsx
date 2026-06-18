import { SceneAgents, SceneCalendar, SceneWorkspaces } from "./feature-scenes"
import { Reveal } from "./reveal"

const FEATURES = [
  {
    title: "Calendar Planning",
    body: "Use the calendar to plan and manage your content. Timelines, campaigns and progress are visible at a glance.",
    Scene: SceneCalendar,
  },
  {
    title: "Every brand has a home",
    body: "Workspaces keep each client's channels, categories and approvals separate, teams can run many brands without crossovers.",
    Scene: SceneWorkspaces,
  },
  {
    title: "Agents do the busywork",
    body: "Ideation, drafting, scheduling and more, let the agents work the plan. Review the results - nothing publishes without you.",
    Scene: SceneAgents,
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
            You&rsquo;re not supposed to be a professional spreadsheet manager!
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Increasing channels, clients and same week deadlines are making it harder to plan. Spreadsheets, Docs, Whatsapp; none of which were made
            for managing multiple brands, creators and channels at once. Timbl helps you fix that.
          </p>
        </Reveal>
        <Reveal stagger className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ title, body, Scene }) => (
            <div
              key={title}
              className="flex flex-col rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex h-[164px] flex-col">
                <Scene />
              </div>
              <h3 className="mt-6 text-lg font-semibold">{title}</h3>
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
