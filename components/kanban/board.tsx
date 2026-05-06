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
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Post, PostStatus, User } from "@/lib/schemas"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { KanbanCard } from "./card"
import { KanbanColumn } from "./column"

const COLUMNS: PostStatus[] = [
  "idea",
  "brief",
  "researching",
  "designing",
  "review",
  "scheduled",
  "posted",
]

type Props = {
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
}

export function KanbanBoard({ posts, categories, users }: Props) {
  const router = useRouter()
  const { openComposerWithPost, data } = useDialogs()
  const campaigns = data.campaigns
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState("")
  const [filterAssignee, setFilterAssignee] = useState("")
  const [filterCampaign, setFilterCampaign] = useState("")
  const [filterQ, setFilterQ] = useState("")

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
    const map = new Map<PostStatus, WithId<Post>[]>()
    for (const col of COLUMNS) map.set(col, [])
    for (const p of filtered) {
      if (!COLUMNS.includes(p.status as PostStatus)) continue
      map.get(p.status as PostStatus)!.push(p)
    }
    return map
  }, [filtered])

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
    if (!COLUMNS.includes(newStatus)) return
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
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col}
                status={col}
                posts={byStatus.get(col) ?? []}
                categoryById={categoryById}
                userById={userById}
                onCardClick={openComposer}
                onCardStatusChange={onStatusChange}
              />
            ))}
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
  return (
    <Select value={value} onValueChange={(v) => onChange(!v || v === "_all" ? "" : v)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_all">Any {placeholder.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
