"use client"

import { useState, useTransition } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { toast } from "sonner"
import { promoteIdeationItem } from "@/lib/actions/ideation"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { IdeationItem } from "@/lib/schemas/ideationItem"
import type { Post } from "@/lib/schemas/post"
import { IdeaCard, PostCard } from "./card"

type ColId = "ideas" | "drafts" | "scheduled"

type Props = {
  ideas: WithId<IdeationItem>[]
  drafts: WithId<Post>[]
  scheduled: WithId<Post>[]
}

function IdeationColumn({
  id,
  title,
  count,
  children,
}: {
  id: ColId
  title: string
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column" } })
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-semibold text-[#111111]">{title}</h3>
        <span className="text-xs text-[#6b7280] tabular-nums bg-[#f5f5f5] border border-[#e5e7eb] rounded-full px-2 py-0.5">
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col gap-2 flex-1 rounded-xl p-2 min-h-48 transition-colors",
          isOver ? "bg-[#e5e7eb]" : "bg-[#f5f5f5]",
        )}
      >
        {children}
        {count === 0 && (
          <p className="text-xs text-[#6b7280] text-center mt-4 select-none">
            Drop here
          </p>
        )}
      </div>
    </div>
  )
}

export function IdeationBoard({ ideas: initialIdeas, drafts: initialDrafts, scheduled: initialScheduled }: Props) {
  const [ideas, setIdeas] = useState(initialIdeas)
  const [drafts, setDrafts] = useState(initialDrafts)
  const [, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const activeIdea = activeId?.startsWith("idea-")
    ? ideas.find((i) => `idea-${i.id}` === activeId)
    : null
  const activeDraft = activeId?.startsWith("post-")
    ? drafts.find((p) => `post-${p.id}` === activeId)
    : null

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return
    const overId = over.id as ColId
    const activeIdStr = active.id as string

    if (activeIdStr.startsWith("idea-") && overId === "drafts") {
      const itemId = activeIdStr.replace("idea-", "")
      const item = ideas.find((i) => i.id === itemId)
      if (!item) return

      setIdeas((prev) => prev.filter((i) => i.id !== itemId))

      startTransition(async () => {
        const res = await promoteIdeationItem({ itemId })
        if (!res.ok) {
          setIdeas((prev) => [item, ...prev])
          toast.error(res.error ?? "Could not promote idea")
        } else {
          toast.success("Idea promoted to draft")
        }
      })
    }
  }

  const ideaIds = ideas.map((i) => `idea-${i.id}`)
  const draftIds = drafts.map((p) => `post-${p.id}`)
  const scheduledIds = initialScheduled.map((p) => `post-${p.id}`)

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-4 p-6 h-full overflow-x-auto">
        <IdeationColumn id="ideas" title="Ideas" count={ideas.length}>
          <SortableContext items={ideaIds} strategy={verticalListSortingStrategy}>
            {ideas.map((item) => (
              <IdeaCard key={item.id} item={item} />
            ))}
          </SortableContext>
        </IdeationColumn>

        <IdeationColumn id="drafts" title="Drafts" count={drafts.length}>
          <SortableContext items={draftIds} strategy={verticalListSortingStrategy}>
            {drafts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </SortableContext>
        </IdeationColumn>

        <IdeationColumn id="scheduled" title="Scheduled" count={initialScheduled.length}>
          <SortableContext items={scheduledIds} strategy={verticalListSortingStrategy}>
            {initialScheduled.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </SortableContext>
        </IdeationColumn>
      </div>

      <DragOverlay>
        {activeIdea ? <IdeaCard item={activeIdea} isDragging /> : null}
        {activeDraft ? <PostCard post={activeDraft} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
