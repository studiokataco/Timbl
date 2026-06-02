"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { History, Sparkles } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import type { AgentProvider } from "@/lib/schemas/agentConfig"
import {
  appendMessage,
  createThread,
  getThread,
  listThreads,
  updateThreadAgent,
  type ThreadMessage,
} from "@/lib/storage/agent-threads"

import { AgentAskShell } from "./agent-ask-shell"
import { AgentChat, type AgentChatHandle } from "./agent-chat"
import { AgentThreadRail } from "./agent-thread-rail"
import { useRosterAgents } from "./use-roster-agents"

/*
 * Global agent drawer - history rail + active conversation. Cmd-Shift-J
 * toggles; ESC closes; `agent-drawer:open` / `agent-drawer:open-thread`
 * open programmatically.
 */

const FLOATING_HOTKEY = "j"

const lastActiveThreadByOrg = new Map<string, string | null>()

function threadsQueryKey(orgId: string) {
  return ["agent-threads", orgId] as const
}

function threadQueryKey(orgId: string, threadId: string) {
  return ["agent-thread", orgId, threadId] as const
}

export function AgentDrawer() {
  const orgId = useWorkspaceOrgId()
  const [open, setOpen] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => lastActiveThreadByOrg.get(orgId) ?? null,
  )
  const [showRailMobile, setShowRailMobile] = useState(false)
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [transcriptLength, setTranscriptLength] = useState(0)
  const [provider, setProvider] = useState<AgentProvider | "">("")
  const [model, setModel] = useState("")
  const chatRef = useRef<AgentChatHandle | null>(null)
  const qc = useQueryClient()
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    lastActiveThreadByOrg.set(orgId, activeThreadId)
  }, [orgId, activeThreadId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.shiftKey && e.key.toLowerCase() === FLOATING_HOTKEY) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("agent-drawer:open", onOpen)
    return () => window.removeEventListener("agent-drawer:open", onOpen)
  }, [])

  useEffect(() => {
    const onOpenThread = (e: Event) => {
      const ce = e as CustomEvent<{ threadId: string }>
      if (ce.detail?.threadId) {
        setActiveThreadId(ce.detail.threadId)
        setOpen(true)
      }
    }
    window.addEventListener(
      "agent-drawer:open-thread",
      onOpenThread as EventListener,
    )
    return () =>
      window.removeEventListener(
        "agent-drawer:open-thread",
        onOpenThread as EventListener,
      )
  }, [])

  const { agentNames, defaultAgent } = useRosterAgents()

  const { data: activeThread = null } = useQuery({
    queryKey: threadQueryKey(orgId, activeThreadId ?? ""),
    queryFn: () =>
      activeThreadId ? getThread(activeThreadId, orgId) : null,
    enabled: !!activeThreadId,
  })

  useEffect(() => {
    if (!open) {
      bootstrappedRef.current = false
      return
    }
    if (bootstrappedRef.current) return
    if (activeThreadId) {
      bootstrappedRef.current = true
      return
    }
    bootstrappedRef.current = true
    void (async () => {
      const threads = await listThreads(orgId)
      if (threads.length > 0) {
        setActiveThreadId(threads[0].id)
        return
      }
      const fresh = await createThread(defaultAgent, orgId)
      await qc.invalidateQueries({ queryKey: threadsQueryKey(orgId) })
      setActiveThreadId(fresh.id)
    })()
  }, [open, activeThreadId, qc, defaultAgent, orgId])

  const handleNewChat = useCallback(
    async (agentName: string) => {
      const fresh = await createThread(agentName, orgId)
      await qc.invalidateQueries({ queryKey: threadsQueryKey(orgId) })
      setActiveThreadId(fresh.id)
      setShowRailMobile(false)
      setInput("")
      setTranscriptLength(0)
    },
    [qc, orgId],
  )

  const activeAgentNameForCb = useRef<string>("")

  const switchAgent = useCallback(
    async (name: string) => {
      if (!activeThreadId) {
        await handleNewChat(name)
        return
      }
      if (name === activeAgentNameForCb.current) return
      await updateThreadAgent(activeThreadId, name)
      await qc.invalidateQueries({
        queryKey: threadQueryKey(orgId, activeThreadId),
      })
      await qc.invalidateQueries({ queryKey: threadsQueryKey(orgId) })
    },
    [activeThreadId, handleNewChat, qc, orgId],
  )

  const handlePickThread = useCallback((id: string) => {
    setActiveThreadId(id)
    setShowRailMobile(false)
    setInput("")
    setTranscriptLength(0)
  }, [])

  const handlePersist = useCallback(
    async (msg: ThreadMessage) => {
      if (!activeThreadId) return
      await appendMessage(activeThreadId, msg)
      qc.invalidateQueries({ queryKey: threadsQueryKey(orgId) })
    },
    [activeThreadId, qc, orgId],
  )

  const activeAgentName = activeThread?.agentName ?? defaultAgent
  useEffect(() => {
    activeAgentNameForCb.current = activeAgentName
  }, [activeAgentName])

  const pickerAgentNames = useMemo(
    () => (agentNames.length > 0 ? agentNames : [defaultAgent]),
    [agentNames, defaultAgent],
  )

  const onMessage = useCallback(() => {
    const t = chatRef.current?.getTranscript() ?? []
    setTranscriptLength(t.length)
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

  const isEmpty = transcriptLength === 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="!w-full sm:!max-w-xl lg:!max-w-3xl flex flex-row p-0"
      >
        <div className="hidden md:flex shrink-0">
          <AgentThreadRail
            activeId={activeThreadId}
            onPick={handlePickThread}
            onNewChat={handleNewChat}
            defaultAgentName={activeAgentName}
          />
        </div>

        {showRailMobile && (
          <div className="md:hidden absolute inset-0 z-20 bg-background flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-[12px] font-semibold">Past chats</span>
              <button
                type="button"
                onClick={() => setShowRailMobile(false)}
                className="text-[12px] text-muted-foreground hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <AgentThreadRail
                activeId={activeThreadId}
                onPick={handlePickThread}
                onNewChat={handleNewChat}
                defaultAgentName={activeAgentName}
              />
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border space-y-1">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4" aria-hidden />
                Agent
              </SheetTitle>
              <button
                type="button"
                onClick={() => setShowRailMobile(true)}
                aria-label="Show chat history"
                className="md:hidden inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <History className="size-3.5" aria-hidden />
                History
              </button>
            </div>
            <SheetDescription className="text-xs">
              Past chats on the left. Agent mode and model sit below the message
              box, same as Ask AI (⌘J).
            </SheetDescription>
          </SheetHeader>

          {activeThreadId && activeThread ? (
            <AgentAskShell
              chatRef={chatRef}
              resolvedActiveAgent={activeAgentName}
              pickerAgentNames={pickerAgentNames}
              onAgentSwitch={(name) => void switchAgent(name)}
              input={input}
              onInputChange={setInput}
              streaming={streaming}
              onSubmit={submit}
              isEmpty={isEmpty}
              provider={provider}
              onProviderChange={setProvider}
              model={model}
              onModelChange={setModel}
              modelDatalistId="agent-drawer-models"
              showShortcutHints={false}
              className="flex-1 min-h-0"
            >
              <AgentChat
                ref={chatRef}
                key={activeThreadId}
                agentName={activeAgentName}
                threadId={activeThreadId}
                agentCatalog={pickerAgentNames}
                onAgentSwitch={(name) => void switchAgent(name)}
                organizationId={orgId}
                onMessage={(msg) => {
                  void handlePersist(msg)
                  onMessage()
                }}
                compact
                onStreamingChange={setStreaming}
                providerOverride={provider}
                modelOverride={model}
                className="h-full"
              />
            </AgentAskShell>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground">
              Loading…
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
