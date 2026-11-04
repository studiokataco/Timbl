"use client"

import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { listIdeationFeed } from "@/lib/actions/ideation"
import {
  fetchAssistantThread,
  saveAssistantThread,
} from "@/lib/actions/assistant-threads"
import { SHELL_THREAD_ID } from "@/lib/constants/timbl"
import { resolveHumanGate } from "@/lib/actions/agent-suggestions"
import { addComment } from "@/lib/actions/post-comments"
import { approveItem } from "@/lib/actions/approvals"
import { updatePost } from "@/lib/actions/posts"
import { markPostRead } from "@/lib/actions/presence"
import { listSocialAccounts } from "@/lib/actions/social-accounts"
import { listThreads } from "@/lib/storage/agent-threads"
import { daysUntil } from "../clock"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import type { PrototypePost, TranscriptEntry } from "../types"
import { parseView } from "../view-state"
import { routeIntent } from "./router"
import { useEngine } from "./engine-context"

function voiceFromUrl() {
  if (typeof window === "undefined") return null
  return parseView(new URLSearchParams(window.location.search)).voice
}

export function asPrototypePost(post: WithId<Post>): PrototypePost {
  return {
    ...post,
    tile: { headline: post.brief || post.blurb?.slice(0, 48) || "Untitled", format: post.postType },
    contentRev: 1,
  }
}

function agentFor(intent: string): string | null {
  if (intent === "ideas" || intent === "more_ideas" || intent === "compare") return "ideator"
  if (intent === "create" || intent === "tighten" || intent === "drafts" || intent === "post_context" || intent === "fallback") {
    return intent === "create" ? "pipeline" : "drafter"
  }
  if (intent === "plan") return null
  return null
}

type SseEvent = {
  type?: string
  content?: string
  call?: { id?: string; name?: string; args?: Record<string, unknown> }
  error?: { message?: string }
}

async function readSse(
  agent: string,
  input: string,
  sessionId: string | undefined,
  onEvent: (event: SseEvent, runId: string | null) => void,
): Promise<{ runId: string | null; sessionId: string | null }> {
  const res = await fetch(`/api/agents/${agent}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, ...(sessionId ? { sessionId } : {}) }),
  })
  if (!res.ok || !res.body) {
    const message = await res.text().catch(() => res.statusText)
    throw new Error(message || "Agent failed")
  }
  const runId = res.headers.get("X-Run-Id")
  const nextSession = res.headers.get("X-Session-Id")
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buffer = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += dec.decode(value, { stream: true })
    for (;;) {
      const idx = buffer.indexOf("\n\n")
      if (idx < 0) break
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const dataLine = frame.split("\n").find((line) => line.startsWith("data: "))
      if (!dataLine) continue
      const payload = dataLine.slice(6)
      if (!payload || payload === "{}") continue
      try {
        onEvent(JSON.parse(payload) as SseEvent, runId)
      } catch {
        /* skip malformed */
      }
    }
  }
  return { runId, sessionId: nextSession }
}

export function EngineBridge({
  posts,
  events = [],
}: {
  posts: WithId<Post>[]
  events?: { name: string; date: string }[]
}) {
  const orgId = useWorkspaceOrgId()
  const { state, dispatch } = useEngine()
  const qc = useQueryClient()
  const sessionRef = useRef<string | null>(null)
  const hydrated = useRef(false)
  const queuedVoice = useRef(voiceFromUrl())
  const voiceOnce = useRef(false)
  const lastUser = useRef("")
  const lastRun = useRef<string | null>(null)
  const persistTimer = useRef<number>(0)
  const noteIds = useRef(new Set<string>())
  const prevRequests = useRef(state.requests)
  const locks = useRef(new Set<string>())

  const threadQuery = useQuery({
    queryKey: ["assistant-thread", orgId, SHELL_THREAD_ID],
    queryFn: () => fetchAssistantThread(SHELL_THREAD_ID),
  })
  const ideasQuery = useQuery({
    queryKey: ["ideation-feed", orgId],
    queryFn: () => listIdeationFeed({ limit: 12 }),
  })
  const accountsQuery = useQuery({
    queryKey: ["social-accounts", orgId],
    queryFn: () => listSocialAccounts(),
  })

  useEffect(() => {
    const mapped: Record<string, PrototypePost> = {}
    for (const post of posts) mapped[post.id] = asPrototypePost(post)
    dispatch({ type: "hydrate_posts", posts: mapped })
  }, [dispatch, posts])

  useEffect(() => {
    if (!queuedVoice.current) queuedVoice.current = voiceFromUrl()
    const script = queuedVoice.current
    const currentId = state.deck.order[state.deck.index]
    const needsDeck = script === "shorter" || script === "funnier" || script === "new_image" || script === "skip" || script === "approve"
    if (!script || voiceOnce.current) return
    if (needsDeck && (!currentId || !state.posts[currentId])) return
    voiceOnce.current = true
    queuedVoice.current = null
    dispatch({ type: "voice_command", script })
  }, [dispatch, state.deck.index, state.deck.order, state.posts])

  useEffect(() => {
    if (!ideasQuery.data) return
    dispatch({
      type: "hydrate_ideas",
      ideas: Object.fromEntries(ideasQuery.data.map((item) => [item.id, item])),
    })
  }, [dispatch, ideasQuery.data])

  useEffect(() => {
    const expired = accountsQuery.data?.find((account) => account.status === "needs_reauth")
    const days = expired?.expiresAt ? Math.max(0, daysUntil(expired.expiresAt.slice(0, 10))) : expired ? 1 : null
    dispatch({
      type: "hydrate_glance",
      reconnectDays: days,
      events: events.filter((event) => daysUntil(event.date) >= 0).slice(0, 2),
    })
  }, [accountsQuery.data, dispatch, events])

  useEffect(() => {
    const thread = threadQuery.data
    if (!thread || hydrated.current) return
    let cancelled = false
    void (async () => {
      let transcript = thread.transcript
      if (!thread.idbMigratedAt) {
        const local = await listThreads(orgId)
        const extra = local.flatMap((item) => item.transcript)
        const seen = new Set(transcript.map((entry) => entry.id))
        transcript = [...transcript, ...extra.filter((entry) => !seen.has(entry.id))]
        await saveAssistantThread({
          id: SHELL_THREAD_ID,
          transcript,
          idbMigratedAt: new Date().toISOString(),
          title: local[0]?.title,
        })
        void qc.invalidateQueries({ queryKey: ["assistant-thread", orgId, SHELL_THREAD_ID] })
      }
      if (cancelled || transcript.length === 0) {
        hydrated.current = true
        return
      }
      dispatch({ type: "hydrate_thread", transcript: transcript as TranscriptEntry[] })
      hydrated.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [dispatch, orgId, qc, threadQuery.data])

  useEffect(() => {
    if (!hydrated.current) return
    if (!state.transcript.some((entry) => entry.role === "user")) return
    window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      const seen = new Set<string>()
      const transcript = [...state.miniChat, ...state.transcript]
        .filter((entry) => {
          if (seen.has(entry.id)) return false
          seen.add(entry.id)
          return true
        })
        .map((entry) => ({
          id: entry.id,
          role: entry.role,
          text: entry.text,
          createdAt: entry.createdAt,
        }))
        .sort((a, b) => a.createdAt - b.createdAt)
      void saveAssistantThread({ id: SHELL_THREAD_ID, transcript })
    }, 400)
    return () => window.clearTimeout(persistTimer.current)
  }, [state.miniChat, state.transcript])

  useEffect(() => {
    const last = [...state.transcript].reverse().find((entry) => entry.role === "user")
    if (!last?.text || last.queued) return
    if (!lastUser.current) {
      lastUser.current = last.id
      return
    }
    if (last.id === lastUser.current) return
    lastUser.current = last.id
    const intent = routeIntent(last.text, {
      card: state.canvas.card,
      hasBrief: state.chosenIdeaId !== null,
      hasDrafts: state.drafts.visible,
      contextPostId: state.context.kind === "post" ? state.context.postId : null,
      pendingOffer: state.pendingOffer,
    })
    const agent = agentFor(intent)
    if (!agent) return
    void (async () => {
      try {
        await readSse(agent, last.text ?? "", sessionRef.current ?? undefined, (event, runId) => {
          if (event.type === "content" && typeof event.content === "string" && event.content) {
            dispatch({ type: "assistant_delta", text: event.content })
          }
          if (event.type === "tool_call" && event.call?.name === "requestHumanApproval") {
            const postId = typeof event.call.args?.postId === "string" ? event.call.args.postId : ""
            dispatch({
              type: "request_opened",
              action: "schedule",
              postIds: postId ? [postId] : [],
              runId: runId ?? undefined,
            })
          }
          if (event.type === "error" && event.error?.message) {
            toast.error(event.error.message)
          }
        }).then((result) => {
          if (result.sessionId) sessionRef.current = result.sessionId
        })
        if (agent === "ideator") {
          void qc.invalidateQueries({ queryKey: ["ideation-feed", orgId] })
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Agent failed")
      }
    })()
  }, [dispatch, orgId, qc, state.canvas.card, state.chosenIdeaId, state.context, state.drafts.visible, state.pendingOffer, state.transcript])

  useEffect(() => {
    if (state.run?.status !== "running" || !state.run.id || state.run.id === lastRun.current) return
    lastRun.current = state.run.id
    void readSse("pipeline", state.run.title, sessionRef.current ?? undefined, (event, runId) => {
      if (event.type === "content" && typeof event.content === "string" && event.content) {
        dispatch({ type: "assistant_delta", text: event.content })
      }
      if (event.type === "tool_call" && event.call?.name === "requestHumanApproval") {
        const postId = typeof event.call.args?.postId === "string" ? event.call.args.postId : ""
        dispatch({
          type: "request_opened",
          action: "schedule",
          postIds: postId ? [postId] : [],
          runId: runId ?? undefined,
        })
      }
    }).then((result) => {
      if (result.sessionId) sessionRef.current = result.sessionId
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Pipeline failed")
    })
  }, [dispatch, state.run])

  useEffect(() => {
    for (const note of state.notes) {
      if (noteIds.current.has(note.id) || note.kind === "system") continue
      noteIds.current.add(note.id)
      void addComment({
        postId: note.postId,
        body: note.body,
        mentions: note.mentionUserIds,
      })
    }
  }, [state.notes])

  useEffect(() => {
    for (const request of state.requests) {
      const before = prevRequests.current.find((item) => item.id === request.id)
      if (before?.status === "pending" && request.status !== "pending") {
        const keys = request.postIds.map(
          (postId) => `${postId}:${state.posts[postId]?.contentRev ?? 0}:${request.action}`,
        )
        if (keys.some((key) => locks.current.has(key))) continue
        for (const key of keys) locks.current.add(key)
        const decision = request.status === "approved" ? "approve" : "reject"
        if (request.runId) {
          void resolveHumanGate({
            runId: request.runId,
            decision,
            comment: request.feedback,
          }).then((res) => {
            if (res.ok && res.resumeRunId && res.resumeToolCallId) {
              void fetch(`/api/agents/runs/${res.resumeRunId}/resume`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  toolCallId: res.resumeToolCallId,
                  approved: decision === "approve",
                  feedback: request.feedback ?? "",
                }),
              })
            }
          })
        } else {
          for (const postId of request.postIds) {
            if (request.status === "approved") {
              if (request.action === "delete") void updatePost({ id: postId, status: "archived" })
              else void approveItem({ itemType: "post", itemId: postId })
            }
          }
        }
      }
    }
    prevRequests.current = state.requests
  }, [state.posts, state.requests])

  const readIds = useRef(new Set<string>())
  useEffect(() => {
    for (const read of state.reads) {
      const key = `${read.userId}:${read.postId}`
      if (readIds.current.has(key)) continue
      readIds.current.add(key)
      void markPostRead(read.postId)
    }
  }, [state.reads])

  return null
}
