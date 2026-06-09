"use client"

import { useMemo, useState, useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchPostsInRangeAction, updatePost } from "@/lib/actions/posts"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, PostStatus, User } from "@/lib/schemas"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { KanbanCard } from "./card"
import { KanbanColumn } from "./column"
import { KanbanColumnAddButton } from "./column-add-button"
import { ColumnEditDialog } from "./column-edit-dialog"

type Props = {
  orgId: string
  initialPosts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  range: { start: string; end: string }
}

export function KanbanBoard({
  orgId,
  initialPosts,
  categories,
  users,
  range,
}: Props) {
  const queryClient = useQueryClient()
  const { openComposerWithPost, data } = useDialogs()
  const campaigns = data.campaigns
  const columns = data.kanbanColumns
  const [, startTransition] = useTransition()
  /* Live posts are the single source of truth: useQuery seeds from the
   * server render, usePostsRealtime invalidates on Firestore snapshots, and
   * mutations (drag, status select, agent approve/reject) patch the cache
   * then invalidate. This is what lets approve/reject re-render the card -
   * before, the board held a private useState copy that invalidateQueries
   * could never reach. */
  const { data: posts = initialPosts } = useQuery({
    queryKey: ["posts", orgId, range.start, range.end],
    queryFn: () => fetchPostsInRangeAction(range),
    initialData: initialPosts,
    staleTime: 30_000,
  })
  usePostsRealtime({ orgId, ...range, queryClient })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState("")
  const [filterAssignee, setFilterAssignee] = useState("")
  const [filterCampaign, setFilterCampaign] = useState("")
  const [filterQ, setFilterQ] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  )
  const columnIdSet = useMemo(() => new Set(columns.map((c) => c.id)), [columns])

  const filtered = useMemo(() => {
    let rows = posts
    if (filterCategory) rows = rows.filter((p) => p.categoryId === filterCategory)
    if (filterAssignee) rows = rows.filter((p) => p.assigneeId === filterAssignee)
    if (filterCampaign) rows = rows.filter((p) => p.campaignId === filterCampaign)
    if (filterQ) {
      const needle = filterQ.toLowerCase()
      rows = rows.filter((p) =>
        [p.brief, p.blurb].filter(Boolean).some((s) => s!.toLowerCase().includes(needle)),
      )
    }
    return rows
  }, [posts, filterCategory, filterAssignee, filterCampaign, filterQ])

  const byStatus = useMemo(() => {
    const map = new Map<string, WithId<Post>[]>()
    for (const col of columns) map.set(col.id, [])
    for (const p of filtered) {
      if (!columnIdSet.has(p.status)) continue
      map.get(p.status)!.push(p)
    }
    return map
  }, [filtered, columns, columnIdSet])

  const activePost = useMemo(
    () => posts.find((p) => p.id === activeId) ?? null,
    [posts, activeId],
  )

  /* Patch every cached posts query (any date range) by id so the card jumps
   * columns instantly; invalidate afterwards reconciles against the server. */
  function patchStatus(id: string, next: PostStatus) {
    queryClient.setQueriesData<WithId<Post>[]>(
      { queryKey: ["posts", orgId] },
      (curr) => curr?.map((p) => (p.id === id ? { ...p, status: next } : p)),
    )
  }

  function commitStatus(post: WithId<Post>, next: PostStatus) {
    patchStatus(post.id, next)
    startTransition(async () => {
      const res = await updatePost({ id: post.id, status: next })
      if (!res.ok) {
        patchStatus(post.id, post.status)
        toast.error(res.error ?? "Could not update status")
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    })
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const newStatus = over.id as PostStatus
    if (!columnIdSet.has(newStatus)) return
    const post = posts.find((p) => p.id === active.id)
    if (!post || post.status === newStatus) return
    commitStatus(post, newStatus)
  }

  const openComposer = (p: WithId<Post>) => {
    openComposerWithPost(p)
  }

  const onStatusChange = (post: WithId<Post>, next: PostStatus) => {
    if (post.status === next) return
    commitStatus(post, next)
    toast.success(`Moved to ${next}`)
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
          placeholder="Search brief…"
          className="w-44"
        />
        <FilterSelect
          placeholder="Category"
          value={filterCategory}
          onChange={setFilterCategory}
          options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
        />
        <FilterSelect
          placeholder="Assignee"
          value={filterAssignee}
          onChange={setFilterAssignee}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
        />
        <FilterSelect
          placeholder="Campaign"
          value={filterCampaign}
          onChange={setFilterCampaign}
          options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      <div className="flex-1 overflow-x-auto pb-4 min-h-0">
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 h-full w-full">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                allColumns={columns}
                posts={byStatus.get(col.id) ?? []}
                categoryById={categoryById}
                userById={userById}
                onCardClick={openComposer}
                onCardStatusChange={onStatusChange}
              />
            ))}
            <KanbanColumnAddButton onClick={() => setCreateOpen(true)} />
          </div>

          <DragOverlay>
            {activePost ? (
              <KanbanCard
                post={activePost}
                category={categoryById.get(activePost.categoryId ?? "")}
                assignee={userById.get(activePost.assigneeId ?? "")}
                onClick={() => {}}
                isDragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <ColumnEditDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </>
  )
}

function FilterSelect({
  placeholder,
  value,
  onChange,
  options,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; color?: string }[]
}) {
  const isAll = !value
  const emptyLabel = `Any ${placeholder.toLowerCase()}`
  return (
    <Select
      value={value || "_all"}
      onValueChange={(v) => onChange(!v || v === "_all" ? "" : v)}
    >
      <SelectTrigger
        className={cn("w-36", isAll && "text-muted-foreground")}
      >
        <SelectValue placeholder={emptyLabel}>
          {(v) => {
            if (!v || v === "_all") return emptyLabel
            return options.find((o) => o.value === v)?.label ?? v
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_all">{emptyLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">
              {o.color && (
                <span
                  aria-hidden
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: o.color }}
                />
              )}
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
