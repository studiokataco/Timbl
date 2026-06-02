"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Globe,
  Lightbulb,
  MoreHorizontal,
  PenLine,
  Send,
  ChevronDown,
  Sparkles,
  Square,
} from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { importThread } from "@/lib/storage/agent-threads"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import {
  MODEL_SUGGESTIONS,
  isLocalAiAvailable,
} from "@/lib/agents/provider-catalog"
import type { AgentProvider } from "@/lib/schemas/agentConfig"

import { AgentChat, type AgentChatHandle } from "./agent-chat"
import { useRosterAgents } from "./use-roster-agents"


const DEFAULT_AGENT = "drafter"
let modalActiveAgent: string | null = null

type Suggestion = {
  label: string
  prompt: string
  icon: typeof PenLine
  tone: "coral" | "forest" | "peach" | "mint" | "yellow" | "muted"
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "Draft a post",
    prompt: "Draft a post about ",
    icon: PenLine,
    tone: "coral",
  },
  {
    label: "Plan the week",
    prompt: "Plan this week's posting cadence across our channels.",
    icon: CalendarClock,
    tone: "forest",
  },
  {
    label: "Brainstorm ideas",
    prompt: "Brainstorm five post ideas for ",
    icon: Lightbulb,
    tone: "peach",
  },
  {
    label: "Awareness day",
    prompt: "Find an awareness day worth posting about next month.",
    icon: Globe,
    tone: "mint",
  },
  {
    label: "Approve drafts",
    prompt: "Triage the pending agent drafts and approve the strongest.",
    icon: CheckCircle2,
    tone: "yellow",
  },
]

const FOOTER_SELECT =
  "h-7 appearance-none rounded-md border border-border bg-background pl-2.5 pr-8 text-caption text-foreground"

const TONE_CLASS: Record<Suggestion["tone"], string> = {
  coral: "text-[oklch(0.65_0.18_25)]",
  forest: "text-[oklch(0.45_0.12_150)]",
  peach: "text-[oklch(0.70_0.13_55)]",
  mint: "text-[oklch(0.65_0.12_175)]",
  yellow: "text-[oklch(0.70_0.14_85)]",
  muted: "text-muted-foreground",
}

export function AgentCommandModal() {
  const orgId = useWorkspaceOrgId()
  const { agentNames, defaultAgent } = useRosterAgents()
  const [open, setOpen] = useState(false)
  const [activeAgent, setActiveAgent] = useState<string>(
    () => modalActiveAgent ?? DEFAULT_AGENT,
  )
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [transcriptLength, setTranscriptLength] = useState(0)
  const [provider, setProvider] = useState<AgentProvider | "">("")
  const [model, setModel] = useState("")
  const chatRef = useRef<AgentChatHandle | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  /* Cmd-J / Ctrl-J toggle (not shift - Cmd-Shift-J is the drawer). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /* Programmatic open from the Ask-AI button. */
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("agent-modal:open", onOpen)
    return () => window.removeEventListener("agent-modal:open", onOpen)
  }, [])

  const pickerAgentNames = useMemo(
    () => (agentNames.length > 0 ? agentNames : [defaultAgent]),
    [agentNames, defaultAgent],
  )
  const resolvedActiveAgent = useMemo(() => {
    if (pickerAgentNames.includes(activeAgent)) return activeAgent
    return defaultAgent
  }, [activeAgent, pickerAgentNames, defaultAgent])

  useEffect(() => {
    modalActiveAgent = resolvedActiveAgent
  }, [resolvedActiveAgent])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const onMessage = useCallback(() => {
    const t = chatRef.current?.getTranscript() ?? []
    setTranscriptLength(t.length)
  }, [])

  const handleAgentSwitch = useCallback((name: string) => {
    setActiveAgent(name)
    setTranscriptLength(0)
  }, [])

  const submit = useCallback(
    (override?: string) => {
      const text = (override ?? input).trim()
      if (!text || streaming) return
      chatRef.current?.submit(text)
      if (override === undefined) setInput("")
    },
    [input, streaming],
  )

  const pickSuggestion = useCallback((s: Suggestion) => {
    setInput(s.prompt)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const len = s.prompt.length
      textareaRef.current?.setSelectionRange(len, len)
    })
  }, [])

  const migrateToSidebar = useCallback(async () => {
    const transcript = chatRef.current?.getTranscript() ?? []
    if (transcript.length === 0) {
      toast.info("Nothing to migrate yet - send a message first.")
      return
    }
    try {
      const thread = await importThread(resolvedActiveAgent, orgId, transcript)
      window.dispatchEvent(
        new CustomEvent("agent-drawer:open-thread", {
          detail: { threadId: thread.id },
        }),
      )
      setOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error("Could not migrate", { description: message })
    }
  }, [resolvedActiveAgent, orgId])

  const canMigrate = transcriptLength > 0 && !streaming
  const isEmpty = transcriptLength === 0

  const providers: AgentProvider[] = ["gemini", "anthropic", "openrouter"]
  if (isLocalAiAvailable()) providers.push("ollama")
  const modelSuggestions = provider ? MODEL_SUGGESTIONS[provider] : []
  const modelDatalistId = "agent-command-modal-models"


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[720px] !w-[92vw] !h-[80vh] !max-h-[80vh] !p-0 !gap-0 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border px-5 py-4 flex items-center justify-between gap-3">
          <DialogTitle className="flex items-center gap-2 text-title-sm">
            <Sparkles className="size-4" aria-hidden /> Ask AI
          </DialogTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={migrateToSidebar}
            disabled={!canMigrate}
            aria-label="Migrate this conversation into the sidebar history"
          >
            View in sidebar
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <AgentChat
            ref={chatRef}
            key={resolvedActiveAgent}
            agentName={resolvedActiveAgent}
            agentCatalog={pickerAgentNames}
            onAgentSwitch={handleAgentSwitch}
            compact
            onStreamingChange={setStreaming}
            onMessage={onMessage}
            providerOverride={provider}
            modelOverride={model}
            className="h-full"
          />
          {isEmpty && (
            <div
              aria-hidden={!isEmpty}
              className="absolute inset-0 flex flex-col items-center justify-center bg-background px-6 py-8"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <div className="mt-6 flex flex-col items-center gap-1 text-center">
                <h2 className="text-body-md text-muted-foreground">
                  Hi there,
                </h2>
                <h3 className="text-title-md">
                  What can {resolvedActiveAgent} do for you?
                </h3>
                <p className="mt-1 max-w-prose text-body-sm text-muted-foreground">
                  Pick a prompt below or just describe what you need.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => pickSuggestion(s)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 text-xs",
                        "text-foreground transition-colors hover:bg-background hover:shadow-sm",
                      )}
                    >
                      <Icon
                        aria-hidden
                        className={cn("size-3.5", TONE_CLASS[s.tone])}
                      />
                      {s.label}
                    </button>
                  )
                })}
                <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground">
                  <MoreHorizontal
                    aria-hidden
                    className={cn("size-3.5", TONE_CLASS.muted)}
                  />
                  …or type your own
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <div className="px-5 py-3">
              <div className="flex items-end gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  rows={1}
                  disabled={streaming}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault()
                      submit()
                    }
                  }}
                  className="min-h-6 max-h-40 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-0 shadow-none outline-none focus-visible:ring-0 disabled:opacity-50 dark:bg-transparent dark:disabled:bg-transparent text-body-sm"
                  aria-label="Message"
                />
                {streaming ? (
                  <Button
                    type="button"
                    size="sm"
                    className="mb-0.5 shrink-0"
                    onClick={() => chatRef.current?.stop()}
                    aria-label="Stop streaming"
                  >
                    <Square className="size-3.5" aria-hidden />
                    Stop
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    className="mb-0.5 shrink-0"
                    disabled={!input.trim()}
                    aria-label="Send"
                  >
                    <Send className="size-3.5" aria-hidden />
                    Send
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/40 px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 uppercase tracking-wide">
                    Agent Mode
                  </span>
                  <div className="relative">
                    <select
                      aria-label="Agent mode"
                      value={resolvedActiveAgent}
                      disabled={streaming}
                      onChange={(e) => handleAgentSwitch(e.target.value)}
                      className={FOOTER_SELECT}
                    >
                      {pickerAgentNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 uppercase tracking-wide">Model</span>
                  <div className="relative">
                    <select
                      aria-label="Provider"
                      value={provider}
                      disabled={streaming}
                      onChange={(e) => {
                        setProvider(e.target.value as AgentProvider | "")
                        setModel("")
                      }}
                      className={FOOTER_SELECT}
                    >
                      <option value="">Agent default</option>
                      {providers.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                  {provider && (
                    <>
                      <input
                        aria-label="Model"
                        list={modelDatalistId}
                        value={model}
                        disabled={streaming}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder={modelSuggestions[0] ?? "model id"}
                        className="h-7 w-40 rounded-md border border-border bg-background px-2.5 text-caption text-foreground"
                      />
                      <datalist id={modelDatalistId}>
                        {modelSuggestions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </>
                  )}
                </div>
              </div>
              <dl className="hidden sm:grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] leading-tight text-muted-foreground/60">
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">esc</kbd>
                  <span>close</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">⌘↵</kbd>
                  <span>send</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">⌘J</kbd>
                  <span>toggle</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">⌘⇧J</kbd>
                  <span>history</span>
                </div>
              </dl>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
