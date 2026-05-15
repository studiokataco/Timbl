"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  Square,
  Wrench,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { JsonPretty } from "@/components/studio/json-pretty"
import { getTool } from "@/components/studio/tool-catalog"
import { resolveHumanGate } from "@/lib/actions/agent-suggestions"
import { getThread, type ThreadMessage } from "@/lib/storage/agent-threads"
import { LlmStatusBanner } from "./llm-status-banner"

/*
 * Generic agent chat surface — Phase C redesign.
 *
 * Visual shifts from the bubbles-and-details Phase 0 version:
 *   - No avatars, no bubbles. User messages render as a small right-
 *     aligned `surface-card` pill; assistant content flows as plain text
 *     with a 2px ink left rule while streaming.
 *   - Tool calls render as inline chiclet cards (lucide Wrench icon in a
 *     24px secondary square, name + status caption, chevron to expand).
 *     Pending shows a Loader2 spinner; errors flip to a red dot.
 *     Expanded body uses the shared `<JsonPretty />` colorizer extracted
 *     from `run-timeline.tsx`.
 *   - Streaming caret: a blinking ink `▍` at the tail of the streaming
 *     message. Honours `prefers-reduced-motion`.
 *   - Composer: slash autocomplete listing agent names from
 *     `agentCatalog` (or a hardcoded fallback). Selecting an item calls
 *     `onAgentSwitch?(name)` so the parent can pivot the playground;
 *     otherwise it inserts a `/name ` hint into the input.
 *   - Activity sidecar: when a `human-gate` activity / tool_call fires,
 *     a sticky card pins above the composer with Approve / Reject / Edit
 *     stubs (wired in Phase D).
 *
 * The SSE plumbing is unchanged: same /api/agents/{name}/run endpoint,
 * same frame parser, same abort semantics.
 */

type Role = "user" | "assistant" | "system"

interface ToolCall {
  id: string
  name: string
  args: unknown
  result?: unknown
  error?: string
  startedAt: number
  finishedAt?: number
}

interface TranscriptItem {
  id: string
  role: Role
  text?: string
  toolCalls?: ToolCall[]
  createdAt: number
}

interface StructuredEvent {
  type:
    | "thought"
    | "content"
    | "tool_call"
    | "tool_result"
    | "call_code"
    | "code_result"
    | "error"
    | "activity"
    | "tool_confirmation"
    | "finished"
  content?: string
  call?: { id?: string; name?: string; args?: unknown }
  result?: { id?: string; name?: string; response?: unknown }
  error?: { name?: string; message?: string }
  output?: unknown
  kind?: string
  detail?: unknown
}

const FALLBACK_AGENTS = [
  "brand-wizard",
  "ideator",
  "drafter",
  "reviewer",
  "scheduler",
  "cadence-planner",
  "approval-triage",
  "human-gate",
  "meta-config",
  "settings-assistant",
]

export interface AgentChatProps {
  agentName: string
  /** Optional intro message shown before the first turn. */
  intro?: string
  /** Optional banner (e.g. "Running with unsaved edits"). */
  banner?: string
  /** Called after each stream finishes — used to refetch dependent queries. */
  onFinish?: () => void
  /** Optional placeholder shown in the composer. */
  placeholder?: string
  /** Names available for slash autocomplete. */
  agentCatalog?: string[]
  /** Fired when the user picks `/name` from the autocomplete. */
  onAgentSwitch?: (name: string) => void
  /**
   * Optional run identity used to wire the human-gate sidecar. When the
   * chat is in the Studio playground there is no pre-existing runId
   * until the first turn — we capture it from the `X-Run-Id` response
   * header. Brand-wizard and ad-hoc chats can leave this unset, in
   * which case the sidecar renders but its CTAs are disabled.
   */
  runId?: string
  className?: string
  /**
   * When true, the built-in composer + slash autocomplete are hidden.
   * The parent (e.g. AgentDrawer) owns its own input and drives
   * sends via the imperative handle exposed through `ref`.
   */
  compact?: boolean
  /**
   * Fires whenever streaming state flips. Used by the modal composer to
   * disable input while the agent is responding.
   */
  onStreamingChange?: (streaming: boolean) => void
  /**
   * When provided, the chat hydrates its transcript from the persisted
   * thread on mount and remounts will re-hydrate. Pair with `onMessage`
   * to persist mutations back.
   */
  threadId?: string
  /**
   * Fires whenever a transcript item is added or mutated (user send,
   * assistant content stream, tool call). The drawer uses this to
   * persist into IndexedDB.
   */
  onMessage?: (msg: ThreadMessage) => void
}

export interface AgentChatHandle {
  submit: (text: string) => void
  stop: () => void
  getTranscript: () => ThreadMessage[]
}

export const AgentChat = forwardRef<AgentChatHandle, AgentChatProps>(function AgentChat({
  agentName,
  intro,
  banner,
  onFinish,
  placeholder = "Type a message…",
  agentCatalog,
  onAgentSwitch,
  runId: runIdProp,
  className,
  compact = false,
  onStreamingChange,
  threadId,
  onMessage,
}: AgentChatProps, ref) {
  const [transcript, setTranscript] = useState<TranscriptItem[]>([])
  const transcriptRef = useRef<TranscriptItem[]>([])
  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [humanGate, setHumanGate] = useState<{
    summary?: string
    postId?: string
  } | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(
    runIdProp ?? null,
  )
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hydratedThreadRef = useRef<string | null>(null)
  const lastEmittedRef = useRef<Map<string, string>>(new Map())
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  // Hydrate from persisted thread when threadId changes (e.g. parent
  // remounts via key={threadId}, but we also handle in-place swaps).
  useEffect(() => {
    if (!threadId) {
      hydratedThreadRef.current = null
      lastEmittedRef.current = new Map()
      return
    }
    if (hydratedThreadRef.current === threadId) return
    hydratedThreadRef.current = threadId
    let cancelled = false
    void getThread(threadId).then((thread) => {
      if (cancelled) return
      if (!thread) {
        setTranscript([])
        lastEmittedRef.current = new Map()
        return
      }
      const items: TranscriptItem[] = thread.transcript.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        createdAt: m.createdAt,
        toolCalls: m.toolCalls?.map((c) => ({
          id: c.id,
          name: c.name,
          args: c.args,
          result: c.result,
          error: c.error,
          startedAt: 0,
        })),
      }))
      setTranscript(items)
      // Seed the emit cache so hydration doesn't re-persist what we
      // just loaded.
      const seeded = new Map<string, string>()
      for (const m of thread.transcript) seeded.set(m.id, JSON.stringify(m))
      lastEmittedRef.current = seeded
    })
    return () => {
      cancelled = true
    }
  }, [threadId])

  // Emit transcript mutations as ThreadMessage events so the parent
  // can persist them. Compares serialized forms to avoid duplicate
  // writes on no-op renders. IDB writes are cheap so per-token emit
  // is fine for v1.
  useEffect(() => {
    const emit = onMessageRef.current
    if (!emit) return
    for (const item of transcript) {
      const msg: ThreadMessage = {
        id: item.id,
        role: item.role,
        text: item.text,
        toolCalls: item.toolCalls?.map((c) => ({
          id: c.id,
          name: c.name,
          args: c.args,
          result: c.result,
          error: c.error,
        })),
        createdAt: item.createdAt,
      }
      const sig = JSON.stringify({
        id: msg.id,
        role: msg.role,
        text: msg.text,
        toolCalls: msg.toolCalls,
      })
      if (lastEmittedRef.current.get(item.id) === sig) continue
      lastEmittedRef.current.set(item.id, sig)
      emit(msg)
    }
  }, [transcript])

  const intoLatestAssistant = useCallback(
    (mutate: (item: TranscriptItem) => void) => {
      setTranscript((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === "assistant") {
          const next = { ...last, toolCalls: last.toolCalls?.slice() }
          mutate(next)
          return [...prev.slice(0, -1), next]
        }
        const fresh: TranscriptItem = {
          id: crypto.randomUUID(),
          role: "assistant",
          createdAt: Date.now(),
        }
        mutate(fresh)
        return [...prev, fresh]
      })
    },
    [],
  )

  const send = useCallback(async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || streaming) return
    if (override === undefined) setInput("")
    setHumanGate(null)
    setTranscript((p) => {
      const now = Date.now()
      return [
        ...p,
        { id: crypto.randomUUID(), role: "user", text, createdAt: now },
        { id: crypto.randomUUID(), role: "assistant", text: "", createdAt: now },
      ]
    })
    setStreaming(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await fetch(`/api/agents/${agentName}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "")
        throw new Error(detail || `Request failed (${res.status})`)
      }
      const headerRunId = res.headers.get("X-Run-Id")
      if (headerRunId) setActiveRunId(headerRunId)
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
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "))
          if (!dataLine) continue
          const payload = dataLine.slice(6)
          if (!payload || payload === "{}") continue
          try {
            const event = JSON.parse(payload) as StructuredEvent
            applyEvent(event, intoLatestAssistant, setHumanGate)
          } catch {
            /* malformed frame — keep stream alive */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Agent failed", { description: message })
      intoLatestAssistant((item) => {
        item.text = (item.text ?? "") + `\n\n⚠ ${message}`
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
      onFinish?.()
    }
  }, [agentName, input, streaming, intoLatestAssistant, onFinish])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useImperativeHandle(ref, () => ({
    submit: (text: string) => {
      void send(text)
    },
    stop,
    getTranscript: (): ThreadMessage[] => {
      return transcriptRef.current
        .filter((it) => Boolean(it.text) || (it.toolCalls && it.toolCalls.length > 0))
        .map((it) => ({
          id: it.id,
          role: it.role,
          text: it.text,
          toolCalls: it.toolCalls?.map((c) => ({
            id: c.id,
            name: c.name,
            args: c.args,
            result: c.result,
            error: c.error,
          })),
          createdAt: it.createdAt,
        }))
    },
  }), [send, stop])

  useEffect(() => {
    onStreamingChange?.(streaming)
  }, [streaming, onStreamingChange])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [transcript])

  /* Slash autocomplete state derived from the input. */
  const slashState = useMemo(() => {
    if (!input.startsWith("/")) return null
    const query = input.slice(1).split(/\s/)[0].toLowerCase()
    const catalog = agentCatalog ?? FALLBACK_AGENTS
    const matches = catalog
      .filter((n) => n.toLowerCase().includes(query))
      .slice(0, 6)
    if (matches.length === 0) return null
    return { query, matches }
  }, [input, agentCatalog])

  const pickAgent = useCallback(
    (name: string) => {
      if (onAgentSwitch) {
        setInput("")
        onAgentSwitch(name)
      } else {
        setInput(`/${name} `)
      }
    },
    [onAgentSwitch],
  )

  const lastIdx = transcript.length - 1
  const trailingAssistant =
    transcript[lastIdx]?.role === "assistant" ? transcript[lastIdx] : null

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`${agentName} transcript`}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5"
      >
        <LlmStatusBanner />
        {banner && (
          <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-[12px] text-muted-foreground">
            {banner}
          </div>
        )}
        {intro && transcript.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-secondary/20 text-muted-foreground p-3 text-[13px]">
            {intro}
          </div>
        )}
        {transcript.map((item, i) => {
          const isStreaming =
            streaming && i === lastIdx && item.role === "assistant"
          return (
            <Message
              key={item.id}
              item={item}
              isStreaming={isStreaming}
            />
          )
        })}
      </div>

      {humanGate && (
        <HumanGateSidecar
          summary={humanGate.summary}
          postId={humanGate.postId}
          runId={activeRunId ?? runIdProp ?? null}
          onDismiss={() => setHumanGate(null)}
        />
      )}

      {!compact && (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="border-t border-border bg-background px-4 sm:px-6 py-3 relative"
      >
        {slashState && (
          <div
            role="listbox"
            aria-label="Switch agent"
            className="absolute left-4 right-4 sm:left-6 sm:right-6 bottom-[calc(100%+4px)] rounded-lg border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden"
          >
            {slashState.matches.map((name) => (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => pickAgent(name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-secondary/60 transition-colors"
              >
                <span className="text-muted-foreground font-mono text-[11px]">
                  /
                </span>
                <span className="text-foreground">{name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            rows={1}
            disabled={streaming}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault()
                send()
              }
            }}
            className="flex-1 resize-none min-h-10 max-h-40"
            aria-label="Message"
          />
          {streaming ? (
            <Button
              type="button"
              onClick={stop}
              aria-label="Stop streaming"
            >
              <Square className="size-4" aria-hidden />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim()} aria-label="Send">
              <Send className="size-4" aria-hidden />
              Send
            </Button>
          )}
        </div>
      </form>
      )}

      {/* Suppress unused — kept for trailingAssistant tracking */}
      <span hidden aria-hidden>{trailingAssistant ? "1" : "0"}</span>
    </div>
  )
})

/* ---------------- one message ---------------- */

function Message({
  item,
  isStreaming,
}: {
  item: TranscriptItem
  isStreaming: boolean
}) {
  if (item.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-prose rounded-lg bg-secondary px-3 py-2 text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
          {item.text}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "pl-3",
        isStreaming && "border-l-2 border-foreground motion-reduce:border-none",
      )}
    >
      {item.text !== undefined && (
        <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">
          {item.text}
          {isStreaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block w-[0.6em] h-[1em] align-text-bottom bg-foreground motion-safe:animate-pulse motion-reduce:opacity-100"
            />
          )}
        </p>
      )}
      {item.toolCalls && item.toolCalls.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {item.toolCalls.map((c) => (
            <ToolChiclet key={c.id} call={c} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- tool chiclet ---------------- */

function ToolChiclet({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)
  const tool = getTool(call.name)
  const pending = call.result === undefined && !call.error
  const durationS =
    call.finishedAt && call.startedAt
      ? ((call.finishedAt - call.startedAt) / 1000).toFixed(1)
      : null

  const status = call.error
    ? `error: ${call.error}`
    : pending
      ? "calling…"
      : durationS
        ? `done · ${durationS}s`
        : "done"

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/40 transition-colors"
      >
        <span
          aria-hidden
          className="size-6 shrink-0 rounded-md bg-secondary flex items-center justify-center"
        >
          <Wrench className="size-3.5 text-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-foreground truncate">
              {tool.title}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {call.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {call.error && (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-rose-500 shrink-0"
              />
            )}
            <span
              className={cn(
                "text-[11px] truncate",
                call.error
                  ? "text-rose-700 dark:text-rose-300"
                  : "text-muted-foreground",
              )}
            >
              {status}
            </span>
          </div>
        </div>
        <span aria-hidden className="shrink-0">
          {pending ? (
            <Loader2 className="size-3.5 text-muted-foreground motion-safe:animate-spin" />
          ) : open ? (
            <ChevronDown className="size-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" />
          )}
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Arguments
            </p>
            <JsonPretty data={call.args} />
          </div>
          {call.result !== undefined && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Result
              </p>
              <JsonPretty data={call.result} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- human-gate sidecar ---------------- */

function HumanGateSidecar({
  summary,
  postId,
  runId,
  onDismiss,
}: {
  summary?: string
  postId?: string
  runId: string | null
  onDismiss: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState("")
  const [pending, setPending] = useState(false)

  const canAct = !!runId
  async function act(decision: "approve" | "reject") {
    if (!runId) {
      toast.error(
        "No run identity yet — start a turn so the gate can be resolved.",
      )
      return
    }
    setPending(true)
    try {
      const res = await resolveHumanGate({
        runId,
        decision,
        comment: editing && comment.trim() ? comment.trim() : undefined,
      })
      if (!res.ok) {
        toast.error("Failed", { description: res.error })
        return
      }
      toast.success(decision === "approve" ? "Approved" : "Rejected")
      if (res.resumeRunId && res.resumeToolCallId) {
        fetch(`/api/agents/runs/${res.resumeRunId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolCallId: res.resumeToolCallId,
            approved: decision === "approve",
            feedback: editing ? comment.trim() : "",
          }),
        }).catch(() => {
          /* timeline surfaces failure if it happens */
        })
      }
      onDismiss()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="border-t border-border bg-secondary/30 px-4 sm:px-6 py-3">
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 size-2 rounded-full bg-badge-orange shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground">
              Approval requested
            </p>
            {postId && (
              <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
                {postId}
              </p>
            )}
            {summary && (
              <p className="mt-1 text-[12px] text-muted-foreground whitespace-pre-wrap line-clamp-3">
                {summary}
              </p>
            )}
          </div>
        </div>
        {editing && (
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note for the agent (optional)…"
            rows={2}
            className="mt-2 bg-background"
            aria-label="Approval comment"
          />
        )}
        <div className="mt-2.5 flex items-center gap-2 justify-end">
          {!editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={pending || !canAct}
            >
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => act("reject")}
            disabled={pending || !canAct}
          >
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => act("approve")}
            disabled={pending || !canAct}
          >
            {editing ? "Approve with note" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------------- event reducer ---------------- */

function applyEvent(
  event: StructuredEvent,
  intoLatestAssistant: (mutate: (item: TranscriptItem) => void) => void,
  setHumanGate: (g: { summary?: string; postId?: string } | null) => void,
) {
  switch (event.type) {
    case "content":
      if (typeof event.content === "string") {
        intoLatestAssistant((item) => {
          item.text = (item.text ?? "") + event.content!
        })
      }
      break
    case "tool_call": {
      const name = event.call?.name ?? "tool"
      intoLatestAssistant((item) => {
        const calls = item.toolCalls ?? (item.toolCalls = [])
        calls.push({
          id: event.call?.id ?? crypto.randomUUID(),
          name,
          args: event.call?.args,
          startedAt: Date.now(),
        })
      })
      if (name === "requestHumanApproval") {
        const args = (event.call?.args ?? {}) as {
          postId?: string
          summary?: string
        }
        setHumanGate({ postId: args.postId, summary: args.summary })
      }
      break
    }
    case "tool_result":
      intoLatestAssistant((item) => {
        const calls = item.toolCalls ?? []
        const target = calls.find(
          (c) => c.id === event.result?.id || c.name === event.result?.name,
        )
        if (target) {
          target.result = event.result?.response
          target.finishedAt = Date.now()
        }
      })
      break
    case "activity":
      if (event.kind === "human-gate") {
        const detail = (event.detail ?? {}) as {
          postId?: string
          summary?: string
        }
        setHumanGate({ postId: detail.postId, summary: detail.summary })
      }
      break
    case "error":
      intoLatestAssistant((item) => {
        const message = event.error?.message ?? "Unknown agent error"
        item.text = (item.text ?? "") + `\n\n⚠ ${message}`
      })
      break
    /* thought / finished / tool_confirmation — not rendered here */
  }
}
