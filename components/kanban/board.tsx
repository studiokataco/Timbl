"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import { updatePost } from "@/lib/actions/posts"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, PostStatus, User } from "@/lib/schemas"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { KanbanCard } from "./card"
import { KanbanColumn } from "./column"
import { KanbanColumnAddButton } from "./column-add-button"
import { ColumnEditDialog } from "./column-edit-dialog"

type Props = {
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
}

export function KanbanBoard({ posts, categories, users }: Props) {
  const router = useRouter()
  const { openComposerWithPost, data } = useDialogs()
  const campaigns = data.campaigns
  const columns = data.kanbanColumns
  const [, startTransition] = useTransition()
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

    startTransition(async () => {
      const res = await updatePost({ id: post.id, status: newStatus })
      if (!res.ok) toast.error(res.error ?? "Could not update status")
      else router.refresh()
    })
  }

  const openComposer = (p: WithId<Post>) => {
    openComposerWithPost(p)
  }

  const onStatusChange = (post: WithId<Post>, next: PostStatus) => {
    if (post.status === next) return
    startTransition(async () => {
      const res = await updatePost({ id: post.id, status: next })
      if (!res.ok) toast.error(res.error ?? "Could not update status")
      else {
        toast.success(`Moved to ${next}`)
        router.refresh()
      }
    })
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
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
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
  options: { value: string; label: string }[]
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
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
