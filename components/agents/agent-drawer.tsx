"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { History, Sparkles } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { listAgentConfigs } from "@/lib/actions/agent-configs"
import {
  appendMessage,
  createThread,
  getThread,
  listThreads,
  updateThreadAgent,
  type ThreadMessage,
} from "@/lib/storage/agent-threads"

import { AgentChat } from "./agent-chat"
import { AgentThreadRail } from "./agent-thread-rail"

/*
 * Global agent drawer - two-pane surface (history rail + active
 * conversation) at >=1024px, collapsing to a single pane with a
 * "History" trigger on narrow widths. Cmd-J toggles; ESC closes;
 * external code can dispatch `agent-drawer:open` to surface it.
 *
 * Active thread id is kept in module-level state so closing and
 * reopening the drawer restores the last-viewed conversation.
 */

const FLOATING_HOTKEY = "j"
const DEFAULT_AGENT = "settings-assistant"
const THREADS_QUERY_KEY = ["agent-threads"] as const

let lastActiveThreadId: string | null = null

export function AgentDrawer() {
  const [open, setOpen] = useState(false)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    lastActiveThreadId,
  )
  const [showRailMobile, setShowRailMobile] = useState(false)
  const qc = useQueryClient()
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    lastActiveThreadId = activeThreadId
  }, [activeThreadId])

  // Cmd-Shift-J / Ctrl-Shift-J toggle. (Cmd-J is owned by the modal.)
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

  // Programmatic open via custom event.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("agent-drawer:open", onOpen)
    return () => window.removeEventListener("agent-drawer:open", onOpen)
  }, [])

  // Open a specific thread (used by the modal's "View in sidebar" migration).
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

  // Agent configs for the top pill rail.
  const { data: agentConfigs = [] } = useQuery({
    queryKey: ["agent-configs"],
    queryFn: listAgentConfigs,
    staleTime: 30_000,
  })

  // Active thread record (used for agent identity on the right pane).
  const { data: activeThread = null } = useQuery({
    queryKey: ["agent-thread", activeThreadId],
    queryFn: () => (activeThreadId ? getThread(activeThreadId) : null),
    enabled: !!activeThreadId,
  })

  // On open with no active thread, load most recent or auto-create.
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
      const threads = await listThreads()
      if (threads.length > 0) {
        setActiveThreadId(threads[0].id)
        return
      }
      const fresh = await createThread(DEFAULT_AGENT)
      await qc.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
      setActiveThreadId(fresh.id)
    })()
  }, [open, activeThreadId, qc])

  const handleNewChat = useCallback(
    async (agentName: string) => {
      const fresh = await createThread(agentName)
      await qc.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
      setActiveThreadId(fresh.id)
      setShowRailMobile(false)
    },
    [qc],
  )

  const activeAgentNameForCb = useRef<string>("")
  // We need the current activeAgentName inside switchAgent without
  // triggering re-creation on every render; mirror it through a ref.

  const switchAgent = useCallback(
    async (name: string) => {
      if (!activeThreadId) {
        await handleNewChat(name)
        return
      }
      if (name === activeAgentNameForCb.current) return
      await updateThreadAgent(activeThreadId, name)
      await qc.invalidateQueries({ queryKey: ["agent-thread", activeThreadId] })
      await qc.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
    },
    [activeThreadId, handleNewChat, qc],
  )

  const handlePickThread = useCallback((id: string) => {
    setActiveThreadId(id)
    setShowRailMobile(false)
  }, [])

  const handlePersist = useCallback(
    async (msg: ThreadMessage) => {
      if (!activeThreadId) return
      await appendMessage(activeThreadId, msg)
      // Keep the rail's relative timestamps and titles fresh, but
      // don't thrash queries - invalidate at a low rate.
      qc.invalidateQueries({ queryKey: THREADS_QUERY_KEY })
    },
    [activeThreadId, qc],
  )

  const activeAgentName = activeThread?.agentName ?? DEFAULT_AGENT
  useEffect(() => {
    activeAgentNameForCb.current = activeAgentName
  }, [activeAgentName])
  const agentNames = (agentConfigs.length > 0
    ? agentConfigs.map((c) => c.name)
    : [DEFAULT_AGENT])

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="!w-full sm:!max-w-xl lg:!max-w-3xl flex flex-row p-0"
        >
          {/* Desktop rail - hidden on narrow widths */}
          <div className="hidden lg:flex">
            <AgentThreadRail
              activeId={activeThreadId}
              onPick={handlePickThread}
              onNewChat={handleNewChat}
              defaultAgentName={activeAgentName}
            />
          </div>

          {/* Mobile rail overlay */}
          {showRailMobile && (
            <div className="lg:hidden absolute inset-0 z-20 bg-background flex flex-col">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-[12px] font-semibold">History</span>
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
            <SheetHeader className="px-4 py-3 border-b border-border space-y-2">
              <div className="flex items-center justify-between gap-2">
                <SheetTitle className="text-base flex items-center gap-2">
                  <Sparkles className="size-4" aria-hidden /> Agent
                </SheetTitle>
                <button
                  type="button"
                  onClick={() => setShowRailMobile(true)}
                  aria-label="Show history"
                  className="lg:hidden inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <History className="size-3.5" aria-hidden />
                  History
                </button>
              </div>
              <SheetDescription className="text-xs">
                Ask the {activeAgentName} agent. Pick a different one below or open a past chat.
              </SheetDescription>
              {/* Agent pill rail */}
              <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
                {agentNames.map((name) => {
                  const isActive = name === activeAgentName
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => switchAgent(name)}
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
            </SheetHeader>
            <div className="flex-1 min-h-0">
              {activeThreadId && activeThread ? (
                <AgentChat
                  key={activeThreadId}
                  agentName={activeAgentName}
                  threadId={activeThreadId}
                  onMessage={handlePersist}
                  intro="Hi - I can edit your brand config, look up other agents' settings, or propose changes to them. What do you need?"
                  placeholder="Ask anything…"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-[12px] text-muted-foreground">
                  Loading…
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
