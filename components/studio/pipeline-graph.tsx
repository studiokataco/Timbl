"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import { countPublishablePosts } from "@/lib/actions/posts"
import {
  PIPELINE_STAGES,
  pipelineStageForAgent,
  stageForAgent,
  type PipelineStageKey,
} from "./stage-map"

/*
 * Horizontal pipeline graph - Plan → Draft → Review → Schedule → Publish.
 *
 * Each stage card is a static `feature-icon-card`-style block (white,
 * hairline border, `rounded-lg`, 24px padding) with the stage name,
 * a tabular-nums count of recent runs that touched the stage, and a
 * small avatar stack of the agents responsible. Cards are linked by
 * 1px SVG hairline arrows drawn between them - pure static SVG, no
 * pulses in Phase A.
 *
 * Phase E: Publish stage shows real counts derived from the Posts
 * collection. `scheduled` and `posted` are counted independently via
 * `countPublishablePosts`; the count is server-hydrated through
 * `initialPublishCounts` and re-polled every 15s client-side.
 */
type Props = {
  agents: AgentConfig[]
  runs: AgentRunDoc[]
  initialPublishCounts?: { scheduled: number; posted: number }
}

export function PipelineGraph({ agents, runs, initialPublishCounts }: Props) {
  const { data: publishCounts } = useQuery({
    queryKey: ["studio", "publish-counts"],
    queryFn: () => countPublishablePosts(),
    initialData: initialPublishCounts ?? { scheduled: 0, posted: 0 },
    refetchInterval: 15_000,
    staleTime: 0,
  })
  const { counts, agentsByStage } = useMemo(() => {
    const c: Record<PipelineStageKey, number> = {
      PLAN: 0,
      DRAFT: 0,
      REVIEW: 0,
      SCHEDULE: 0,
      PUBLISH: 0,
    }
    for (const r of runs) {
      const s = pipelineStageForAgent(r.agentName)
      if (s) c[s] += 1
    }
    const a: Record<PipelineStageKey, AgentConfig[]> = {
      PLAN: [],
      DRAFT: [],
      REVIEW: [],
      SCHEDULE: [],
      PUBLISH: [],
    }
    for (const agent of agents) {
      const s = pipelineStageForAgent(agent.name)
      if (s) a[s].push(agent)
      // REVIEW gets human-gate too via the map; CONFIG stays out.
      if (stageForAgent(agent.name) === "GATE" && !a.REVIEW.includes(agent)) {
        a.REVIEW.push(agent)
      }
    }
    return { counts: c, agentsByStage: a }
  }, [agents, runs])

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
      <div className="flex items-stretch gap-0 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
        {PIPELINE_STAGES.map((stage, i) => {
          const isPublish = stage.key === "PUBLISH"
          const primary = isPublish
            ? (publishCounts?.scheduled ?? 0) + (publishCounts?.posted ?? 0)
            : counts[stage.key]
          const secondary = isPublish
            ? publishCounts?.scheduled && publishCounts?.posted
              ? `${publishCounts.scheduled} scheduled · ${publishCounts.posted} posted`
              : publishCounts?.posted
                ? `${publishCounts.posted} posted`
                : publishCounts?.scheduled
                  ? `${publishCounts.scheduled} scheduled`
                  : undefined
            : undefined
          return (
            <div key={stage.key} className="flex items-center shrink-0 snap-start">
              <StageCard
                label={stage.label}
                count={primary}
                secondary={secondary}
                agents={agentsByStage[stage.key]}
              />
              {i < PIPELINE_STAGES.length - 1 && <Arrow />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StageCard({
  label,
  count,
  secondary,
  agents,
}: {
  label: string
  count: number
  secondary?: string
  agents: AgentConfig[]
}) {
  return (
    <div className="rounded-lg bg-secondary border border-transparent p-4 sm:p-6 w-[148px] sm:w-[180px] shrink-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-title-md sm:text-display-sm tabular-nums text-foreground leading-none font-semibold">
        {count}
      </p>
      {secondary && (
        <p className="mt-1 text-body-sm text-muted-foreground tabular-nums">
          {secondary}
        </p>
      )}
      <div className="mt-3 sm:mt-4 flex -space-x-1.5">
        {agents.slice(0, 4).map((a) => (
          <AgentChip key={a.name} name={a.name} />
        ))}
        {agents.length > 4 && (
          <span className="size-6 rounded-full bg-background border border-border flex items-center justify-center text-[10px] text-muted-foreground tabular-nums">
            +{agents.length - 4}
          </span>
        )}
        {agents.length === 0 && (
          <span className="text-[11px] text-muted-foreground">No agent</span>
        )}
      </div>
    </div>
  )
}

function AgentChip({ name }: { name: string }) {
  const initials = name
    .split(/[-_\s]+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      title={name}
      className="size-6 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-medium text-foreground"
    >
      {initials}
    </span>
  )
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 40 24"
      fill="none"
      aria-hidden
      className="h-6 w-6 text-border shrink-0 sm:h-6 sm:w-10"
    >
      <line
        x1="2"
        y1="12"
        x2="32"
        y2="12"
        stroke="currentColor"
        strokeWidth="1"
      />
      <polyline
        points="28,7 33,12 28,17"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
