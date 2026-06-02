"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { Download, FilterX, ListChecks } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchPostsInRangeAction } from "@/lib/actions/posts"
import { bulkSetStatus } from "@/lib/actions/posts-bulk"
import { usePostsRealtime } from "@/lib/realtime/subscribe-posts"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import { LEGACY_POST_STATUSES, type Category, type Post, type PostStatus, type User } from "@/lib/schemas"
import { useDialogs } from "@/components/shared/dialogs-provider"
import { formatPostTypes } from "@/lib/post-types"
import { postStatusLabel } from "@/lib/labels/enums"

const STATUS_FILTER_OPTIONS = LEGACY_POST_STATUSES.map((s) => ({
  value: s,
  label: postStatusLabel(s),
}))

type Props = {
  orgId: string
  posts: WithId<Post>[]
  categories: WithId<Category>[]
  users: WithId<User>[]
  range: { start: string; end: string }
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
  usePostsRealtime({ orgId, ...range, queryClient })

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
      "date",
      "status",
      "category",
      "brief",
      "lead",
      "assignee",
      "postType",
    ]
    const lines = [head.join(",")]
    for (const p of filtered) {
      const cells = [
        p.scheduledDate,
        p.status,
        categoryById.get(p.categoryId ?? "")?.name ?? "",
        (p.brief ?? "").replaceAll('"', '""'),
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 mb-3 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {(
          [
            { id: "all", label: "All posts" },
            { id: "ideas", label: "Ideas" },
            { id: "drafts", label: "Drafts" },
            { id: "scheduled", label: "Scheduled" },
          ] as const
        ).map((seg) => (
          <button
            key={seg.id}
            type="button"
            onClick={() => setSegment(seg.id)}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              activeSegment === seg.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {seg.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="flex flex-col gap-1 min-w-[180px] flex-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Title, caption, brief…"
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
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setParam("to", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "post" : "posts"} match
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={bulkMarkScheduled}
            disabled={selected.size === 0 || pending}
          >
            <ListChecks aria-hidden className="size-4" />
            Mark scheduled
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download aria-hidden className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto bg-background">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 p-2">
                <Checkbox
                  checked={allSelectedOnPage}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all on page"
                />
              </th>
              <Th onClick={() => toggleSort("scheduledDate")}>Date</Th>
              <Th onClick={() => toggleSort("status")}>Status</Th>
              <Th>Category</Th>
              <Th onClick={() => toggleSort("brief")}>Brief</Th>
              <Th>Lead</Th>
              <Th>Assignee</Th>
              <Th>Type</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6">
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
                return (
                  <tr
                    key={p.id}
                    className="border-t border-border hover:bg-secondary/30"
                  >
                    <td className="p-2">
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
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {format(parseISO(p.scheduledDate), "EEE d MMM")}
                    </td>
                    <td className="p-2">
                      <Badge variant="secondary" className="font-normal">
                        {postStatusLabel(p.status)}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-2 max-w-[280px] truncate">{p.brief ?? "-"}</td>
                    <td className="p-2 text-xs">{lead?.name ?? "-"}</td>
                    <td className="p-2 text-xs">{assg?.name ?? "-"}</td>
                    <td className="p-2 text-xs capitalize">{formatPostTypes(p)}</td>
                    <td className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openComposer(p.id)}
                      >
                        Open
                      </Button>
                    </td>
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

    </>
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
      className={`p-2 text-left font-medium ${onClick ? "cursor-pointer hover:text-foreground" : ""}`}
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
}: {
  label: string
  value: string[]
  options: { value: string; label: string }[]
  onChange: (next: string[]) => void
}) {
  // Single-select facade for now; the URL still serialises as a list so
  // multi-select can land later without changing the wire format.
  const current = value[0] ?? ""
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Select
        value={current}
        onValueChange={(v) => onChange(v ? [v] : [])}
      >
        <SelectTrigger>
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
