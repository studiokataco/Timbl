"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import { listAgentRuns } from "@/lib/actions/agent-runs"
import { listIdeationFeed } from "@/lib/actions/ideation"
import { listApprovalsLog, type ApprovalLogRow } from "@/lib/actions/approvals"
import { getStudioUsage, type StudioUsage } from "@/lib/actions/usage"
import { toggleAgent } from "@/lib/actions/agent-configs"
import { agentLabel } from "./agent-meta"

export function useStudioRuns(initial: AgentRunDoc[]) {
  return useQuery({
    queryKey: ["studio", "runs"],
    queryFn: () => listAgentRuns({ limit: 50 }),
    initialData: initial,
    refetchInterval: 4_000,
    staleTime: 0,
  }).data
}

export const HISTORY_LIMIT = 200

export function useStudioHistory(initial: AgentRunDoc[], live: AgentRunDoc[]) {
  const history = useQuery({
    queryKey: ["studio", "runs", "history", HISTORY_LIMIT],
    queryFn: () => listAgentRuns({ limit: HISTORY_LIMIT }),
    initialData: initial,
    refetchInterval: 60_000,
    staleTime: 30_000,
  }).data
  return useMemo(() => {
    const byId = new Map(history.map((r) => [r.id, r]))
    for (const r of live) byId.set(r.id, r)
    const merged = Array.from(byId.values()).sort((a, b) =>
      (a.startedAt ?? "") < (b.startedAt ?? "") ? 1 : -1,
    )
    return { runs: merged, complete: history.length < HISTORY_LIMIT }
  }, [history, live])
}

export function useStudioIdeation(initial: IdeationItem[]) {
  return useQuery({
    queryKey: ["ideation", "new"],
    queryFn: () => listIdeationFeed({ status: "new" }),
    initialData: initial,
    refetchInterval: 8_000,
    staleTime: 0,
  }).data
}

export function useStudioApprovals(initial: ApprovalLogRow[]) {
  return useQuery({
    queryKey: ["studio", "approvals"],
    queryFn: () => listApprovalsLog({ limit: 50 }),
    initialData: initial,
    refetchInterval: 8_000,
    staleTime: 0,
  }).data
}

export function useStudioUsage(initial: StudioUsage) {
  return useQuery({
    queryKey: ["studio", "usage"],
    queryFn: () => getStudioUsage(),
    initialData: initial,
    refetchInterval: 15_000,
    staleTime: 0,
  }).data
}

export type StudioView = {
  agent: string | null
  tab: string | null
  run: string | null
  idea: string | null
}

function readView(search: string): StudioView {
  const params = new URLSearchParams(search)
  const focus = params.get("focus") ?? ""
  return {
    agent: params.get("agent") ?? (focus.startsWith("agent:") ? focus.slice(6) : null),
    tab: params.get("tab"),
    run: params.get("run") ?? (focus.startsWith("run:") ? focus.slice(4) : null),
    idea: params.get("idea") ?? (focus.startsWith("ideation:") ? focus.slice(9) : null),
  }
}

/* View state is local and mirrored to the URL with the History API, so a
 * click never waits on the force-dynamic server render. Legacy
 * `?focus=agent:x` / `run:` / `ideation:` links still resolve. Opening an
 * agent or a sheet pushes, so the back gesture undoes it. */
export type NavDirection = 1 | -1

function directionBetween(from: StudioView, to: StudioView, hint?: NavDirection): NavDirection {
  if (!from.agent && to.agent) return 1
  if (from.agent && !to.agent) return -1
  return hint ?? 1
}

export function useStudioView() {
  const pathname = usePathname()
  const params = useSearchParams()
  const [nav, setNav] = useState<{ view: StudioView; dir: NavDirection }>(() => ({
    view: readView(params.toString()),
    dir: 1,
  }))

  useEffect(() => {
    const onPop = () =>
      setNav((cur) => {
        const view = readView(window.location.search)
        return { view, dir: directionBetween(cur.view, view, -1) }
      })
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const update = useCallback(
    (patch: Partial<StudioView>, mode: "push" | "replace" = "push", dir?: NavDirection) => {
      const sp = new URLSearchParams(window.location.search)
      sp.delete("focus")
      sp.delete("filter")
      for (const [k, v] of Object.entries(patch)) {
        if (v) sp.set(k, v)
        else sp.delete(k)
      }
      const qs = sp.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      if (mode === "push") window.history.pushState({ studioPushed: true }, "", url)
      else window.history.replaceState(window.history.state, "", url)
      setNav((cur) => {
        const view = readView(qs)
        return { view, dir: directionBetween(cur.view, view, dir) }
      })
    },
    [pathname],
  )

  const dismiss = useCallback(
    (patch: Partial<StudioView>) => {
      if (window.history.state?.studioPushed) window.history.back()
      else update(patch, "replace")
    },
    [update],
  )

  return { view: nav.view, dir: nav.dir, update, dismiss }
}

export function useToggleAgent(agents: AgentConfig[]) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState<string | null>(null)

  const merged = agents.map((a) =>
    a.name in overrides ? { ...a, enabled: overrides[a.name] } : a,
  )

  async function toggle(name: string, enabled: boolean) {
    setPending(name)
    setOverrides((o) => ({ ...o, [name]: enabled }))
    const res = await toggleAgent({ name, enabled })
    setPending(null)
    if (!res.ok) {
      setOverrides((o) => {
        const next = { ...o }
        delete next[name]
        return next
      })
      toast.error(enabled ? "Couldn't turn on" : "Couldn't turn off", {
        description: res.error,
        action: enabled
          ? { label: "See plans", onClick: () => router.push("/settings/billing") }
          : undefined,
      })
      return
    }
    toast.success(`${agentLabel(name)} ${enabled ? "is on" : "is off"}`, {
      action: { label: "Undo", onClick: () => void toggle(name, !enabled) },
    })
    queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
    router.refresh()
  }

  return { agents: merged, toggle, pending }
}

export function useRunNow(name: string) {
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)

  async function run() {
    if (running) return
    setRunning(true)
    try {
      const res = await fetch(`/api/agents/${name}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "Run now", trigger: "manual" }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => "")
        toast.error("Run didn't start", { description: detail.slice(0, 200) })
        return
      }
      toast.success(`${agentLabel(name)} started`)
      queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
      /* Cancelling the stream marks the run cancelled server-side, so drain it. */
      const reader = res.body?.getReader()
      if (reader) {
        while (!(await reader.read()).done) {}
      }
      queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
    } catch (err) {
      toast.error("Run failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setRunning(false)
    }
  }

  return { run, running }
}
