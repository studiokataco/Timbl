import {
  BellRing,
  Bot,
  CalendarPlus,
  CalendarRange,
  Clock,
  Globe,
  Lightbulb,
  PenLine,
  Recycle,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import cronstrue from "cronstrue"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import { AGENT_TEMPLATES } from "@/lib/agents/template-catalog"
import { stageForAgent, type Stage } from "./stage-map"

const TEMPLATE_BY_NAME = new Map(AGENT_TEMPLATES.map((t) => [t.name, t]))

const ICONS: Record<string, LucideIcon> = {
  ideator: Lightbulb,
  "cadence-planner": CalendarRange,
  "awareness-researcher": Globe,
  "gap-filler": CalendarPlus,
  drafter: PenLine,
  repurposer: Recycle,
  "approval-triage": BellRing,
  "brand-auditor": ShieldCheck,
  "client-onboarder": UserPlus,
  scheduler: Clock,
}

export function agentIcon(name: string): LucideIcon {
  return ICONS[name] ?? Bot
}

export function agentLabel(name: string): string {
  const label = TEMPLATE_BY_NAME.get(name)?.label
  if (label) return label
  const words = name.replace(/[-_]+/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function agentTagline(agent: Pick<AgentConfig, "name" | "description">): string {
  return TEMPLATE_BY_NAME.get(agent.name)?.tagline ?? agent.description ?? ""
}

export const GROUPS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "plan", label: "Plan", stages: ["PLAN"] },
  { key: "create", label: "Create", stages: ["DRAFT"] },
  { key: "review", label: "Review", stages: ["REVIEW", "GATE"] },
  { key: "publish", label: "Publish", stages: ["SCHEDULE"] },
  { key: "setup", label: "Setup", stages: ["CONFIG", "OTHER"] },
]

export function groupAgents<T extends { name: string }>(agents: T[]) {
  return GROUPS.map((g) => ({
    ...g,
    agents: agents.filter((a) => g.stages.includes(stageForAgent(a.name))),
  })).filter((g) => g.agents.length > 0)
}

/* Agents that do useful work from stored state alone, so "Run now" can fire
 * with no brief. Everything else needs a conversation first. */
export const HEADLESS_AGENTS: ReadonlySet<string> = new Set([
  "cadence-planner",
  "awareness-researcher",
  "approval-triage",
  "scheduler",
  "pipeline",
])

export type AgentState = "running" | "waiting" | "failed" | "active" | "off"

export function agentState(agent: AgentConfig, runs: AgentRunDoc[]): AgentState {
  if (!agent.enabled) return "off"
  const own = runs.filter((r) => r.agentName === agent.name)
  if (own.some((r) => r.status === "in_progress")) return "running"
  if (own.some((r) => r.status === "awaiting_human")) return "waiting"
  if (own[0]?.status === "failed") return "failed"
  return "active"
}

export const STATE_COPY: Record<AgentState, { label: string; dot: string; text: string }> = {
  running: {
    label: "Running",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
  },
  waiting: {
    label: "Needs approval",
    dot: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-300",
  },
  failed: {
    label: "Last run failed",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
  },
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    text: "text-muted-foreground",
  },
  off: {
    label: "Off",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
}

export const RUN_STATUS_COPY: Record<string, { label: string; dot: string }> = {
  queued: { label: "Queued", dot: "bg-muted-foreground/50" },
  in_progress: { label: "Running", dot: "bg-sky-500" },
  awaiting_human: { label: "Needs approval", dot: "bg-orange-500" },
  succeeded: { label: "Finished", dot: "bg-emerald-500" },
  failed: { label: "Failed", dot: "bg-rose-500" },
  cancelled: { label: "Cancelled", dot: "bg-muted-foreground/50" },
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

export type ScheduleMode = "manual" | "daily" | "weekdays" | "weekly" | "custom"

export type ParsedSchedule = {
  mode: ScheduleMode
  time: string
  weekday: number
  cron: string
}

export function parseSchedule(agent: Pick<AgentConfig, "schedule" | "triggers">): ParsedSchedule {
  const cron = (agent.schedule ?? "").trim()
  const base = { time: "09:00", weekday: 1, cron }
  if (!agent.triggers.cron || !cron) return { ...base, mode: "manual" }
  const m = cron.match(/^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|[0-6])$/)
  if (!m) return { ...base, mode: "custom" }
  const time = `${m[2].padStart(2, "0")}:${m[1].padStart(2, "0")}`
  if (m[3] === "*") return { ...base, time, mode: "daily" }
  if (m[3] === "1-5") return { ...base, time, mode: "weekdays" }
  return { ...base, time, weekday: Number(m[3]), mode: "weekly" }
}

export function buildCron(s: ParsedSchedule): string | null {
  const [h, m] = s.time.split(":").map((n) => Number(n) || 0)
  switch (s.mode) {
    case "manual":
      return null
    case "daily":
      return `${m} ${h} * * *`
    case "weekdays":
      return `${m} ${h} * * 1-5`
    case "weekly":
      return `${m} ${h} * * ${s.weekday}`
    case "custom":
      return s.cron.trim() || null
  }
}

export function clock(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const suffix = h >= 12 ? "pm" : "am"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

export function describeCron(expr: string): string | null {
  try {
    return cronstrue.toString(expr, {
      throwExceptionOnParseError: true,
      use24HourTimeFormat: false,
    })
  } catch {
    return null
  }
}

export function scheduleLabel(agent: Pick<AgentConfig, "schedule" | "triggers">): string {
  const s = parseSchedule(agent)
  switch (s.mode) {
    case "manual":
      return "On demand"
    case "daily":
      return `Daily, ${clock(s.time)}`
    case "weekdays":
      return `Weekdays, ${clock(s.time)}`
    case "weekly":
      return `${WEEKDAYS[s.weekday]}s, ${clock(s.time)}`
    case "custom":
      return describeCron(s.cron) ?? "Custom schedule"
  }
}

export function runTokens(run: AgentRunDoc): number {
  return run.metrics.promptTokens + run.metrics.completionTokens
}
