"use client"

import { Badge } from "@/components/ui/badge"
import { DisclosureTrigger } from "@/components/ui/disclosure"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatRelative, localKey, todayIso } from "../clock"
import { PersonAvatar } from "../collab/person-avatar"
import { StepList } from "../primitives/step-list"
import { REDUCED_POPUP, tw } from "../lib"
import { usePrototype } from "../prototype-context"
import type { ActivityEntry, PrototypePost, Run, TeamMember } from "../types"

export type ActivityPanelProps = {
  tab: "needs" | "log"
  onTab: (t: "needs" | "log") => void
  needs: React.ReactNode[]
  log: ActivityEntry[]
  runs: Run[]
  team: TeamMember[]
  posts: Record<string, PrototypePost>
  assistantAvatar: React.ReactNode
}

export type ActivitySurfaceProps = ActivityPanelProps & {
  open: boolean
  onOpenChange: (o: boolean) => void
  layout: "side" | "bottom" | "frame"
  finalFocus: () => HTMLElement | null
  reduced: boolean
}

function entryLine(
  entry: ActivityEntry,
  team: TeamMember[],
  posts: Record<string, PrototypePost>,
  runs: Run[],
  rows: ReturnType<typeof usePrototype>["copy"]["activity"]["rows"],
  viewerId: string,
  youLabel: string,
): { title: string; meta: string } {
  const actor = entry.actor
  const who =
    actor.kind === "assistant"
      ? ""
      : actor.userId === viewerId
        ? youLabel
        : (team.find((m) => m.id === actor.userId)?.name ?? "Teammate")
  const postTitle = (entry.postId && posts[entry.postId]?.brief) || "post"
  const rel = formatRelative(entry.at)

  switch (entry.kind) {
    case "run": {
      const run = runs.find((r) => r.id === entry.runId)
      return { title: rows.run(run?.title ?? "Agent run"), meta: rows.runMeta(rel) }
    }
    case "drafted":
      return { title: rows.drafted(entry.count ?? 3), meta: rel }
    case "staged":
      return { title: rows.staged(entry.count ?? 3), meta: rel }
    case "approved":
      return { title: rows.approved(who, postTitle), meta: rel }
    case "sent_back":
      return { title: rows.sentBack(who, postTitle), meta: rel }
    case "note":
      return { title: rows.note(who, postTitle), meta: rel }
    case "submitted":
      return { title: rows.submitted(who, postTitle), meta: rel }
    case "request_approved":
      return { title: rows.requestApproved(who, postTitle), meta: rel }
    case "changes_requested":
      return { title: rows.changesRequested(who), meta: rel }
    case "undone":
      return { title: rows.undone(who), meta: rel }
    case "withdrawn":
      return { title: rows.withdrawn(who, postTitle), meta: rel }
    case "stale":
      return { title: rows.stale(who, postTitle), meta: rel }
  }
}

export function ActivityPanel({
  tab,
  onTab,
  needs,
  log,
  runs,
  team,
  posts,
  assistantAvatar,
}: ActivityPanelProps): React.JSX.Element {
  const { copy, viewer, disclosure, setDisclosure } = usePrototype()
  const a = copy.activity
  const todayPrefix = todayIso()
  const today = log.filter((e) => localKey(Date.parse(e.at)).startsWith(todayPrefix))
  const earlier = log.filter((e) => !localKey(Date.parse(e.at)).startsWith(todayPrefix))

  const renderGroup = (heading: string, items: ActivityEntry[]) => {
    if (items.length === 0) return null
    return (
      <section className="flex flex-col gap-2">
        <h2 className="text-caption font-medium text-muted-foreground">{heading}</h2>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((item) => {
            const line = entryLine(item, team, posts, runs, a.rows, viewer.id, copy.notes.you)
            const steps = item.steps ?? runs.find((r) => r.id === item.runId)?.steps
            const key = `run:${item.runId ?? item.id}:steps`
            const open = Boolean(disclosure[key])
            const actor = item.actor
            const person = actor.kind === "user" ? team.find((m) => m.id === actor.userId) : undefined
            const stepsId = `act-steps-${item.id}`
            return (
              <li key={item.id} data-figma="ActivitySurface/row" className="flex items-start gap-3 px-3.5 py-3">
                <div className="mt-0.5 shrink-0">
                  {actor.kind === "assistant" ? (
                    assistantAvatar
                  ) : person ? (
                    <PersonAvatar member={person} size="sm" you={person.id === viewer.id} />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-body-sm font-medium text-foreground">{line.title}</span>
                  <span className="text-caption text-muted-foreground">{line.meta}</span>
                  {steps && steps.length > 0 ? (
                    <div className="mt-1 flex flex-col gap-2">
                      <DisclosureTrigger open={open} onOpenChange={(next) => setDisclosure(key, next)} controls={stepsId}>
                        {open ? a.hideSteps : a.showSteps}
                      </DisclosureTrigger>
                      {open ? (
                        <div id={stepsId}>
                          <StepList steps={steps} density="compact" />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  return (
    <div
      data-slot="agentic-activity-panel"
      data-state={tab}
      data-figma="ActivitySurface/panel"
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <Tabs value={tab} onValueChange={(v) => onTab(v as "needs" | "log")}>
        <TabsList>
          <TabsTrigger value="needs" className="gap-1.5">
            <span>{a.tabs.needs}</span>
            <Badge variant="secondary">{needs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="log">{a.tabs.log}</TabsTrigger>
        </TabsList>
        <TabsContent value="needs" className="flex flex-col gap-3 pt-3">
          {needs.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-muted-foreground">{a.emptyNeeds}</p>
          ) : (
            needs.map((node, index) => <div key={index}>{node}</div>)
          )}
        </TabsContent>
        <TabsContent value="log" className="flex flex-col gap-5 pt-3">
          {log.length === 0 ? (
            <p className="py-6 text-center text-body-sm text-muted-foreground">{a.emptyLog}</p>
          ) : (
            <>
              {renderGroup(a.groups.today, today)}
              {renderGroup(a.groups.earlier, earlier)}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function ActivitySurface({
  open,
  onOpenChange,
  layout,
  finalFocus,
  reduced,
  ...panelProps
}: ActivitySurfaceProps): React.JSX.Element {
  const { copy } = usePrototype()
  if (layout === "frame") {
    return <ActivityPanel {...panelProps} />
  }
  const side = layout === "bottom" ? "bottom" : "right"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        finalFocus={finalFocus}
        data-slot="agentic-activity-surface"
        data-state={panelProps.tab}
        data-figma="ActivitySurface/root"
        className={tw(
          "overflow-y-auto p-5",
          layout === "bottom" && "max-h-9/10 rounded-t-2xl",
          reduced && REDUCED_POPUP,
        )}
      >
        <SheetHeader className="p-0">
          <SheetTitle>
            <span className="text-title-md text-foreground">{copy.activity.title}</span>
          </SheetTitle>
          <SheetDescription>{copy.activity.description}</SheetDescription>
        </SheetHeader>
        <ActivityPanel {...panelProps} />
      </SheetContent>
    </Sheet>
  )
}
