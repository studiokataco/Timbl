"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { importThread } from "@/lib/storage/agent-threads"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"

import { AgentAskShell } from "./agent-ask-shell"
import { AgentChat, type AgentChatHandle } from "./agent-chat"
import { useRosterAgents } from "./use-roster-agents"

const DEFAULT_AGENT = "drafter"
let modalActiveAgent: string | null = null

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
  const chatRef = useRef<AgentChatHandle | null>(null)

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

        <AgentAskShell
          chatRef={chatRef}
          resolvedActiveAgent={resolvedActiveAgent}
          pickerAgentNames={pickerAgentNames}
          onAgentSwitch={handleAgentSwitch}
          input={input}
          onInputChange={setInput}
          streaming={streaming}
          onSubmit={submit}
          isEmpty={isEmpty}
          className="flex-1 min-h-0"
        >
          <AgentChat
            ref={chatRef}
            key={resolvedActiveAgent}
            agentName={resolvedActiveAgent}
            agentCatalog={pickerAgentNames}
            onAgentSwitch={handleAgentSwitch}
            compact
            onStreamingChange={setStreaming}
            onMessage={onMessage}
            className="h-full"
          />
        </AgentAskShell>
      </DialogContent>
    </Dialog>
  )
}
