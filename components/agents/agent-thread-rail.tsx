"use client"

import { useMemo } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  formatDistanceToNowStrict,
  isThisWeek,
  isToday,
  isYesterday,
} from "date-fns"

import { cn } from "@/lib/utils"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import {
  deleteThread,
  listThreads,
  type Thread,
} from "@/lib/storage/agent-threads"

interface AgentThreadRailProps {
  activeId: string | null
  onPick: (id: string) => void
  onNewChat: (agentName: string) => void
  defaultAgentName: string
}

type Bucket = "Today" | "Yesterday" | "This week" | "Older"
const BUCKET_ORDER: Bucket[] = ["Today", "Yesterday", "This week", "Older"]

function threadsQueryKey(orgId: string) {
  return ["agent-threads", orgId] as const
}

function bucketFor(ms: number): Bucket {
  const d = new Date(ms)
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  if (isThisWeek(d, { weekStartsOn: 1 })) return "This week"
  return "Older"
}

function deriveTitle(thread: Thread): string {
  if (thread.title) return thread.title
  const firstUser = thread.transcript.find(
    (m) => m.role === "user" && m.text,
  )
  if (firstUser?.text) {
    const cleaned = firstUser.text.trim().replace(/\s+/g, " ")
    return cleaned.length > 60 ? `${cleaned.slice(0, 57)}…` : cleaned
  }
  return "New chat"
}

export function AgentThreadRail({
  activeId,
  onPick,
  onNewChat,
  defaultAgentName,
}: AgentThreadRailProps) {
  const orgId = useWorkspaceOrgId()
  const qc = useQueryClient()
  const queryKey = threadsQueryKey(orgId)
  const { data: threads = [] } = useQuery({
    queryKey,
    queryFn: () => listThreads(orgId),
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  const deleteMut = useMutation({
    mutationFn: deleteThread,
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const grouped = useMemo(() => {
    const map = new Map<Bucket, Thread[]>()
    for (const t of threads) {
      const b = bucketFor(t.lastMessageAt)
      const list = map.get(b) ?? []
      list.push(t)
      map.set(b, list)
    }
    return map
  }, [threads])

  return (
    <div className="flex flex-col h-full min-h-0 w-full md:w-60 md:shrink-0 border-r border-border bg-secondary/30">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Chats
        </span>
        <button
          type="button"
          onClick={() => onNewChat(defaultAgentName)}
          aria-label="New chat"
          className="inline-flex items-center justify-center size-6 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {threads.length === 0 && (
          <p className="px-3 py-4 text-[11px] text-muted-foreground leading-relaxed">
            No conversations yet - start by typing in the chat.
          </p>
        )}
        {BUCKET_ORDER.map((bucket) => {
          const list = grouped.get(bucket)
          if (!list || list.length === 0) return null
          return (
            <div key={bucket} className="pb-2">
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {bucket}
              </p>
              <ul className="flex flex-col">
                {list.map((thread) => {
                  const isActive = thread.id === activeId
                  return (
                    <li key={thread.id}>
                      <div
                        className={cn(
                          "group relative flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
                          isActive
                            ? "bg-secondary text-foreground"
                            : "hover:bg-secondary/70 text-foreground",
                        )}
                        onClick={() => onPick(thread.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            onPick(thread.id)
                          }
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center bg-secondary rounded-full px-1.5 text-[10px] text-muted-foreground border border-border/70">
                              {thread.agentName}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-foreground truncate leading-tight">
                            {deriveTitle(thread)}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 group-hover:hidden">
                          {formatDistanceToNowStrict(
                            new Date(thread.lastMessageAt),
                            { addSuffix: false },
                          )}
                        </span>
                        <button
                          type="button"
                          aria-label="Delete thread"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteMut.mutate(thread.id)
                          }}
                          className="hidden group-hover:inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-background transition-colors"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
