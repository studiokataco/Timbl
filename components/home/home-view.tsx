"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { addDays, format, subDays } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { Lock, SquarePen } from "lucide-react"
import { AgenticProviders, AgenticRuntime, useReducedMotionAttr, type NavigateEffect } from "@/components/agentic/agentic-runtime"
import { useAssistantSetup } from "@/components/agentic/assistant-setup"
import { useEngine } from "@/components/agentic/engine/engine-context"
import { LiveRegions } from "@/components/agentic/live-announcer"
import { usePrototype } from "@/components/agentic/prototype-context"
import { DEFAULT_VIEW, parseView } from "@/components/agentic/view-state"
import { MobileView } from "@/components/agentic/views/mobile-view"
import { TimblModeView } from "@/components/agentic/views/timbl-mode-view"
import { Button } from "@/components/ui/button"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import { fetchPostsInRangeAction } from "@/lib/actions/posts"
import { PHONE_QUERY, useMediaMatch } from "@/lib/hooks/use-media-query"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { ChatActions, ChatTitle, HomeLead, TimblModeSwitch } from "./chat-header"
import { ConnectorsStrip, type ConnectorItem } from "./connectors-strip"
import { chatFromPath, useHomeChats } from "./home-chats"

const NO_POSTS: WithId<Post>[] = []
const HOME_VIEW = { ...DEFAULT_VIEW, view: "timbl" as const }

export function HomeView({
  connectors,
  connectorsHidden,
  privateChatId,
  events,
}: {
  connectors: ConnectorItem[]
  connectorsHidden: boolean
  privateChatId: string | null
  events: { name: string; date: string }[]
}) {
  const setup = useAssistantSetup()
  const { chatId, refresh, copy, newChat, interfaceRoute } = useHomeChats()
  const router = useRouter()
  const orgId = useWorkspaceOrgId()
  const phone = useMediaMatch(PHONE_QUERY)
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
      if (!effect.week && !effect.post) {
        router.push(interfaceRoute())
        return
      }
      const params = new URLSearchParams()
      if (effect.week) params.set("week", effect.week)
      if (effect.post) params.set("post", effect.post)
      router.push(`/calendar?${params.toString()}`)
    },
    [interfaceRoute, router],
  )

  if (privateChatId && privateChatId === chatId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Lock className="size-5 text-muted-foreground" aria-hidden />
        <h1 className="text-title-md text-foreground">{copy.privateTitle}</h1>
        <p className="max-w-sm text-body-sm text-muted-foreground">{copy.privateBody}</p>
        <Button type="button" variant="outline" onClick={() => newChat()}>
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
        events={events}
        surfaceContext="Home"
        threadId={chatId}
        onSaved={refresh}
        onNavigate={onNavigate}
        phone={phone === true}
      >
        <HomeSurface connectors={connectors} connectorsHidden={connectorsHidden} phone={phone} />
      </AgenticRuntime>
    </AgenticProviders>
  )
}

function HomeSurface({
  connectors,
  connectorsHidden,
  phone,
}: {
  connectors: ConnectorItem[]
  connectorsHidden: boolean
  phone: boolean | null
}) {
  const reducedAttr = useReducedMotionAttr()
  const { state, dispatch } = useEngine()
  const { update } = usePrototype()
  const handoffItem = useRef<string | null>(null)
  const opensChat = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const asked = params.get("q")?.trim()
    const item = params.get("item")
    opensChat.current = Boolean(asked || item || chatFromPath(window.location.pathname))
    if (!asked && !item) return
    params.delete("q")
    params.delete("item")
    const rest = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`)
    if (item) handoffItem.current = item
    if (asked) dispatch({ type: "user_sent", text: asked, source: "typed" })
  }, [dispatch])

  useEffect(() => {
    if (!phone || !opensChat.current) return
    opensChat.current = false
    update({ ...parseView(new URLSearchParams(window.location.search)), screen: "chat" }, "replace")
  }, [phone, update])

  useEffect(() => {
    const item = handoffItem.current
    if (!item || !state.posts[item]) return
    handoffItem.current = null
    dispatch({ type: "context_set", context: { kind: "post", postId: item } })
    dispatch({ type: "handoff_in", carry: "chat_and_item" })
  }, [dispatch, state.posts])

  if (phone === null) return <div className="flex-1 bg-background" />

  if (phone) {
    return (
      <div data-slot="agentic-root" data-reduced-motion={reducedAttr} className="relative flex min-h-0 flex-1 overflow-hidden">
        <LiveRegions />
        <MobileView lead={<HomeLead />} modeSwitch={<TimblModeSwitch />} titleSlot={<ChatTitle />} />
      </div>
    )
  }

  return (
    <div data-slot="agentic-root" data-reduced-motion={reducedAttr} className="relative flex min-h-0 flex-1 overflow-hidden">
      <LiveRegions />
      <TimblModeView
        chrome="desktop"
        lead={<HomeLead />}
        titleSlot={<ChatTitle />}
        actions={<ChatActions />}
        modeSwitch={<TimblModeSwitch />}
        belowComposer={<ConnectorsStrip items={connectors} hidden={connectorsHidden} />}
      />
    </div>
  )
}
