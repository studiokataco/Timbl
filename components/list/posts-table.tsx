"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { Download, FilterX, Flag, ListChecks, Search, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { EmptyState } from "@/components/shared/empty-state"
import { SettingDisclosure } from "@/components/settings/setting-disclosure"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchPostsInRangeAction, updatePost } from "@/lib/actions/posts"
import { bulkSetStatus } from "@/lib/actions/posts-bulk"
import { SchedulePostPopover } from "@/components/shared/schedule-post-popover"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import { LEGACY_POST_STATUSES, type Category, type Post, type PostStatus, type User } from "@/lib/schemas"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { formatPostTypes } from "@/lib/post-types"
import { postStatusLabel } from "@/lib/labels/enums"
import { categoryPillColors } from "@/components/calendar/color"
import { statusGlyph } from "@/components/calendar/post-chip"

const STATUS_FILTER_OPTIONS = LEGACY_POST_STATUSES.map((s) => ({
  value: s,
  label: postStatusLabel(s),
}))

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  normal: "#3b82f6",
  low: "#94a3b8",
}
const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
}

type Props = {
  orgId: string
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  range: { start: string; end: string }
  realtimeEnabled?: boolean
}

/*
 * The List view. Filter state lives in URL searchParams so any saved view
 * is just a bookmarkable link. Filtering, sorting, and search all run
 * client-side over the server-supplied set; pagination tops out at 50/page.
 */
export function PostsTable({
  orgId,
  posts: initialPosts,
  categories,
  users,
  range,
  realtimeEnabled = false,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { openComposer } = useDialogs()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /* Live posts: seeded from the server render, kept fresh by usePostsRealtime
   * (Firestore onSnapshot -> invalidate). Status edits elsewhere and design
   * links now reflect here without a manual refresh. */
  const { data: posts = initialPosts } = useQuery({
    queryKey: ["posts", orgId, range.start, range.end],
    queryFn: () => fetchPostsInRangeAction(range),
    initialData: initialPosts,
    staleTime: 30_000,
  })
  usePostsRealtime({ orgId, ...range, queryClient, enabled: realtimeEnabled })

  const status = (searchParams.get("status") ?? "").split(",").filter(Boolean) as PostStatus[]
  const category = (searchParams.get("category") ?? "").split(",").filter(Boolean)
  const assignee = (searchParams.get("assignee") ?? "").split(",").filter(Boolean)
  const q = searchParams.get("q") ?? ""
  const dateFrom = searchParams.get("from") ?? ""
  const dateTo = searchParams.get("to") ?? ""
  const sortBy = searchParams.get("sort") ?? "scheduledDate"
  const sortDir = searchParams.get("dir") ?? "asc"
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const PAGE_SIZE = 50

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value && value.length > 0) next.set(key, value)
    else next.delete(key)
    next.delete("page")
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const filtered = useMemo(() => {
    let rows = posts
    if (status.length) rows = rows.filter((p) => status.includes(p.status))
    if (category.length) rows = rows.filter((p) => p.categoryId && category.includes(p.categoryId))
    if (assignee.length) rows = rows.filter((p) => p.assigneeId && assignee.includes(p.assigneeId))
    if (dateFrom) rows = rows.filter((p) => p.scheduledDate >= dateFrom)
    if (dateTo) rows = rows.filter((p) => p.scheduledDate <= dateTo)
    if (q) {
      const needle = q.toLowerCase()
      rows = rows.filter((p) =>
        [p.brief, p.blurb, p.detailedBrief, p.notes]
          .filter(Boolean)
          .some((s) => (s as string).toLowerCase().includes(needle)),
      )
    }
    rows = [...rows].sort((a, b) => {
      if (sortBy === "priority") {
        const ar = PRIORITY_RANK[a.priority ?? ""] ?? 99
        const br = PRIORITY_RANK[b.priority ?? ""] ?? 99
        const cmp = ar - br
        return sortDir === "asc" ? cmp : -cmp
      }
      const av = (a as unknown as Record<string, string>)[sortBy] ?? ""
      const bv = (b as unknown as Record<string, string>)[sortBy] ?? ""
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
    return rows
  }, [posts, status, category, assignee, dateFrom, dateTo, q, sortBy, sortDir])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const allSelectedOnPage =
    paged.length > 0 && paged.every((p) => selected.has(p.id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelectedOnPage) {
        for (const p of paged) next.delete(p.id)
      } else {
        for (const p of paged) next.add(p.id)
      }
      return next
    })
  }

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setParam("dir", sortDir === "asc" ? "desc" : "asc")
    } else {
      setParam("sort", col)
      setParam("dir", "asc")
    }
  }

  const exportCsv = () => {
    const head = [
      "id",
      "date",
      "status",
      "priority",
      "title",
      "category",
      "lead",
      "assignee",
      "postType",
    ]
    const lines = [head.join(",")]
    for (const p of filtered) {
      const cells = [
        p.humanId ?? "",
        p.scheduledDate,
        p.status,
        p.priority ?? "",
        (p.brief ?? "").replaceAll('"', '""'),
        categoryById.get(p.categoryId ?? "")?.name ?? "",
        userById.get(p.leadUserId ?? "")?.name ?? "",
        userById.get(p.assigneeId ?? "")?.name ?? "",
        formatPostTypes(p),
      ]
        .map((c) => `"${c}"`)
        .join(",")
      lines.push(cells)
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `posts-${format(new Date(), "yyyyMMdd-HHmm")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const bulkMarkScheduled = () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const idSet = new Set(ids)
    queryClient.setQueriesData<WithId<Post>[]>(
      { queryKey: ["posts", orgId] },
      (curr) =>
        curr?.map((p) => (idSet.has(p.id) ? { ...p, status: "scheduled" } : p)),
    )
    setSelected(new Set())
    startTransition(async () => {
      const res = await bulkSetStatus(ids, "scheduled")
      if (!res.ok) {
        toast.error(res.error ?? "Bulk update failed")
      } else {
        toast.success(`Marked ${res.updated} posts as scheduled`)
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    })
  }

  const scheduleIdea = (
    id: string,
    scheduledDate: string,
    scheduledTime?: string,
  ) => {
    startTransition(async () => {
      const res = await updatePost({
        id,
        status: "scheduled",
        scheduledDate,
        ...(scheduledTime ? { scheduledTime } : {}),
      })
      if (!res.ok) {
        toast.error(res.error ?? "Could not schedule")
        return
      }
      toast.success(
        `Scheduled for ${format(parseISO(scheduledDate), "EEE d MMM")}${
          scheduledTime ? ` at ${scheduledTime}` : ""
        }`,
      )
      queryClient.invalidateQueries({ queryKey: ["posts"] })
    })
  }

  const segmentFor = (segment: string): PostStatus[] => {
    if (segment === "ideas") return ["idea", "brief"]
    if (segment === "drafts") return ["researching", "designing", "review"]
    if (segment === "scheduled") return ["scheduled", "posted"]
    return []
  }
  const activeSegment = (() => {
    if (status.length === 0) return "all"
    for (const seg of ["ideas", "drafts", "scheduled"] as const) {
      const want = segmentFor(seg)
      if (
        want.length === status.length &&
        want.every((s) => status.includes(s))
      )
        return seg
    }
    return null
  })()
  const setSegment = (segment: string) => {
    const next = segmentFor(segment)
    setParam("status", next.join(","))
  }

  const hasAdvancedFilters =
    category.length > 0 ||
    assignee.length > 0 ||
    !!dateFrom ||
    !!dateTo ||
    (status.length > 0 && activeSegment === null)

  const advancedFilterSummary = [
    activeSegment === null && status.length
      ? STATUS_FILTER_OPTIONS.find((o) => o.value === status[0])?.label ?? status[0]
      : null,
    category.length
      ? categoryById.get(category[0])?.name ?? "Category"
      : null,
    assignee.length ? userById.get(assignee[0])?.name ?? "Assignee" : null,
    dateFrom ? `From ${dateFrom}` : null,
    dateTo ? `To ${dateTo}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const clearAdvancedFilters = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("category")
    next.delete("assignee")
    next.delete("from")
    next.delete("to")
    if (activeSegment === null) next.delete("status")
    next.delete("page")
    router.replace(`?${next.toString()}`, { scroll: false })
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const segmentTabItems = (
    [
      { id: "all", label: "All posts", short: "All" },
      { id: "ideas", label: "Ideas", short: "Ideas" },
      { id: "drafts", label: "Drafts", short: "Drafts" },
      { id: "scheduled", label: "Scheduled", short: "Scheduled" },
    ] as const
  ).map((seg) => ({
    id: seg.id,
    label: (
      <>
        <span className="sm:hidden">{seg.short}</span>
        <span className="hidden sm:inline">{seg.label}</span>
      </>
    ),
  }))

  return (
    <>
      <SegmentedTabs
        tabs={segmentTabItems}
        value={activeSegment ?? ""}
        onChange={setSegment}
        className="mb-3 w-full max-w-full md:w-fit"
        scrollable
      />

      <div className="mb-4 md:hidden">
        <InputGroup className="mb-3 h-10">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Search posts..."
          />
        </InputGroup>
        <SettingDisclosure
          title="Filters"
          defaultOpen={hasAdvancedFilters}
          summary={advancedFilterSummary || "Category, assignee, dates"}
        >
          <div className="grid gap-3">
            {activeSegment === null ? (
              <FacetSelect
                label="Status"
                value={status}
                options={STATUS_FILTER_OPTIONS}
                onChange={(v) => setParam("status", v.join(","))}
                className="w-full"
              />
            ) : null}
            <FacetSelect
              label="Category"
              value={category}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(v) => setParam("category", v.join(","))}
              className="w-full"
            />
            <FacetSelect
              label="Assignee"
              value={assignee}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(v) => setParam("assignee", v.join(","))}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setParam("from", e.target.value)}
                  className="w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setParam("to", e.target.value)}
                  className="w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>
            {hasAdvancedFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearAdvancedFilters}
                className="w-full"
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </SettingDisclosure>
      </div>

      <div className="mb-4 hidden flex-wrap items-end gap-2 md:flex">
        <div className="flex min-w-[180px] flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Title, caption, brief..."
          />
        </div>
        <FacetSelect
          label="Status"
          value={status}
          options={STATUS_FILTER_OPTIONS}
          onChange={(v) => setParam("status", v.join(","))}
        />
        <FacetSelect
          label="Category"
          value={category}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          onChange={(v) => setParam("category", v.join(","))}
        />
        <FacetSelect
          label="Assignee"
          value={assignee}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
          onChange={(v) => setParam("assignee", v.join(","))}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setParam("from", e.target.value)}
            className="w-[140px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setParam("to", e.target.value)}
            className="w-[140px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 dark:[&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "post" : "posts"}
          <span className="hidden md:inline"> match</span>
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={bulkMarkScheduled}
            disabled={selected.size === 0 || pending}
            className="hidden md:inline-flex"
          >
            <ListChecks aria-hidden className="size-4" />
            Mark scheduled
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="md:inline-flex">
            <Download aria-hidden className="size-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      <div className="space-y-2 pb-24 md:hidden md:pb-0">
        {paged.length === 0 ? (
          <EmptyState
            icon={FilterX}
            title="No posts match these filters"
            body="Try clearing a filter, widening the date range, or adjusting your search term."
            size="sm"
          />
        ) : (
          paged.map((p) => {
            const cat = categoryById.get(p.categoryId ?? "")
            const assg = userById.get(p.assigneeId ?? "")
            const isSelected = selected.has(p.id)
            const canSchedule = p.status === "idea" || p.status === "brief"
            return (
              <div
                key={p.id}
                style={{ borderLeftColor: cat?.color ?? undefined }}
                className={cn(
                  "relative rounded-lg border border-border border-l-4 bg-background p-3 transition-colors",
                  isSelected && "ring-2 ring-primary/30",
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelected(p.id)}
                  aria-label={`Select ${p.brief ?? "post"}`}
                  className="absolute right-3 top-3"
                />
                <button
                  type="button"
                  onClick={() => openComposer(p.id)}
                  className="w-full pr-8 text-left active:opacity-80"
                >
                  <div className="flex items-start gap-1.5">
                    {p.priority ? (
                      <Flag
                        aria-label={`${p.priority} priority`}
                        className="mt-0.5 size-3 shrink-0"
                        style={{ color: PRIORITY_COLOR[p.priority] }}
                      />
                    ) : null}
                    <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                      {p.humanId ? (
                        <span className="mr-1 font-mono text-[11px] font-normal text-muted-foreground">
                          {p.humanId}
                        </span>
                      ) : null}
                      {p.brief ?? "Untitled post"}
                      {p.isAiGenerated || p.agentMeta ? (
                        <Sparkles
                          aria-label="AI-assisted"
                          className="ml-1 inline size-3 align-text-top text-muted-foreground"
                        />
                      ) : null}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <span>{format(parseISO(p.scheduledDate), "d MMM yyyy")}</span>
                    <span aria-hidden>·</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-normal">
                      {postStatusLabel(p.status)}
                    </Badge>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{formatPostTypes(p)}</span>
                  </div>
                  {cat || assg ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {cat ? (
                        <span
                          className="inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
                          style={categoryPillColors(cat.color)}
                        >
                          <span aria-hidden className="font-bold">
                            {statusGlyph(p.status)}
                          </span>
                          <span className="truncate">{cat.name}</span>
                        </span>
                      ) : null}
                      {assg ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-medium">
                            {assg.name[0]?.toUpperCase()}
                          </span>
                          {assg.name}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
                {canSchedule ? (
                  <div
                    className="mt-3 border-t border-border pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SchedulePostPopover
                      initialDate={p.scheduledDate}
                      pending={pending}
                      onConfirm={(d, t) => scheduleIdea(p.id, d, t)}
                    />
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <div className="hidden min-w-0 overflow-x-auto rounded-lg border border-border bg-background md:block">
        <table className="w-full min-w-[60rem] table-fixed text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-[9.5rem]" />
            <col className="w-24" />
            <col />
            <col className="w-44" />
            <col className="w-24" />
            <col className="w-28" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-[6.5rem]" />
          </colgroup>
          <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-1.5 py-2">
                <Checkbox
                  checked={allSelectedOnPage}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all on page"
                />
              </th>
              <Th onClick={() => toggleSort("scheduledDate")}>Date</Th>
              <Th onClick={() => toggleSort("status")}>Status</Th>
              <Th onClick={() => toggleSort("brief")}>Title</Th>
              <Th>Category</Th>
              <Th>Lead</Th>
              <Th>Assignee</Th>
              <Th onClick={() => toggleSort("priority")}>Priority</Th>
              <Th>Type</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6">
                  <EmptyState
                    icon={FilterX}
                    title="No posts match these filters"
                    body="Try clearing a filter, widening the date range, or adjusting your search term."
                    size="sm"
                    className="border-0 bg-transparent"
                  />
                </td>
              </tr>
            ) : (
              paged.map((p) => {
                const cat = categoryById.get(p.categoryId ?? "")
                const lead = userById.get(p.leadUserId ?? "")
                const assg = userById.get(p.assigneeId ?? "")
                const canSchedule = p.status === "idea" || p.status === "brief"
                return (
                  <tr
                    key={p.id}
                    className="border-t border-border hover:bg-secondary/30 cursor-pointer"
                    onClick={() => openComposer(p.id)}
                  >
                    <RowCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(p.id)) next.delete(p.id)
                            else next.add(p.id)
                            return next
                          })
                        }
                        aria-label={`Select ${p.brief}`}
                      />
                    </RowCell>
                    <RowCell className="whitespace-nowrap">
                      {format(parseISO(p.scheduledDate), "EEE d MMM yyyy")}
                    </RowCell>
                    <RowCell>
                      <Badge variant="secondary" className="font-normal">
                        {postStatusLabel(p.status)}
                      </Badge>
                    </RowCell>
                    <RowCell className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {p.humanId ? (
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {p.humanId}
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate">{p.brief ?? "-"}</span>
                        {p.isAiGenerated || p.agentMeta ? (
                          <Sparkles
                            aria-label="AI-assisted"
                            className="size-3 shrink-0 text-muted-foreground"
                          />
                        ) : null}
                      </div>
                    </RowCell>
                    <RowCell className="min-w-0">
                      {cat ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate">{cat.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </RowCell>
                    <RowCell className="min-w-0 truncate text-xs">{lead?.name ?? "-"}</RowCell>
                    <RowCell className="min-w-0 truncate text-xs">{assg?.name ?? "-"}</RowCell>
                    <RowCell>
                      {p.priority ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Flag
                            aria-hidden
                            className="size-3.5 shrink-0"
                            style={{ color: PRIORITY_COLOR[p.priority] }}
                          />
                          {PRIORITY_LABEL[p.priority]}
                        </span>
                      ) : (
                        <Flag
                          aria-label="No priority"
                          className="size-3.5 text-muted-foreground/30"
                        />
                      )}
                    </RowCell>
                    <RowCell className="text-xs capitalize">{formatPostTypes(p)}</RowCell>
                    <RowCell
                      className={cn(
                        "justify-end",
                        canSchedule ? "cursor-pointer" : "cursor-default",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canSchedule ? (
                        <SchedulePostPopover
                          initialDate={p.scheduledDate}
                          pending={pending}
                          onConfirm={(d, t) => scheduleIdea(p.id, d, t)}
                        />
                      ) : null}
                    </RowCell>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setParam("page", String(page - 1))}
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setParam("page", String(page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {selected.size > 0 ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg md:hidden"
        >
          <span className="text-sm tabular-nums">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={bulkMarkScheduled} disabled={pending}>
              <ListChecks aria-hidden className="size-4" />
              Schedule
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setSelected(new Set())}
              disabled={pending}
            >
              <X aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

    </>
  )
}

function RowCell({
  className,
  children,
  onClick,
}: {
  className?: string
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLTableCellElement>
}) {
  return (
    <td className="h-px min-w-0 p-0" onClick={onClick}>
      <div className={cn("flex h-full min-h-9 min-w-0 items-center px-1.5 py-2", className)}>
        {children}
      </div>
    </td>
  )
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <th
      className={`px-1.5 py-2 text-left font-medium ${onClick ? "cursor-pointer hover:text-foreground" : ""}`}
      onClick={onClick}
    >
      {children}
    </th>
  )
}

function FacetSelect({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: string[]
  options: { value: string; label: string }[]
  onChange: (next: string[]) => void
  className?: string
}) {
  const current = value[0] ?? ""
  return (
    <div className={cn("flex w-[140px] flex-col gap-1", className)}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select
        value={current}
        onValueChange={(v) => onChange(v ? [v] : [])}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Any">
            {(v) => {
              if (!v) return "Any"
              return options.find((o) => o.value === v)?.label ?? v
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Any</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
