"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { QuickAddDialog } from "@/components/quick-add/quick-add-dialog"
import { PostComposerSheet } from "@/components/composer/post-composer-sheet"
import { fetchPostAction } from "@/lib/actions/posts"
import type { WithId } from "@/lib/firebase/serialize"
import type {
  Campaign,
  Category,
  Cta,
  KanbanColumn,
  Post,
  User,
} from "@/lib/schemas"

export type QuickAddSource = "topbar" | "calendar-cell" | "other"

type Data = {
  categories: WithId<Category>[]
  ctas: WithId<Cta>[]
  users: WithId<User>[]
  campaigns: WithId<Campaign>[]
  kanbanColumns: WithId<KanbanColumn>[]
  hashtagSuggestions: string[]
}

type DialogsApi = {
  openQuickAdd: (opts?: { initialDate?: Date | null; source?: QuickAddSource }) => void
  openComposer: (postId: string) => void
  openComposerWithPost: (post: WithId<Post>) => void
  closeAll: () => void
  data: Data
}

const DialogsContext = createContext<DialogsApi | null>(null)

export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext)
  if (!ctx) throw new Error("useDialogs must be used inside <DialogsProvider>")
  return ctx
}

export function DialogsProvider({
  data,
  children,
}: {
  data: Data
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null)
  const [quickAddSource, setQuickAddSource] = useState<QuickAddSource>("other")

  const [composerOpen, setComposerOpen] = useState(false)
  const [composerPost, setComposerPost] = useState<WithId<Post> | null>(null)

  const openQuickAdd = useCallback<DialogsApi["openQuickAdd"]>((opts) => {
    setQuickAddDate(opts?.initialDate ?? null)
    setQuickAddSource(opts?.source ?? "other")
    setQuickAddOpen(true)
  }, [])

  const openComposerWithPost = useCallback<DialogsApi["openComposerWithPost"]>((post) => {
    setComposerPost(post)
    setComposerOpen(true)
  }, [])

  const openComposer = useCallback<DialogsApi["openComposer"]>(
    async (postId) => {
      const post = await fetchPostAction(postId)
      if (post) openComposerWithPost(post)
    },
    [openComposerWithPost],
  )

  const closeAll = useCallback(() => {
    setQuickAddOpen(false)
    setComposerOpen(false)
  }, [])

  const api = useMemo<DialogsApi>(
    () => ({ openQuickAdd, openComposer, openComposerWithPost, closeAll, data }),
    [openQuickAdd, openComposer, openComposerWithPost, closeAll, data],
  )

  const onCreated = useCallback(() => {
    router.refresh()
  }, [router])

  const onSavedFromQuickAdd = useCallback(() => {
    // Smart navigation: only nav to /calendar when triggered from the TopBar
    // on a non-calendar page. Otherwise the user stays put.
    if (quickAddSource === "topbar" && pathname !== "/calendar") {
      router.push("/calendar")
    }
  }, [quickAddSource, pathname, router])

  const onCreateAndOpenComposer = useCallback(
    (postId: string) => {
      void openComposer(postId)
    },
    [openComposer],
  )

  return (
    <DialogsContext.Provider value={api}>
      {children}
      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialDate={quickAddDate}
        categories={data.categories}
        ctas={data.ctas}
        users={data.users}
        onCreated={onCreated}
        onSaved={onSavedFromQuickAdd}
        onCreateAndOpenComposer={onCreateAndOpenComposer}
      />
      <PostComposerSheet
        open={composerOpen}
        onOpenChange={setComposerOpen}
        post={composerPost}
        categories={data.categories}
        campaigns={data.campaigns}
        ctas={data.ctas}
        users={data.users}
        kanbanColumns={data.kanbanColumns}
        hashtagSuggestions={data.hashtagSuggestions}
        onChanged={onCreated}
      />
    </DialogsContext.Provider>
  )
}
