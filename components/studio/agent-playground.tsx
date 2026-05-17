"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  Plus,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import { updateAgentConfig } from "@/lib/actions/agent-configs"
import { listAgentRuns } from "@/lib/actions/agent-runs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { AgentChat } from "@/components/agents/agent-chat"
import {
  TOOL_CATALOG,
  getTool,
  listToolKeys,
} from "./tool-catalog"
import { STATUS_TONE, PROVIDER_TONE } from "./status-tone"

/*
 * Agent playground — the 4-tab inspector panel that opens when the
 * Studio roster selects an agent via `?focus=agent:<name>`.
 *
 * Replaces the read-only Phase A `AgentPanel`. Carries the full
 * playground UI: Chat (restyled AgentChat), Tune (inline edit form with
 * dirty-field indicators + budgets), Tools (allowedTools cards + adder)
 * and History (runs filtered to this agent + a small stats strip).
 *
 * Mutations go through the existing `updateAgentConfig` server action —
 * no signature changes.
 */

type Props = {
  agent: AgentConfig
  allAgentNames: string[]
}

type TabKey = "chat" | "tune" | "tools" | "history"

const TABS: { key: TabKey; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "tune", label: "Tune" },
  { key: "tools", label: "Tools" },
  { key: "history", label: "History" },
]

export function AgentPlayground({ agent, allAgentNames }: Props) {
  const [tab, setTab] = useState<TabKey>("chat")
  const [unsavedNotice, setUnsavedNotice] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const queryClient = useQueryClient()

  async function runNow() {
    if (running) return
    setRunning(true)
    try {
      const res = await fetch(`/api/agents/${agent.name}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "Run now", trigger: "manual" }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => "")
        toast.error("Run failed to start", { description: detail.slice(0, 200) })
        return
      }
      const runId = res.headers.get("X-Run-Id") ?? "run"
      toast.success(`${agent.name} started`, { id: runId })
      setTab("history")
      // Drain the SSE stream so the connection stays alive until the run
      // finishes server-side. Cancelling the fetch would mark the run
      // `cancelled` (see app/api/agents/[agent]/run/route.ts).
      const reader = res.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }
      queryClient.invalidateQueries({ queryKey: ["agent-runs", agent.name] })
    } catch (err) {
      toast.error("Run failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-5 pt-5 pb-3 border-b border-border">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Agent
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h3 className="text-title-lg text-foreground truncate">
            {agent.name}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={runNow}
              disabled={running || !agent.enabled}
              title={
                agent.enabled
                  ? "Trigger a manual run"
                  : "Enable the agent first"
              }
            >
              {running ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              <span className="ml-1">Run now</span>
            </Button>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wide rounded-pill px-1.5 py-0.5",
                PROVIDER_TONE[agent.provider] ?? "bg-secondary",
              )}
            >
              {agent.provider}
            </span>
          </div>
        </div>
        {agent.description && (
          <p className="mt-1.5 text-body-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
        )}

        <TabList tab={tab} setTab={setTab} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "chat" && (
          <AgentChat
            agentName={agent.name}
            intro={`Sandbox run · nothing persists beyond the session log.`}
            banner={unsavedNotice ?? undefined}
            agentCatalog={allAgentNames}
            onAgentSwitch={(name) => {
              // pivot via URL — parent (inspector) re-renders to the new agent
              if (typeof window !== "undefined") {
                const url = new URL(window.location.href)
                url.searchParams.set("focus", `agent:${name}`)
                window.history.replaceState(null, "", url)
                // force a re-render via routerless event
                window.dispatchEvent(new PopStateEvent("popstate"))
              }
            }}
            className="h-full"
          />
        )}
        {tab === "tune" && (
          <TuneTab
            agent={agent}
            onTestWithEdits={(notice) => {
              setUnsavedNotice(notice)
              setTab("chat")
            }}
          />
        )}
        {tab === "tools" && <ToolsTab agent={agent} />}
        {tab === "history" && <HistoryTab agent={agent} />}
      </div>
    </div>
  )
}

/* ---------------- TabList ---------------- */

function TabList({
  tab,
  setTab,
}: {
  tab: TabKey
  setTab: (t: TabKey) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Agent playground sections"
      className="mt-4 inline-flex items-center gap-1 rounded-pill bg-secondary p-0.5"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        e.preventDefault()
        const idx = TABS.findIndex((t) => t.key === tab)
        const next =
          e.key === "ArrowLeft"
            ? (idx - 1 + TABS.length) % TABS.length
            : (idx + 1) % TABS.length
        setTab(TABS[next].key)
      }}
    >
      {TABS.map((t) => {
        const active = t.key === tab
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-pill px-3 py-1 text-[12px] font-medium transition-colors",
              active
                ? "bg-canvas text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- TuneTab ---------------- */

function TuneTab({
  agent,
  onTestWithEdits,
}: {
  agent: AgentConfig
  onTestWithEdits: (notice: string) => void
}) {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  const [provider, setProvider] = useState<AgentConfig["provider"]>(
    agent.provider,
  )
  const [model, setModel] = useState(agent.model)
  const [temperature, setTemperature] = useState(agent.temperature)
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt ?? "")
  const [schedule, setSchedule] = useState(agent.schedule ?? "")

  const [maxLlmCalls, setMaxLlmCalls] = useState(agent.budgets.maxLlmCalls)
  const [maxToolCalls, setMaxToolCalls] = useState(agent.budgets.maxToolCalls)
  const [maxUsdCost, setMaxUsdCost] = useState(agent.budgets.maxUsdCost)
  const [maxReviewLoops, setMaxReviewLoops] = useState(
    agent.budgets.maxReviewLoops,
  )
  const [monthlyUsdCap, setMonthlyUsdCap] = useState(
    agent.budgets.monthlyUsdCap,
  )

  const [manualTrigger, setManualTrigger] = useState(agent.triggers.manual)
  const [cronTrigger, setCronTrigger] = useState(agent.triggers.cron)
  const [enabled, setEnabled] = useState(agent.enabled)

  const dirty = useMemo(
    () => ({
      provider: provider !== agent.provider,
      model: model !== agent.model,
      temperature: temperature !== agent.temperature,
      systemPrompt: systemPrompt !== (agent.systemPrompt ?? ""),
      schedule: schedule !== (agent.schedule ?? ""),
      maxLlmCalls: maxLlmCalls !== agent.budgets.maxLlmCalls,
      maxToolCalls: maxToolCalls !== agent.budgets.maxToolCalls,
      maxUsdCost: maxUsdCost !== agent.budgets.maxUsdCost,
      maxReviewLoops: maxReviewLoops !== agent.budgets.maxReviewLoops,
      monthlyUsdCap: monthlyUsdCap !== agent.budgets.monthlyUsdCap,
      manual: manualTrigger !== agent.triggers.manual,
      cron: cronTrigger !== agent.triggers.cron,
      enabled: enabled !== agent.enabled,
    }),
    [
      provider,
      model,
      temperature,
      systemPrompt,
      schedule,
      maxLlmCalls,
      maxToolCalls,
      maxUsdCost,
      maxReviewLoops,
      monthlyUsdCap,
      manualTrigger,
      cronTrigger,
      enabled,
      agent,
    ],
  )

  const anyDirty = Object.values(dirty).some(Boolean)

  const reset = () => {
    setProvider(agent.provider)
    setModel(agent.model)
    setTemperature(agent.temperature)
    setSystemPrompt(agent.systemPrompt ?? "")
    setSchedule(agent.schedule ?? "")
    setMaxLlmCalls(agent.budgets.maxLlmCalls)
    setMaxToolCalls(agent.budgets.maxToolCalls)
    setMaxUsdCost(agent.budgets.maxUsdCost)
    setMaxReviewLoops(agent.budgets.maxReviewLoops)
    setMonthlyUsdCap(agent.budgets.monthlyUsdCap)
    setManualTrigger(agent.triggers.manual)
    setCronTrigger(agent.triggers.cron)
    setEnabled(agent.enabled)
  }

  const save = () => {
    startTransition(async () => {
      const res = await updateAgentConfig({
        name: agent.name,
        patch: {
          provider,
          model,
          temperature,
          systemPrompt,
          schedule: schedule || undefined,
          enabled,
          budgets: {
            maxLlmCalls,
            maxToolCalls,
            maxUsdCost,
            maxReviewLoops,
            monthlyUsdCap,
          },
          triggers: {
            manual: manualTrigger,
            cron: cronTrigger,
            systemUserId: agent.triggers.systemUserId,
          },
        },
      })
      if (res.ok) {
        toast.success(`Saved ${agent.name}`)
        queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
        queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
      } else {
        toast.error("Save failed", { description: res.error })
      }
    })
  }

  return (
    <form
      className="h-full overflow-y-auto px-5 py-5 space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <Field label="Provider" dirty={dirty.provider}>
        <Select
          value={provider}
          onValueChange={(v) => setProvider(v as AgentConfig["provider"])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gemini">Gemini</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="mock">Mock (testing)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Model" dirty={dirty.model}>
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={
            provider === "anthropic" ? "claude-sonnet-4-6" : "gemini-2.5-flash"
          }
        />
      </Field>

      <Field label="Temperature" dirty={dirty.temperature}>
        <Input
          type="number"
          step="0.1"
          min={0}
          max={2}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value) || 0)}
          className="tabular-nums"
        />
      </Field>

      <Field label="Schedule (cron)" dirty={dirty.schedule}>
        <Input
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="0 6 * * *"
          className="font-mono"
        />
      </Field>

      <Field label="System prompt" dirty={dirty.systemPrompt}>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={14}
          className="font-mono text-[12px] leading-relaxed"
        />
      </Field>

      <ToggleRow
        label="Enabled"
        dirty={dirty.enabled}
        checked={enabled}
        onChange={setEnabled}
      />
      <ToggleRow
        label="Manual trigger"
        dirty={dirty.manual}
        checked={manualTrigger}
        onChange={setManualTrigger}
      />
      <ToggleRow
        label="Cron trigger"
        dirty={dirty.cron}
        checked={cronTrigger}
        onChange={setCronTrigger}
      />

      <details className="rounded-lg border border-border bg-background overflow-hidden group">
        <summary className="cursor-pointer flex items-center gap-1.5 px-3 py-2 select-none">
          <ChevronRight className="size-3.5 text-muted-foreground group-open:hidden" />
          <ChevronDown className="size-3.5 text-muted-foreground hidden group-open:inline" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Budgets
          </span>
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
          <BudgetField
            label="Max LLM calls"
            dirty={dirty.maxLlmCalls}
            value={maxLlmCalls}
            onChange={setMaxLlmCalls}
            step={1}
          />
          <BudgetField
            label="Max tool calls"
            dirty={dirty.maxToolCalls}
            value={maxToolCalls}
            onChange={setMaxToolCalls}
            step={1}
          />
          <BudgetField
            label="Max USD per run"
            dirty={dirty.maxUsdCost}
            value={maxUsdCost}
            onChange={setMaxUsdCost}
            step={0.1}
          />
          <BudgetField
            label="Max review loops"
            dirty={dirty.maxReviewLoops}
            value={maxReviewLoops}
            onChange={setMaxReviewLoops}
            step={1}
          />
          <BudgetField
            label="Monthly USD cap"
            dirty={dirty.monthlyUsdCap}
            value={monthlyUsdCap}
            onChange={setMonthlyUsdCap}
            step={1}
          />
        </div>
      </details>

      <div className="sticky bottom-0 -mx-5 px-5 py-3 border-t border-border bg-background flex items-center justify-between gap-2">
        {anyDirty ? (
          <button
            type="button"
            onClick={reset}
            className="text-[12px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Discard changes
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            No unsaved changes
          </span>
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!anyDirty}
            onClick={() =>
              onTestWithEdits(
                "Running with unsaved edits — save to persist these changes.",
              )
            }
          >
            Test with edits
          </Button>
          <Button type="submit" size="sm" disabled={pending || !anyDirty}>
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="size-3.5" aria-hidden />
            )}
            Save
          </Button>
        </div>
      </div>
    </form>
  )
}

function Field({
  label,
  dirty,
  children,
}: {
  label: string
  dirty?: boolean
  children: React.ReactNode
}) {
  const id = useMemo(() => `f-${label.replace(/\s+/g, "-").toLowerCase()}`, [
    label,
  ])
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-[12px]">
          {label}
        </Label>
        {dirty && <DirtyDot />}
      </div>
      <div id={id}>{children}</div>
    </div>
  )
}

function DirtyDot() {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        modified
      </span>
    </span>
  )
}

function ToggleRow({
  label,
  dirty,
  checked,
  onChange,
}: {
  label: string
  dirty?: boolean
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Label className="text-[12px]">{label}</Label>
        {dirty && <DirtyDot />}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex items-center h-5 w-9 rounded-full transition-colors",
          checked ? "bg-foreground" : "bg-muted",
        )}
        aria-label={`Toggle ${label}`}
      >
        <span
          aria-hidden
          className={cn(
            "size-4 rounded-full bg-background transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}

function BudgetField({
  label,
  dirty,
  value,
  onChange,
  step,
}: {
  label: string
  dirty?: boolean
  value: number
  onChange: (v: number) => void
  step: number
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Label className="text-[12px]">{label}</Label>
        {dirty && <DirtyDot />}
      </div>
      <Input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-28 tabular-nums text-right"
      />
    </div>
  )
}

/* ---------------- ToolsTab ---------------- */

function ToolsTab({ agent }: { agent: AgentConfig }) {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const allowed = agent.allowedTools

  const persist = (next: string[]) => {
    startTransition(async () => {
      const res = await updateAgentConfig({
        name: agent.name,
        patch: { allowedTools: next },
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
      } else {
        toast.error("Tool update failed", { description: res.error })
      }
    })
  }

  const toggle = (key: string) => {
    persist(
      allowed.includes(key) ? allowed.filter((k) => k !== key) : [...allowed, key],
    )
  }

  const available = listToolKeys().filter((k) => !allowed.includes(k))

  return (
    <div className="h-full overflow-y-auto px-5 py-5 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Enabled tools ({allowed.length})
        </p>
        {allowed.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            No tools enabled. Add one from the catalog below to give this
            agent capabilities beyond plain text.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {allowed.map((key) => (
              <li key={key}>
                <ToolCard
                  toolKey={key}
                  enabled
                  onToggle={() => toggle(key)}
                  pending={pending}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Add tool
          </p>
          <Select
            onValueChange={(v) => {
              if (v) toggle(v)
            }}
            value=""
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select a tool to enable" />
            </SelectTrigger>
            <SelectContent>
              {available.map((k) => {
                const t = getTool(k)
                return (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <Plus className="size-3.5" aria-hidden />
                      {t.title}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

function ToolCard({
  toolKey,
  enabled,
  onToggle,
  pending,
}: {
  toolKey: string
  enabled: boolean
  onToggle: () => void
  pending: boolean
}) {
  const tool = getTool(toolKey)
  return (
    <div className="rounded-lg border border-border bg-canvas p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-title-sm text-foreground truncate">
            {tool.title}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground truncate">
            {tool.key}
          </span>
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
          {tool.description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        disabled={pending}
        className={cn(
          "shrink-0 inline-flex items-center h-5 w-9 rounded-full transition-colors disabled:opacity-50",
          enabled ? "bg-foreground" : "bg-muted",
        )}
        aria-label={`Toggle ${tool.title}`}
      >
        <span
          aria-hidden
          className={cn(
            "size-4 rounded-full bg-background transition-transform",
            enabled ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}

/* ---------------- HistoryTab ---------------- */

function HistoryTab({ agent }: { agent: AgentConfig }) {
  const router = useRouter()
  const params = useSearchParams()

  const { data, isLoading } = useQuery({
    queryKey: ["studio", "runs", "history"],
    queryFn: () => listAgentRuns({ limit: 50 }),
  })

  const runs = useMemo(
    () => (data ?? []).filter((r) => r.agentName === agent.name),
    [data, agent.name],
  )

  const stats = useMemo(() => computeStats(runs), [runs])

  const focus = (id: string) => {
    const sp = new URLSearchParams(params.toString())
    sp.set("focus", `run:${id}`)
    router.replace(`?${sp.toString()}`, { scroll: false })
  }

  return (
    <div className="h-full overflow-y-auto px-5 py-5 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Runs" value={stats.total.toString()} />
        <Stat
          label="Success"
          value={
            stats.total > 0
              ? `${Math.round((stats.success / stats.total) * 100)}%`
              : "—"
          }
        />
        <Stat
          label="Avg dur"
          value={
            stats.avgDurMs != null
              ? `${(stats.avgDurMs / 1000).toFixed(1)}s`
              : "—"
          }
        />
        <Stat label="USD" value={`$${stats.totalUsd.toFixed(2)}`} />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Recent runs
        </p>
        {isLoading && runs.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            No runs yet for this agent.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {runs.map((r) => (
              <li key={r.id}>
                <RunRow run={r} onSelect={() => focus(r.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-canvas px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

function RunRow({
  run,
  onSelect,
}: {
  run: AgentRunDoc
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left rounded-md border border-border bg-background hover:bg-secondary/40 transition-colors px-3 py-2 flex items-center gap-3"
    >
      <Badge
        className={cn(
          "shrink-0 text-[10px] capitalize rounded-pill border-transparent",
          STATUS_TONE[run.status] ?? "",
        )}
      >
        {run.status.replace("_", " ")}
      </Badge>
      <span className="flex-1 min-w-0 text-[11px] font-mono text-muted-foreground truncate">
        {run.id.slice(0, 12)}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {run.durationMs != null
          ? `${(run.durationMs / 1000).toFixed(1)}s`
          : "—"}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        ${run.metrics.usdCost.toFixed(3)}
      </span>
    </button>
  )
}

function computeStats(runs: AgentRunDoc[]) {
  const total = runs.length
  const success = runs.filter((r) => r.status === "succeeded").length
  const durations = runs
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === "number" && d > 0)
  const avgDurMs =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null
  const totalUsd = runs.reduce((sum, r) => sum + (r.metrics.usdCost ?? 0), 0)
  return { total, success, avgDurMs, totalUsd }
}

/* Keep these symbols referenced — small lint guard. */
void TOOL_CATALOG
void Check
