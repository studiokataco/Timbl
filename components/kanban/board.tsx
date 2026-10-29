"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { AlarmClock, CheckCheck, Plus, Search, X } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SettingDisclosure } from "@/components/settings/setting-disclosure"
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
import { columnGroup, type Category, type KanbanColumn as KanbanColumnDoc, type Post, type PostStatus, type User } from "@/lib/schemas"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { BulkApproveBar } from "./bulk-approve-bar"
import { KanbanCard } from "./card"
import { KanbanColumnComponent as KanbanColumn } from "./column"
import { KanbanColumnAddButton } from "./column-add-button"
import { ColumnEditDialog } from "./column-edit-dialog"
import { FlowStrip } from "./flow-strip"

const DRAG_CARD_WIDTH = 284
const BULK_LIMIT = 50

type Props = {
  orgId: string
  initialPosts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  range: { start: string; end: string }
  realtimeEnabled?: boolean
}

const DAY_MS = 86_400_000
const rankOf = (p: Pick<Post, "boardRank" | "scheduledDate">) =>
  p.boardRank ?? Date.parse(p.scheduledDate)

function rankBetween(
  before: Pick<Post, "boardRank" | "scheduledDate"> | undefined,
  after: Pick<Post, "boardRank" | "scheduledDate"> | undefined,
) {
  if (before && after) return (rankOf(before) + rankOf(after)) / 2
  if (before) return rankOf(before) + DAY_MS
  if (after) return rankOf(after) - DAY_MS
  return Date.now()
}

const isOpenWork = (c: WithId<KanbanColumnDoc> | undefined) => !c || columnGroup(c) === "active"

const collapseListeners = new Set<() => void>()
const EMPTY_OVERRIDES = "{}"

function subscribeCollapse(cb: () => void) {
  collapseListeners.add(cb)
  window.addEventListener("storage", cb)
  return () => {
    collapseListeners.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

function useCollapsedColumns(orgId: string) {
  const key = `timbl.kanban.collapsed.${orgId}`
  const raw = useSyncExternalStore(
    subscribeCollapse,
    () => {
      try {
        return window.localStorage.getItem(key) ?? EMPTY_OVERRIDES
      } catch {
        return EMPTY_OVERRIDES
      }
    },
    () => EMPTY_OVERRIDES,
  )
  const overrides = useMemo<Record<string, boolean>>(() => {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }, [raw])
  const isCollapsed = useCallback(
    (c: WithId<KanbanColumnDoc>) => overrides[c.id] ?? columnGroup(c) === "closed",
    [overrides],
  )
  const setCollapsed = useCallback(
    (id: string, value: boolean) => {
      try {
        window.localStorage.setItem(key, JSON.stringify({ ...overrides, [id]: value }))
      } catch {}
      collapseListeners.forEach((cb) => cb())
    },
    [key, overrides],
  )
  return { isCollapsed, setCollapsed }
}

export function KanbanBoard({
  orgId,
  initialPosts,
  categories,
  users,
  range,
  realtimeEnabled = false,
}: Props) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { openComposerWithPost, openQuickAdd, data } = useDialogs()
  const campaigns = data.campaigns
  const columns = data.kanbanColumns
  const [, startTransition] = useTransition()
  /* Live posts are the single source of truth: useQuery seeds from the
   * server render, usePostsRealtime invalidates on Firestore snapshots, and
   * mutations (drag, status select, agent approve/reject) patch the cache
   * then invalidate. */
  const { data: posts = initialPosts } = useQuery({
    queryKey: ["posts", orgId, range.start, range.end],
    queryFn: () => fetchPostsInRangeAction(range),
    initialData: initialPosts,
    staleTime: 30_000,
  })
  usePostsRealtime({ orgId, ...range, queryClient, enabled: realtimeEnabled })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragWidth, setDragWidth] = useState<number | undefined>(undefined)
  const [filterCategory, setFilterCategory] = useState("")
  const [filterAssignee, setFilterAssignee] = useState("")
  const [filterCampaign, setFilterCampaign] = useState("")
  const [filterQ, setFilterQ] = useState("")
  const [reviewOnly, setReviewOnly] = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [mobileColumnId, setMobileColumnId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const { isCollapsed, setCollapsed } = useCollapsedColumns(orgId)

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
  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns])

  const today = format(new Date(), "yyyy-MM-dd")
  const isPending = (p: WithId<Post>) => p.agentMeta?.reviewState === "pending"
  const isOverdue = useCallback(
    (p: WithId<Post>) => p.scheduledDate < today && isOpenWork(columnById.get(p.status)),
    [today, columnById],
  )

  const onBoard = useMemo(
    () => posts.filter((p) => columnById.has(p.status)),
    [posts, columnById],
  )
  const reviewCount = onBoard.filter(isPending).length
  const overdueCount = onBoard.filter(isOverdue).length

  const filtered = useMemo(() => {
    let rows = onBoard
    if (filterCategory) rows = rows.filter((p) => p.categoryId === filterCategory)
    if (filterAssignee === "_none") rows = rows.filter((p) => !p.assigneeId)
    else if (filterAssignee) rows = rows.filter((p) => p.assigneeId === filterAssignee)
    if (filterCampaign) rows = rows.filter((p) => p.campaignId === filterCampaign)
    if (reviewOnly) rows = rows.filter(isPending)
    if (overdueOnly) rows = rows.filter(isOverdue)
    if (filterQ.trim()) {
      const needle = filterQ.trim().toLowerCase()
      rows = rows.filter((p) =>
        [p.brief, p.blurb, p.humanId].filter(Boolean).some((s) => s!.toLowerCase().includes(needle)),
      )
    }
    return rows
  }, [onBoard, filterCategory, filterAssignee, filterCampaign, reviewOnly, overdueOnly, filterQ, isOverdue])

  const byStatus = useMemo(() => {
    const map = new Map<string, WithId<Post>[]>()
    for (const col of columns) map.set(col.id, [])
    for (const p of filtered) map.get(p.status)?.push(p)
    for (const list of map.values()) list.sort((a, b) => rankOf(a) - rankOf(b))
    return map
  }, [filtered, columns])

  const counts = useMemo(
    () => new Map([...byStatus].map(([id, list]) => [id, list.length])),
    [byStatus],
  )

  const activePost = useMemo(
    () => posts.find((p) => p.id === activeId) ?? null,
    [posts, activeId],
  )

  /* Selection is pruned against live data: a card approved elsewhere (or by
   * the bulk action itself) leaves pending state and drops out here. */
  const pendingIds = useMemo(
    () => new Set(posts.filter(isPending).map((p) => p.id)),
    [posts],
  )
  const activeSelection = useMemo(
    () => [...selectedIds].filter((id) => pendingIds.has(id)),
    [selectedIds, pendingIds],
  )

  const activeMobileColumnId =
    mobileColumnId && columns.some((c) => c.id === mobileColumnId)
      ? mobileColumnId
      : (columns.find((c) => (byStatus.get(c.id)?.length ?? 0) > 0)?.id ??
        columns[0]?.id ??
        null)
  const mobileColumn = columns.find((c) => c.id === activeMobileColumnId)

  const hasFieldFilters = !!(filterCategory || filterAssignee || filterCampaign)
  const hasAnyFilter = hasFieldFilters || reviewOnly || overdueOnly || !!filterQ.trim()
  const filterSummary = [
    filterCategory ? categoryById.get(filterCategory)?.name : null,
    filterAssignee === "_none" ? "Unassigned" : filterAssignee ? userById.get(filterAssignee)?.name : null,
    filterCampaign ? campaigns.find((c) => c.id === filterCampaign)?.name : null,
  ]
    .filter(Boolean)
    .join(", ")

  function clearFilters() {
    setFilterCategory("")
    setFilterAssignee("")
    setFilterCampaign("")
    setReviewOnly(false)
    setOverdueOnly(false)
    setFilterQ("")
  }

  function toggleSelect(post: WithId<Post>) {
    if (!selectedIds.has(post.id) && activeSelection.length >= BULK_LIMIT) {
      toast.message(`You can select up to ${BULK_LIMIT} cards at a time`)
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(post.id)) next.delete(post.id)
      else next.add(post.id)
      return next
    })
  }

  function selectAllPending() {
    const ids = filtered.filter(isPending).slice(0, BULK_LIMIT).map((p) => p.id)
    setSelectedIds(new Set(ids))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === "Escape" && activeSelection.length > 0) {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeSelection.length])

  /* Patch every cached posts query (any date range) by id so the card jumps
   * instantly; invalidate afterwards reconciles against the server. */
  function patchPost(id: string, patch: Partial<Post>) {
    queryClient.setQueriesData<WithId<Post>[]>(
      { queryKey: ["posts", orgId] },
      (curr) => curr?.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  }

  function commitPlacement(post: WithId<Post>, next: { status: PostStatus; boardRank: number }) {
    const prev = { status: post.status, boardRank: rankOf(post) }
    patchPost(post.id, next)
    startTransition(async () => {
      const res = await updatePost({ id: post.id, ...next })
      if (!res.ok) {
        patchPost(post.id, prev)
        toast.error(res.error ?? "Could not move post")
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    })
  }

  const columnLabel = (id: string) => columnById.get(id)?.label ?? id

  function placeWithUndo(post: WithId<Post>, status: PostStatus, boardRank: number) {
    const from = { status: post.status, boardRank: rankOf(post) }
    if (from.status === status && from.boardRank === boardRank) return
    commitPlacement(post, { status, boardRank })
    if (from.status === status) return
    toast.success(`Moved to ${columnLabel(status)}`, {
      description: post.brief ?? undefined,
      action: {
        label: "Undo",
        onClick: () => commitPlacement({ ...post, status, boardRank }, from),
      },
    })
  }

  function moveWithUndo(post: WithId<Post>, next: PostStatus) {
    if (post.status === next) return
    const list = byStatus.get(next) ?? []
    placeWithUndo(post, next, rankBetween(list.at(-1), undefined))
  }

  function jumpTo(columnId: string) {
    setMobileColumnId(columnId)
    const col = columnById.get(columnId)
    if (col && isCollapsed(col)) setCollapsed(columnId, false)
    requestAnimationFrame(() => {
      const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-column-id="${columnId}"]`)
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" })
    })
  }

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string)
    /* Without a real measurement the overlay's `w-full` card collapses to
     * min-content (a warped vertical sliver), so floor to a sane card width. */
    const measured = active.rect.current.initial?.width
    setDragWidth(measured && measured > 80 ? measured : DRAG_CARD_WIDTH)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return
    const post = posts.find((p) => p.id === active.id)
    if (!post) return
    const overPost = columnById.has(over.id as string)
      ? null
      : posts.find((p) => p.id === over.id)
    const status = (overPost?.status ?? over.id) as PostStatus
    if (!columnById.has(status)) return
    const list = byStatus.get(status) ?? []
    if (!overPost) {
      if (post.status !== status) placeWithUndo(post, status, rankBetween(list.at(-1), undefined))
      return
    }
    if (overPost.id === post.id) return
    const from = list.findIndex((p) => p.id === post.id)
    const to = list.findIndex((p) => p.id === overPost.id)
    const rest = list.filter((p) => p.id !== post.id)
    const at = rest.findIndex((p) => p.id === overPost.id)
    const insertAt = from !== -1 && from < to ? at + 1 : at
    placeWithUndo(post, status, rankBetween(rest[insertAt - 1], rest[insertAt]))
  }

  const collision: CollisionDetection = (args) => {
    const hits = pointerWithin(args)
    const card = hits.find((h) => !columnById.has(h.id as string))
    return card ? [card] : hits
  }

  const columnProps = {
    allColumns: columns,
    categoryById,
    userById,
    onCardClick: openComposerWithPost,
    onCardStatusChange: moveWithUndo,
    selectedIds,
    selectionActive: activeSelection.length > 0,
    onToggleSelect: toggleSelect,
    filtered: hasAnyFilter,
  }

  const boardEmpty = onBoard.length === 0

  const fieldFilters = (full?: boolean) => (
    <>
      <FilterSelect
        label="Category"
        value={filterCategory}
        onChange={setFilterCategory}
        options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
        full={full}
      />
      <FilterSelect
        label="Assignee"
        value={filterAssignee}
        onChange={setFilterAssignee}
        options={[
          { value: "_none", label: "Unassigned" },
          ...users.map((u) => ({ value: u.id, label: u.name })),
        ]}
        full={full}
      />
      {campaigns.length > 0 ? (
        <FilterSelect
          label="Campaign"
          value={filterCampaign}
          onChange={setFilterCampaign}
          options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
          full={full}
        />
      ) : null}
    </>
  )

  const quickFilters = (
    <>
      <QuickFilter
        active={reviewOnly}
        onClick={() => setReviewOnly((v) => !v)}
        disabled={reviewCount === 0 && !reviewOnly}
        icon={<CheckCheck aria-hidden className="size-3.5" />}
        label="Needs review"
        count={reviewCount}
        tone="amber"
      />
      <QuickFilter
        active={overdueOnly}
        onClick={() => setOverdueOnly((v) => !v)}
        disabled={overdueCount === 0 && !overdueOnly}
        icon={<AlarmClock aria-hidden className="size-3.5" />}
        label="Overdue"
        count={overdueCount}
        tone="red"
      />
    </>
  )

  return (
    <TooltipProvider>
      <div className="mb-4 flex flex-col gap-3 md:mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="h-9 w-full md:w-60">
            <InputGroupAddon align="inline-start">
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchRef}
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFilterQ("")
                  e.currentTarget.blur()
                }
              }}
              placeholder="Search posts"
              aria-label="Search posts"
            />
            <InputGroupAddon align="inline-end" className="hidden md:flex">
              {filterQ ? (
                <button
                  type="button"
                  onClick={() => setFilterQ("")}
                  aria-label="Clear search"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">/</kbd>
              )}
            </InputGroupAddon>
          </InputGroup>
          <div className="hidden items-center gap-1.5 md:flex">{fieldFilters()}</div>
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border md:block" />
          <div className="flex items-center gap-1.5">{quickFilters}</div>
          {hasAnyFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-muted-foreground"
            >
              Clear
            </Button>
          ) : null}
          <span className="flex-1" />
          {reviewOnly && reviewCount > 0 ? (
            <Button variant="outline" size="sm" className="h-8" onClick={selectAllPending}>
              Select all {Math.min(filtered.filter(isPending).length, BULK_LIMIT)}
            </Button>
          ) : null}
          <p className="hidden text-xs tabular-nums text-muted-foreground lg:block" aria-live="polite">
            {hasAnyFilter ? `${filtered.length} of ${onBoard.length} posts` : `${onBoard.length} posts`}
          </p>
        </div>

        <div className="md:hidden">
          <SettingDisclosure
            title="Filters"
            defaultOpen={hasFieldFilters}
            summary={filterSummary || "Category, assignee, campaign"}
          >
            <div className="grid gap-3">{fieldFilters(true)}</div>
          </SettingDisclosure>
        </div>

        <FlowStrip columns={columns} counts={counts} onJump={jumpTo} className="hidden md:flex" />
      </div>

      {boardEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">Your board is empty</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
            Plan a post and it lands in {columns[0]?.label ?? "the first column"}. Drag it right as the work moves forward.
          </p>
          <Button className="mt-5" onClick={() => openQuickAdd({ source: "other" })}>
            <Plus aria-hidden className="size-4" />
            Plan a post
          </Button>
        </div>
      ) : (
        <>
          <SegmentedTabs
            className="mb-3 w-full md:hidden"
            scrollable
            value={activeMobileColumnId ?? ""}
            onChange={setMobileColumnId}
            tabs={columns.map((col) => ({
              id: col.id,
              label: (
                <>
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                  <span className="max-w-[7rem] truncate">{col.label}</span>
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {counts.get(col.id) ?? 0}
                  </span>
                </>
              ),
            }))}
          />

          <div
            ref={scrollerRef}
            className="-mx-4 min-h-0 flex-1 px-4 pb-24 sm:-mx-10 sm:px-10 md:overflow-x-auto md:scrollbar-subtle md:pb-3"
          >
            <DndContext
              id="kanban-board"
              sensors={sensors}
              collisionDetection={collision}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="hidden h-full w-max gap-2.5 md:flex">
                {columns.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    posts={byStatus.get(col.id) ?? []}
                    collapsed={
                      hasAnyFilter ? (counts.get(col.id) ?? 0) === 0 : isCollapsed(col)
                    }
                    onCollapsedChange={(v) => setCollapsed(col.id, v)}
                    dragEnabled
                    {...columnProps}
                  />
                ))}
                <KanbanColumnAddButton onClick={() => setCreateOpen(true)} />
              </div>

              <div className="flex flex-col gap-3 md:hidden">
                {mobileColumn ? (
                  <KanbanColumn
                    column={mobileColumn}
                    posts={byStatus.get(mobileColumn.id) ?? []}
                    dragEnabled={false}
                    fullWidth
                    {...columnProps}
                  />
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateOpen(true)}
                  className="w-full text-muted-foreground"
                >
                  <Plus aria-hidden className="size-4" />
                  Add column
                </Button>
              </div>

              <DragOverlay dropAnimation={null}>
                {activePost ? (
                  <div style={{ width: dragWidth ?? DRAG_CARD_WIDTH }}>
                    <KanbanCard
                      post={activePost}
                      category={categoryById.get(activePost.categoryId ?? "")}
                      assignee={userById.get(activePost.assigneeId ?? "")}
                      openWork={isOpenWork(columnById.get(activePost.status))}
                      onClick={() => {}}
                      dragEnabled={false}
                      isDragging
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </>
      )}

      <BulkApproveBar
        selectedIds={activeSelection}
        onClear={() => setSelectedIds(new Set())}
      />

      <ColumnEditDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onDone={() => router.refresh()}
      />
    </TooltipProvider>
  )
}

function QuickFilter({
  active,
  onClick,
  disabled,
  icon,
  label,
  count,
  tone,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  icon: ReactNode
  label: string
  count: number
  tone: "amber" | "red"
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none",
        "transition-[background-color,border-color,color] duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:cursor-default disabled:opacity-50",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground hover:bg-secondary/60",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "min-w-4 rounded-full px-1 text-center text-[11px] tabular-nums",
          active
            ? "bg-background/20"
            : count > 0
              ? tone === "amber"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300"
                : "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-300"
              : "text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  full,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; color?: string }[]
  full?: boolean
}) {
  const selected = options.find((o) => o.value === value)
  return (
    <Select
      value={value || "_all"}
      onValueChange={(v) => onChange(!v || v === "_all" ? "" : (v as string))}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-8 rounded-full text-[13px]",
          full ? "h-10 w-full rounded-lg" : "max-w-52",
          selected
            ? "border-foreground/30 bg-secondary/60 text-foreground"
            : "text-muted-foreground",
        )}
      >
        <SelectValue>
          {() =>
            selected ? (
              <span className="flex min-w-0 items-center gap-1.5">
                {selected.color ? (
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />
                ) : null}
                <span className="text-muted-foreground">{label}:</span>
                <span className="truncate">{selected.label}</span>
              </span>
            ) : (
              label
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_all">Any {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <span className="flex items-center gap-2">
              {o.color ? (
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: o.color }}
                />
              ) : null}
              {o.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
