"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { ArrowRight, Send, Sparkles, Square } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { listAgentConfigs } from "@/lib/actions/agent-configs"
import { importThread } from "@/lib/storage/agent-threads"

import { AgentChat, type AgentChatHandle } from "./agent-chat"

/*
 * Centered popup modal — the lightweight, ephemeral AI surface.
 *
 * Cmd-J toggles. `agent-modal:open` opens it. Active agent persists
 * across open/close within the page session via a module-level ref;
 * the AgentChat is remounted (key={activeAgent}) when switching so
 * transcripts reset cleanly.
 *
 * No threadId is passed → conversations stay in-memory. The header's
 * "View in sidebar →" button migrates the live transcript into a new
 * persistent thread (via importThread), opens the drawer focused on
 * that thread, and closes the modal.
 */

const DEFAULT_AGENT = "settings-assistant"
let modalActiveAgent: string | null = null

export function AgentCommandModal() {
  const [open, setOpen] = useState(false)
  const [activeAgent, setActiveAgent] = useState<string>(
    () => modalActiveAgent ?? DEFAULT_AGENT,
  )
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [transcriptLength, setTranscriptLength] = useState(0)
  const chatRef = useRef<AgentChatHandle | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    modalActiveAgent = activeAgent
  }, [activeAgent])

  // Cmd-J / Ctrl-J toggle (not shift — Cmd-Shift-J is the drawer).
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

  // Programmatic open from the Ask-AI button.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("agent-modal:open", onOpen)
    return () => window.removeEventListener("agent-modal:open", onOpen)
  }, [])

  const { data: agentConfigs = [] } = useQuery({
    queryKey: ["agent-configs"],
    queryFn: listAgentConfigs,
    staleTime: 30_000,
  })

  const agentNames =
    agentConfigs.length > 0 ? agentConfigs.map((c) => c.name) : [DEFAULT_AGENT]

  // Auto-resize the composer textarea.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const onMessage = useCallback(() => {
    // AgentChat fires onMessage per transcript item; we use it only
    // to know whether anything has been sent. Pull current count from
    // the imperative handle so we count distinct items.
    const t = chatRef.current?.getTranscript() ?? []
    setTranscriptLength(t.length)
  }, [])

  const handleAgentSwitch = useCallback((name: string) => {
    setActiveAgent(name)
    // Chat remounts via key={activeAgent}; clear any previous count.
    setTranscriptLength(0)
  }, [])

  const submit = useCallback(() => {
    const text = input.trim()
    if (!text || streaming) return
    chatRef.current?.submit(text)
    setInput("")
  }, [input, streaming])

  const migrateToSidebar = useCallback(async () => {
    const transcript = chatRef.current?.getTranscript() ?? []
    if (transcript.length === 0) {
      toast.info("Nothing to migrate yet — send a message first.")
      return
    }
    try {
      const thread = await importThread(activeAgent, transcript)
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
  }, [activeAgent])

  const canMigrate = transcriptLength > 0 && !streaming

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[720px] !w-[92vw] !h-[80vh] !max-h-[80vh] !p-0 !gap-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="border-b border-border px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
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
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
            {agentNames.map((name) => {
              const isActive = name === activeAgent
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleAgentSwitch(name)}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition-colors border",
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-secondary text-muted-foreground border-transparent hover:text-foreground",
                  )}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AgentChat
            ref={chatRef}
            key={activeAgent}
            agentName={activeAgent}
            compact
            onStreamingChange={setStreaming}
            onMessage={onMessage}
            intro={`Ephemeral chat with ${activeAgent}. Click "View in sidebar" to keep this conversation.`}
            className="h-full"
          />
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background px-5 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
            className="flex items-end gap-2"
          >
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
              className="flex-1 resize-none min-h-10 max-h-40"
              aria-label="Message"
            />
            {streaming ? (
              <Button
                type="button"
                onClick={() => chatRef.current?.stop()}
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
          </form>
          <p className="mt-2 text-[10px] text-muted-foreground">
            esc to close · ⌘J to toggle · ⌘↵ to send · ⌘⇧J for full history
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
