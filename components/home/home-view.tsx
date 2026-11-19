"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { addDays, format, subDays } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Lock, SquarePen } from "lucide-react"
import { AgenticProviders, AgenticRuntime, useReducedMotionAttr, type NavigateEffect } from "@/components/agentic/agentic-runtime"
import { useAssistantSetup } from "@/components/agentic/assistant-setup"
import { useEngine } from "@/components/agentic/engine/engine-context"
import { LiveRegions } from "@/components/agentic/live-announcer"
import { DEFAULT_VIEW } from "@/components/agentic/view-state"
import { TimblModeView } from "@/components/agentic/views/timbl-mode-view"
import { Button } from "@/components/ui/button"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import { fetchPostsInRangeAction } from "@/lib/actions/posts"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { ChatActions, ChatTitle, HomeLead } from "./chat-header"
import { ConnectorsStrip, type ConnectorItem } from "./connectors-strip"
import { useHomeChats } from "./home-chats"

const NO_POSTS: WithId<Post>[] = []
const HOME_VIEW = { ...DEFAULT_VIEW, view: "timbl" as const }

export function HomeView({
  connectors,
  connectorsHidden,
  privateChatId,
}: {
  connectors: ConnectorItem[]
  connectorsHidden: boolean
  privateChatId: string | null
}) {
  const setup = useAssistantSetup()
  const { chatId, refresh, copy, newChat } = useHomeChats()
  const router = useRouter()
  const orgId = useWorkspaceOrgId()
  const range = useMemo(() => {
    const today = new Date()
    return { start: format(subDays(today, 90), "yyyy-MM-dd"), end: format(addDays(today, 180), "yyyy-MM-dd") }
  }, [])
  const { data: posts = NO_POSTS } = useQuery({
    queryKey: ["posts", orgId, setup.brandId, range.start, range.end],
    queryFn: () => fetchPostsInRangeAction(range),
    staleTime: 30_000,
  })

  const onNavigate = useCallback(
    (effect: NavigateEffect) => {
      if (effect.view !== "interface") return
      const params = new URLSearchParams()
      if (effect.week) params.set("week", effect.week)
      if (effect.post) params.set("post", effect.post)
      const qs = params.toString()
      router.push(qs ? `/calendar?${qs}` : "/calendar")
    },
    [router],
  )

  if (privateChatId && privateChatId === chatId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="size-5 text-muted-foreground" aria-hidden />
        <h1 className="text-title-md text-foreground">{copy.privateTitle}</h1>
        <p className="max-w-sm text-body-sm text-muted-foreground">{copy.privateBody}</p>
        <Button type="button" variant="outline" onClick={newChat}>
          <SquarePen className="size-4" aria-hidden />
          {copy.newChat}
        </Button>
      </div>
    )
  }

  return (
    <AgenticProviders
      key={chatId}
      team={setup.team}
      viewerId={setup.viewerId}
      workspaceName={setup.workspaceName}
      assistantName={setup.assistantName}
      prefs={setup.prefs}
      initialView={HOME_VIEW}
    >
      <AgenticRuntime
        cadencePerWeek={setup.cadencePerWeek}
        campaignCount={setup.campaignCount}
        posts={posts}
        surfaceContext="Home"
        threadId={chatId}
        onSaved={refresh}
        onNavigate={onNavigate}
      >
        <HomeSurface connectors={connectors} connectorsHidden={connectorsHidden} />
      </AgenticRuntime>
    </AgenticProviders>
  )
}

function HomeSurface({ connectors, connectorsHidden }: { connectors: ConnectorItem[]; connectorsHidden: boolean }) {
  const reducedAttr = useReducedMotionAttr()
  const { dispatch } = useEngine()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const asked = params.get("q")?.trim()
    if (!asked) return
    params.delete("q")
    const rest = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`)
    dispatch({ type: "user_sent", text: asked, source: "typed" })
  }, [dispatch])

  return (
    <div data-slot="agentic-root" data-reduced-motion={reducedAttr} className="relative flex min-h-0 flex-1 overflow-hidden">
      <LiveRegions />
      <TimblModeView
        chrome="desktop"
        lead={<HomeLead />}
        titleSlot={<ChatTitle />}
        actions={<ChatActions />}
        belowComposer={<ConnectorsStrip items={connectors} hidden={connectorsHidden} />}
      />
    </div>
  )
}
