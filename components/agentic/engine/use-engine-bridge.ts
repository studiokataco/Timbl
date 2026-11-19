"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { listIdeationFeed } from "@/lib/actions/ideation"
import { fetchAssistantThread, saveAssistantThread } from "@/lib/actions/assistant-threads"
import { SHELL_THREAD_ID } from "@/lib/constants/timbl"
import { resolveHumanGate } from "@/lib/actions/agent-suggestions"
import { listApprovalsLog } from "@/lib/actions/approvals"
import { listPostComments } from "@/lib/actions/post-comments"
import { listPostReads } from "@/lib/actions/post-reads"
import { listSocialAccounts } from "@/lib/actions/social-accounts"
import { getUsageOverview } from "@/lib/actions/usage"
import { listThreads } from "@/lib/storage/agent-threads"
import { useRosterAgents } from "@/components/agents/use-roster-agents"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { daysUntil } from "../clock"
import { extractMentions } from "../lib"
import type { ActivityEntry, EngineEvent, PrototypeNote, PrototypePost, Run, TranscriptEntry } from "../types"
import { useEngine } from "./engine-context"

const UNSAVED = new Set(["m-intro", "mini-initial"])

export function asPrototypePost(post: WithId<Post>): PrototypePost {
  return {
    ...post,
    tile: { headline: post.brief || post.blurb?.slice(0, 48) || "", format: post.postType },
    contentRev: Date.parse(post.updatedAt ?? "") || 0,
  }
}

type SseEvent = {
  type?: string
  author?: string
  content?: string
  call?: { id?: string; name?: string; args?: Record<string, unknown> }
  result?: { name?: string; response?: Record<string, unknown> }
  error?: { message?: string }
}

async function readSse(
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  onEvent: (event: SseEvent) => void,
  onStart?: (runId: string | null, sessionId: string | null) => void,
): Promise<{ runId: string | null; sessionId: string | null }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => res.statusText)
    let message = text
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text
    } catch {}
    throw new Error(message || res.statusText)
  }
  const runId = res.headers.get("X-Run-Id")
  const sessionId = res.headers.get("X-Session-Id")
  onStart?.(runId, sessionId)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += dec.decode(value, { stream: true })
    for (let idx = buffer.indexOf("\n\n"); idx >= 0; idx = buffer.indexOf("\n\n")) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const data = frame.split("\n").find((line) => line.startsWith("data: "))?.slice(6)
      if (!data || data === "{}") continue
      let event: SseEvent | null = null
      try {
        event = JSON.parse(data) as SseEvent
      } catch {}
      if (event) onEvent(event)
    }
  }
  return { runId, sessionId }
}

function idOf(response: Record<string, unknown> | undefined, key: "postId" | "itemId"): string | null {
  const direct = response?.[key]
  if (typeof direct === "string") return direct
  const nested = (response?.result as Record<string, unknown> | undefined)?.[key]
  return typeof nested === "string" ? nested : null
}

const NO_EVENTS: { name: string; date: string }[] = []

export function EngineBridge({
  posts,
  events = NO_EVENTS,
  surfaceContext = "Calendar",
  threadId = SHELL_THREAD_ID,
  onSaved,
  flushRef,
}: {
  posts: WithId<Post>[]
  events?: { name: string; date: string }[]
  surfaceContext?: string
  threadId?: string
  onSaved?: () => void
  flushRef?: { current: (() => Promise<void>) | null }
}) {
  const orgId = useWorkspaceOrgId()
  const { state, dispatch, env } = useEngine()
  const { defaultAgent } = useRosterAgents()
  const qc = useQueryClient()
  const sessionRef = useRef<string | null>(null)
  const hydrated = useRef(false)
  const persistTimer = useRef<number>(0)
  const streams = useRef(new Map<string, AbortController>())
  const gates = useRef(new Set<string>())
  const onSavedRef = useRef(onSaved)
  const pendingSave = useRef<(() => Promise<void>) | null>(null)
  const [hydratedVersion, setHydratedVersion] = useState(0)
  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  const threadQuery = useQuery({ queryKey: ["assistant-thread", orgId, threadId], queryFn: () => fetchAssistantThread(threadId) })
  const ideasQuery = useQuery({ queryKey: ["ideation-feed", orgId], queryFn: () => listIdeationFeed({ limit: 12 }) })
  const accountsQuery = useQuery({ queryKey: ["social-accounts", orgId], queryFn: () => listSocialAccounts() })
  const usageQuery = useQuery({ queryKey: ["usage-overview", orgId], queryFn: () => getUsageOverview(), staleTime: 60_000 })
  const activityQuery = useQuery({ queryKey: ["approvals-log", orgId], queryFn: () => listApprovalsLog({ limit: 30 }), staleTime: 30_000 })
  const postIds = useMemo(() => posts.map((post) => post.id).sort().slice(0, 60), [posts])
  const notesQuery = useQuery({
    queryKey: ["post-notes", orgId, postIds.join(",")],
    queryFn: async () => {
      const [comments, reads] = await Promise.all([listPostComments(postIds), listPostReads()])
      return { comments, reads }
    },
    enabled: postIds.length > 0,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    dispatch({ type: "hydrate_posts", posts: Object.fromEntries(posts.map((post) => [post.id, asPrototypePost(post)])) })
  }, [dispatch, posts])

  useEffect(() => {
    if (ideasQuery.data) dispatch({ type: "hydrate_ideas", ideas: Object.fromEntries(ideasQuery.data.map((item) => [item.id, item])) })
  }, [dispatch, ideasQuery.data])

  useEffect(() => {
    const metric = usageQuery.data?.metrics.find((m) => m.key === "agentRuns")
    if (metric) dispatch({ type: "hydrate_usage", used: metric.used, limit: metric.limit ?? Number.POSITIVE_INFINITY })
  }, [dispatch, usageQuery.data])

  useEffect(() => {
    if (!notesQuery.data) return
    const notes: PrototypeNote[] = notesQuery.data.comments.map((comment) => ({
      ...comment,
      kind: "note",
      annotations: extractMentions(comment.body, env.team).annotations,
      mentionUserIds: comment.mentions ?? [],
      reactions: comment.reactions ?? [],
      ...(comment.editedAt ? { editedAt: comment.editedAt } : {}),
    }))
    dispatch({ type: "hydrate_notes", notes, reads: notesQuery.data.reads })
  }, [dispatch, env.team, notesQuery.data])

  useEffect(() => {
    if (!activityQuery.data) return
    const entries: ActivityEntry[] = activityQuery.data.map((row) => ({
      id: row.id,
      at: row.createdAt,
      actor: { kind: "user", userId: row.userId },
      kind: row.revertedAt ? "undone" : "approved",
      ...(row.itemType === "post" ? { postId: row.itemId } : {}),
    }))
    if (entries.length) dispatch({ type: "hydrate_activity", entries })
  }, [activityQuery.data, dispatch])

  useEffect(() => {
    const expired = accountsQuery.data?.find((account) => account.status === "needs_reauth")
    const days = expired?.expiresAt ? Math.max(0, daysUntil(expired.expiresAt.slice(0, 10))) : expired ? 1 : null
    dispatch({ type: "hydrate_glance", reconnectDays: days, events: events.filter((event) => daysUntil(event.date) >= 0).slice(0, 2) })
  }, [accountsQuery.data, dispatch, events])

  const boundThread = useRef(threadId)
  useEffect(() => {
    if (boundThread.current === threadId) return
    boundThread.current = threadId
    void pendingSave.current?.()
    pendingSave.current = null
    hydrated.current = false
    sessionRef.current = null
    dispatch({ type: "thread_reset" })
  }, [dispatch, threadId])

  useEffect(() => {
    const thread = threadQuery.data
    if (!thread || hydrated.current) return
    let cancelled = false
    void (async () => {
      let transcript = thread.transcript
      if (threadId === SHELL_THREAD_ID && !thread.idbMigratedAt) {
        const local = await listThreads(orgId)
        const seen = new Set(transcript.map((entry) => entry.id))
        transcript = [...transcript, ...local.flatMap((item) => item.transcript).filter((entry) => !seen.has(entry.id) && !UNSAVED.has(entry.id))]
        await saveAssistantThread({ id: SHELL_THREAD_ID, transcript, idbMigratedAt: new Date().toISOString(), title: local[0]?.title })
      }
      if (cancelled) return
      hydrated.current = true
      if (thread.skippedPostIds?.length) dispatch({ type: "hydrate_skipped", ids: thread.skippedPostIds })
      if (thread.run) dispatch({ type: "hydrate_run", run: thread.run as Run })
      const withPlan = (transcript as Array<TranscriptEntry & { planRunId?: string; errorRunId?: string }>).map((entry) =>
        entry.planRunId
          ? { ...entry, attachments: [{ kind: "plan" as const, runId: entry.planRunId }] }
          : entry.errorRunId
            ? { ...entry, attachments: [{ kind: "error" as const, runId: entry.errorRunId }] }
            : entry,
      )
      if (withPlan.length) dispatch({ type: "hydrate_thread", transcript: withPlan })
      await Promise.resolve()
      if (!cancelled) setHydratedVersion((version) => version + 1)
    })()
    return () => {
      cancelled = true
    }
  }, [dispatch, orgId, threadId, threadQuery.data])

  useEffect(() => {
    if (!hydrated.current || !state.transcript.some((entry) => entry.role === "user")) return
    window.clearTimeout(persistTimer.current)
    const save = async () => {
      pendingSave.current = null
      const seen = new Set<string>()
      const transcript = [...state.miniChat, ...state.transcript]
        .filter((entry) => !UNSAVED.has(entry.id) && !entry.queued && !seen.has(entry.id) && Boolean(seen.add(entry.id)))
        .map((entry) => {
          const planRunId = entry.attachments?.find((item) => item.kind === "plan")?.runId
          const errorRunId = entry.attachments?.find((item) => item.kind === "error")?.runId
          return {
            id: entry.id,
            role: entry.role,
            text: entry.text,
            createdAt: entry.createdAt,
            ...(planRunId ? { planRunId } : {}),
            ...(errorRunId ? { errorRunId } : {}),
          }
        })
        .sort((a, b) => a.createdAt - b.createdAt)
      const result = await saveAssistantThread({ id: threadId, transcript, run: state.run })
      if (result.ok) onSavedRef.current?.()
    }
    pendingSave.current = save
    persistTimer.current = window.setTimeout(() => void save(), 600)
    return () => window.clearTimeout(persistTimer.current)
  }, [state.miniChat, state.run, state.transcript, threadId, hydratedVersion])

  useEffect(() => {
    if (!flushRef) return
    flushRef.current = async () => {
      const save = pendingSave.current
      if (!save) return
      window.clearTimeout(persistTimer.current)
      await save()
    }
    return () => {
      flushRef.current = null
    }
  }, [flushRef])

  useEffect(
    () => () => {
      void pendingSave.current?.()
    },
    [],
  )

  useEffect(() => {
    const live = new Set(state.runs.filter((run) => run.status === "running" || run.status === "needs_you").map((run) => run.id))
    for (const [id, controller] of streams.current) {
      if (!live.has(id)) {
        controller.abort()
        streams.current.delete(id)
      }
    }
    for (const run of state.runs) {
      if (run.status !== "running" || streams.current.has(run.id) || run.serverRunId) continue
      const controller = new AbortController()
      streams.current.set(run.id, controller)
      void stream(run, controller, defaultAgent, sessionRef, dispatch, surfaceContext).then(() => {
        void qc.invalidateQueries({ queryKey: ["posts"] })
        if (run.kind === "ideas" || run.kind === "plan") void qc.invalidateQueries({ queryKey: ["ideation-feed", orgId] })
        void qc.invalidateQueries({ queryKey: ["usage-overview", orgId] })
      })
    }
  }, [defaultAgent, dispatch, orgId, qc, state.runs, surfaceContext])

  useEffect(() => {
    for (const request of state.requests) {
      if (!request.runId || request.status === "pending" || gates.current.has(request.id)) continue
      gates.current.add(request.id)
      if (request.status !== "approved" && request.status !== "changes_requested") continue
      const approved = request.status === "approved"
      const localRunId = request.localRunId
      const controller = new AbortController()
      if (localRunId) streams.current.set(localRunId, controller)
      void resolveHumanGate({ runId: request.runId, decision: approved ? "approve" : "reject", comment: request.feedback }).then(async (res) => {
        if (!res.ok || !res.resumeRunId || !res.resumeToolCallId) {
          if (localRunId) dispatch({ type: "run_failed", runId: localRunId, error: res.error ?? "resume_failed" })
          return
        }
        try {
          await readSse(
            `/api/agents/runs/${res.resumeRunId}/resume`,
            { toolCallId: res.resumeToolCallId, approved, feedback: request.feedback ?? "" },
            controller.signal,
            (event) => localRunId && route(event, localRunId, request.runId ?? null, dispatch),
          )
          if (localRunId) dispatch({ type: "run_done", runId: localRunId })
        } catch (err) {
          if (localRunId && !controller.signal.aborted) dispatch({ type: "run_failed", runId: localRunId, error: err instanceof Error ? err.message : String(err) })
        }
        void qc.invalidateQueries({ queryKey: ["posts"] })
      })
    }
  }, [dispatch, qc, state.requests])

  useEffect(() => {
    const active = streams.current
    return () => {
      for (const controller of active.values()) controller.abort()
      active.clear()
    }
  }, [])

  return null
}

function route(event: SseEvent, runId: string, serverRunId: string | null, dispatch: (event: EngineEvent) => void) {
  if (event.author) dispatch({ type: "run_stage", runId, agent: event.author })
  if (event.type === "content" && event.content) dispatch({ type: "assistant_delta", text: event.content })
  if (event.type === "tool_call" && event.call?.name === "updateDraft") {
    const args = event.call.args ?? {}
    const postId = typeof args.postId === "string" ? args.postId : ""
    const patch = (args.patch ?? {}) as Record<string, unknown>
    const blurb = typeof patch.blurb === "string" ? patch.blurb : undefined
    const detailedBrief = typeof patch.detailedBrief === "string" ? patch.detailedBrief : undefined
    if (postId && (blurb !== undefined || detailedBrief !== undefined)) dispatch({ type: "post_patched", postId, blurb, detailedBrief })
  }
  if (event.type === "tool_result") {
    const postId = event.result?.name === "createDraftPost" ? idOf(event.result.response, "postId") : null
    if (postId) dispatch({ type: "run_post", runId, postId })
  }
  if (event.type === "tool_call" && event.call?.name === "requestHumanApproval") {
    const postId = typeof event.call.args?.postId === "string" ? event.call.args.postId : ""
    dispatch({ type: "request_opened", action: "schedule", postIds: postId ? [postId] : [], runId: serverRunId ?? undefined, localRunId: runId })
  }
}

async function stream(
  run: Run,
  controller: AbortController,
  defaultAgent: string,
  sessionRef: React.RefObject<string | null>,
  dispatch: (event: EngineEvent) => void,
  surfaceContext: string,
) {
  const agents = run.kind === "plan" ? run.steps.map((step) => step.id) : [run.kind === "chat" ? defaultAgent || run.agent : run.agent]
  try {
    for (const agent of agents) {
      if (run.kind === "plan") dispatch({ type: "run_stage", runId: run.id, agent })
      let serverRunId: string | null = null
      let patched = false
      let drafted = ""
      const result = await readSse(
        `/api/agents/${agent}/run`,
        { input: run.kind === "chat" ? `Current app area: ${surfaceContext}. User request: ${run.input}` : run.input, ...(sessionRef.current && run.kind === "chat" ? { sessionId: sessionRef.current } : {}) },
        controller.signal,
        (event) => {
          if (event.type === "error") throw new Error(event.error?.message ?? "agent_error")
          if (event.type === "tool_call" && event.call?.name === "updateDraft") patched = true
          if (run.kind === "refine" && run.refine !== "new_image" && event.type === "content" && event.content) drafted += event.content
          const spoken = run.kind === "chat" || run.kind === "advice"
          const uiEvent = event.type === "content" && !spoken ? { ...event, content: undefined } : event
          route(run.kind === "plan" ? { ...uiEvent, author: undefined } : uiEvent, run.id, serverRunId, dispatch)
        },
        (id) => {
          serverRunId = id
          if (id) dispatch({ type: "run_server", runId: run.id, serverRunId: id })
        },
      )
      if (run.kind === "chat" && result.sessionId) sessionRef.current = result.sessionId
      if (run.kind === "refine" && run.postId && run.refine !== "new_image" && !patched) {
        const blurb = drafted.replace(/\s+/g, " ").trim().slice(0, 2000)
        if (blurb) dispatch({ type: "caption_edited", postId: run.postId, blurb })
      }
    }
    dispatch({ type: "run_done", runId: run.id })
  } catch (err) {
    if (!controller.signal.aborted) dispatch({ type: "run_failed", runId: run.id, error: err instanceof Error ? err.message : String(err) })
  }
}
