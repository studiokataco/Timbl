"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { format, parseISO } from "date-fns"
import {
  Bell,
  BellOff,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  Layers,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Plus,
  Repeat2,
  Share2,
  Tag,
  Trash2,
  User as UserIcon,
  Users as UsersIcon,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SegmentedTabs, type SegmentedTab } from "@/components/ui/segmented-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { WithId } from "@/lib/firebase/serialize"
import type {
  Campaign,
  Category,
  ChannelKey,
  ChannelStatus,
  Cta,
  KanbanColumn,
  Post,
  PostStatus,
  PostType,
  TemplateCadence,
  User,
} from "@/lib/schemas"
import { LEGACY_POST_STATUSES, columnGroup, withClearedPostFields } from "@/lib/schemas"
import {
  CADENCE_LABELS,
  CHANNEL_STATUS_LABELS,
  POST_TYPE_LABELS,
  labelOr,
} from "@/lib/labels/enums"
import { deletePost, updatePost } from "@/lib/actions/posts"
import { fetchPostFollowers, togglePostFollow } from "@/lib/actions/post-activity"
import { createCampaign } from "@/lib/actions/campaigns"
import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { fetchOgImage } from "@/lib/actions/assets"
import { saveAsTemplate } from "@/lib/actions/templates"
import { getPostTypes, withSyncedPostTypes } from "@/lib/post-types"
import { channelsForComposer } from "@/lib/channels"
import { recordRecentPost } from "@/components/shared/command-palette"
import { HashtagInput } from "./hashtag-input"
import { DesignLinksInput } from "./design-links-input"
import { CategoryDialog } from "@/components/settings/category-dialog"
import { NetworkPreview } from "./network-preview"
import { PriorityPicker, PriorityBadge } from "./priority-picker"
import { TimeEstimateInput } from "./time-estimate-input"
import { formatTimeEstimate } from "@/lib/post-time-estimate"
import { ActivityPanel } from "./activity-panel"
import { ShareDialog } from "./share-dialog"
import { ChecklistPanel } from "./checklist-panel"
import { RelatedPanel } from "./related-panel"
import { TemplatePicker } from "./template-picker"
import { DisclosureBody, DisclosureChevron } from "@/components/ui/disclosure"

const POST_TYPE_OPTIONS: PostType[] = ["grid", "carousel", "reel", "story", "video"]
const CHANNEL_STATUS_OPTIONS: ChannelStatus[] = ["n/a", "scheduled", "published", "failed"]

type Meridiem = "AM" | "PM"
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1)
const BASE_MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5)

function parseScheduledTime(
  time?: string,
): { hour12: number; minute: number; meridiem: Meridiem } | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return {
    hour12: h % 12 === 0 ? 12 : h % 12,
    minute: m,
    meridiem: h >= 12 ? "PM" : "AM",
  }
}

function buildScheduledTime(hour12: number, minute: number, meridiem: Meridiem) {
  let h = hour12 % 12
  if (meridiem === "PM") h += 12
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function formatTimeLabel(time?: string) {
  const parts = parseScheduledTime(time)
  if (!parts) return null
  return `${parts.hour12}:${String(parts.minute).padStart(2, "0")} ${parts.meridiem}`
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: WithId<Post> | null
  categories: WithId<Category>[]
  campaigns: WithId<Campaign>[]
  ctas: WithId<Cta>[]
  users: WithId<User>[]
  kanbanColumns?: WithId<KanbanColumn>[]
  hashtagSuggestions?: string[]
  orgChannels: ChannelKey[]
  onChanged?: () => void
}

type SaveState = "idle" | "saving" | "saved" | "error"

const TABS: SegmentedTab[] = [
  { id: "brief", label: "Brief" },
  { id: "copy-tags", label: "Copy & Tags" },
  { id: "design", label: "Design" },
  { id: "channels", label: "Channels" },
  { id: "preview", label: "Preview" },
  { id: "related", label: "Related" },
]

export function PostModal({
  open,
  onOpenChange,
  post,
  categories,
  campaigns,
  ctas,
  users,
  kanbanColumns,
  hashtagSuggestions = [],
  orgChannels,
  onChanged,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const reduced = useReducedMotion()

  const [draft, setDraft] = useState<Partial<Post>>({})
  const [pending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState("brief")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [guardOpen, setGuardOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [campaignSearch, setCampaignSearch] = useState("")
  const [extraCampaigns, setExtraCampaigns] = useState<WithId<Campaign>[]>([])
  const [statusPickerOpen, setStatusPickerOpen] = useState(false)
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false)
  const [timeEstimateOpen, setTimeEstimateOpen] = useState(false)
  const [recurrenceOpen, setRecurrenceOpen] = useState(false)
  const recurrenceBodyId = useId()

  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateCadence, setTemplateCadence] = useState<TemplateCadence>("ad-hoc")
  const [shareOpen, setShareOpen] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  const lastSavedRef = useRef<string>("")
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: followers } = useQuery<string[]>({
    queryKey: ["post-followers", post?.id ?? ""],
    queryFn: () => fetchPostFollowers(post!.id),
    enabled: Boolean(post?.id),
    staleTime: 60_000,
  })
  const isFollowing = Boolean(followers?.length)

  function handleFollowToggle() {
    if (!post?.id) return
    startTransition(async () => {
      await togglePostFollow(post.id)
      queryClient.invalidateQueries({ queryKey: ["post-followers", post.id] })
    })
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(post ?? {})
    lastSavedRef.current = JSON.stringify(post ?? {})
    setSaveState("idle")
    setThumbnail(null)
    setActiveTab("brief")
    if (post?.id) recordRecentPost(post.id)
  }, [post])

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab("brief")
      setGuardOpen(false)
    }
  }, [open])

  const setField = <K extends keyof Post>(key: K, value: Post[K] | undefined) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const allCampaigns = useMemo(() => {
    const seen = new Set(campaigns.map((c) => c.id))
    return [...campaigns, ...extraCampaigns.filter((c) => !seen.has(c.id))]
  }, [campaigns, extraCampaigns])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === draft.categoryId) ?? null,
    [categories, draft.categoryId],
  )
  const selectedCampaign = useMemo(
    () => allCampaigns.find((c) => c.id === draft.campaignId) ?? null,
    [allCampaigns, draft.campaignId],
  )
  const userNameById = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users],
  )
  const ctaLabelById = useMemo(
    () => new Map(ctas.map((c) => [c.id, c.label])),
    [ctas],
  )

  const date = useMemo(
    () => (draft.scheduledDate ? parseISO(draft.scheduledDate) : new Date()),
    [draft.scheduledDate],
  )
  const timeParts = parseScheduledTime(draft.scheduledTime)
  const timeLabel = formatTimeLabel(draft.scheduledTime)
  const minuteOptions = useMemo(() => {
    if (timeParts && !BASE_MINUTE_OPTIONS.includes(timeParts.minute)) {
      return [...BASE_MINUTE_OPTIONS, timeParts.minute].sort((a, b) => a - b)
    }
    return BASE_MINUTE_OPTIONS
  }, [timeParts])

  const setTimePart = (patch: Partial<{ hour12: number; minute: number; meridiem: Meridiem }>) => {
    const base = timeParts ?? { hour12: 9, minute: 0, meridiem: "AM" as Meridiem }
    const next = { ...base, ...patch }
    setField("scheduledTime", buildScheduledTime(next.hour12, next.minute, next.meridiem))
  }

  const currentStatus = (draft.status ?? "idea") as PostStatus
  const columnIds = useMemo(
    () =>
      kanbanColumns && kanbanColumns.length > 0
        ? kanbanColumns.map((c) => c.id)
        : (LEGACY_POST_STATUSES as readonly string[]),
    [kanbanColumns],
  )
  const statusLabelById = useMemo(() => {
    const map = new Map((kanbanColumns ?? []).map((c) => [c.id, c.label]))
    if (map.size === 0) {
      for (const s of LEGACY_POST_STATUSES) {
        map.set(s, s.charAt(0).toUpperCase() + s.slice(1))
      }
    }
    return map
  }, [kanbanColumns])
  const currentStatusColumn = useMemo(
    () => kanbanColumns?.find((c) => c.id === currentStatus) ?? null,
    [kanbanColumns, currentStatus],
  )
  const groupedColumns = useMemo(() => {
    if (!kanbanColumns?.length) return null
    const g = { active: [] as WithId<KanbanColumn>[], done: [] as WithId<KanbanColumn>[], closed: [] as WithId<KanbanColumn>[] }
    for (const c of kanbanColumns) {
      const key = columnGroup(c)
      g[key].push(c)
    }
    for (const key of ["active", "done", "closed"] as const) {
      g[key].sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return g
  }, [kanbanColumns])

  const activeNextStatus = useMemo(() => {
    const actives = groupedColumns?.active ?? []
    const idx = actives.findIndex((c) => c.id === currentStatus)
    return actives[idx + 1]?.id ?? actives[0]?.id ?? null
  }, [groupedColumns, currentStatus])

  const allHashtagSuggestions = useMemo(() => {
    const cat = categories.find((c) => c.id === draft.categoryId)
    return Array.from(new Set([...(cat?.defaultHashtags ?? []), ...hashtagSuggestions]))
  }, [draft.categoryId, categories, hashtagSuggestions])

  const composerChannels = useMemo(
    () => channelsForComposer(orgChannels),
    [orgChannels],
  )

  const trimmedCampaignSearch = campaignSearch.trim()
  const showCreateCampaign =
    trimmedCampaignSearch.length > 0 &&
    !allCampaigns.some(
      (c) => c.name.toLowerCase() === trimmedCampaignSearch.toLowerCase(),
    )

  const persist = async (closeOnSuccess: boolean, overrideDraft?: Partial<Post>) => {
    if (!post?.id) return
    const next = overrideDraft ?? draft
    const snapshot = JSON.stringify(next)
    if (snapshot === lastSavedRef.current) {
      if (closeOnSuccess) onOpenChange(false)
      return
    }
    setSaveState("saving")
    const res = await updatePost({ id: post.id, ...withClearedPostFields(next) })
    if (!res.ok) {
      setSaveState("error")
      toast.error(res.error ?? "Could not save")
      return
    }
    lastSavedRef.current = snapshot
    setSaveState("saved")
    queryClient.setQueriesData<WithId<Post>[]>(
      { queryKey: ["posts"] },
      (curr) =>
        curr?.map((p) =>
          p.id === post.id ? ({ ...p, ...next } as WithId<Post>) : p,
        ),
    )
    onChanged?.()
    if (closeOnSuccess) onOpenChange(false)
  }

  const flushField = <K extends keyof Post>(key: K, value: Post[K] | undefined) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    startTransition(() => {
      void persist(false, next)
    })
  }

  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  })

  useEffect(() => {
    if (!post?.id || !open) return
    const snapshot = JSON.stringify(draft)
    if (snapshot === lastSavedRef.current) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      void persistRef.current(false)
    }, 1500)
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [draft, post?.id, open])

  const save = useCallback(() => {
    startTransition(async () => {
      await persist(true)
    })
  }, [draft, post?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, save])

  const requestClose = useCallback(() => {
    if (JSON.stringify(draft) !== lastSavedRef.current) {
      setGuardOpen(true)
    } else {
      onOpenChange(false)
    }
  }, [draft, onOpenChange])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) requestClose()
      else onOpenChange(true)
    },
    [requestClose, onOpenChange],
  )

  const fetchThumb = async (url: string) => {
    if (!url) return
    setThumbnailLoading(true)
    const res = await fetchOgImage(url)
    setThumbnailLoading(false)
    setThumbnail(res.ok ? res.image : null)
  }

  const remove = () => {
    if (!post?.id) return
    startTransition(async () => {
      const res = await deletePost(post.id)
      if (!res.ok) {
        toast.error(res.error ?? "Could not delete")
        return
      }
      toast.success("Post deleted")
      onChanged?.()
      onOpenChange(false)
    })
  }

  const openSaveAsTemplate = () => {
    if (!post?.id) return
    setTemplateName(draft.brief ?? post.brief ?? "")
    setTemplateCadence("ad-hoc")
    setTemplateDialogOpen(true)
  }

  const confirmSaveAsTemplate = () => {
    if (!post?.id || !templateName.trim()) return
    startTransition(async () => {
      const res = await saveAsTemplate({
        postId: post.id,
        name: templateName.trim(),
        cadence: templateCadence,
      })
      if (!res.ok) {
        toast.error(res.error ?? "Could not save as template")
        return
      }
      toast.success("Template saved")
      setTemplateDialogOpen(false)
    })
  }

  const createCampaignFromSearch = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    startTransition(async () => {
      const res = await createCampaign({ name: trimmed, status: "active" })
      if (!res.ok || !res.id) {
        toast.error(res.error ?? "Could not create campaign")
        return
      }
      const newId = res.id
      const now = new Date().toISOString()
      const created: WithId<Campaign> = {
        id: newId,
        organizationId: "",
        brandId: DEFAULT_BRAND_ID,
        name: trimmed,
        slug: newId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      }
      setExtraCampaigns((prev) => [...prev, created])
      setField("campaignId", newId)
      setCampaignPickerOpen(false)
      setCampaignSearch("")
      toast.success(`Campaign "${trimmed}" created`)
      onChanged?.()
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-none w-[min(1400px,96vw)] h-[92vh] gap-0 overflow-hidden p-0 max-sm:h-[100dvh] max-sm:w-full max-sm:rounded-none"
        >
          <AnimatePresence>
            {open && (
              <motion.div
                key="post-modal-inner"
                className="flex h-full flex-col overflow-hidden"
                initial={{ opacity: 0, y: reduced ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : 8 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Header */}
                <div className="flex shrink-0 items-center gap-3 border-b px-5 py-3">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/40"
                    placeholder="Untitled post"
                    value={draft.brief ?? ""}
                    onChange={(e) => setField("brief", e.target.value)}
                  />

                  {draft.humanId && (
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard.writeText(draft.humanId!); toast.success("ID copied") }}
                      className="shrink-0 rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Copy post ID"
                    >
                      {draft.humanId}
                    </button>
                  )}

                  {/* Status split button */}
                  <div className="flex shrink-0 items-center">
                    <Popover open={statusPickerOpen} onOpenChange={setStatusPickerOpen}>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            className="flex h-8 items-center gap-1.5 rounded-l-full border border-r-0 px-3 text-xs font-medium transition-colors hover:bg-muted"
                          />
                        }
                      >
                        {currentStatusColumn && (
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{ backgroundColor: currentStatusColumn.color }}
                          />
                        )}
                        {statusLabelById.get(currentStatus) ?? currentStatus}
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search status..." />
                          <CommandList>
                            <CommandEmpty>No status found.</CommandEmpty>
                            {groupedColumns ? (
                              <>
                                {groupedColumns.active.length > 0 && (
                                  <CommandGroup heading="Active">
                                    {groupedColumns.active.map((col) => (
                                      <CommandItem key={col.id} value={col.id} onSelect={() => { flushField("status", col.id as PostStatus); setStatusPickerOpen(false) }}>
                                        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: col.color }} />
                                        {col.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                                {groupedColumns.done.length > 0 && (
                                  <CommandGroup heading="Done">
                                    {groupedColumns.done.map((col) => (
                                      <CommandItem key={col.id} value={col.id} onSelect={() => { flushField("status", col.id as PostStatus); setStatusPickerOpen(false) }}>
                                        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: col.color }} />
                                        {col.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                                {groupedColumns.closed.length > 0 && (
                                  <CommandGroup heading="Closed">
                                    {groupedColumns.closed.map((col) => (
                                      <CommandItem key={col.id} value={col.id} onSelect={() => { flushField("status", col.id as PostStatus); setStatusPickerOpen(false) }}>
                                        <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: col.color }} />
                                        {col.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </>
                            ) : (
                              <CommandGroup>
                                {columnIds.map((s) => {
                                  const col = kanbanColumns?.find((c) => c.id === s)
                                  return (
                                    <CommandItem key={s} value={s} onSelect={() => { flushField("status", s as PostStatus); setStatusPickerOpen(false) }}>
                                      {col?.color && <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: col.color }} />}
                                      {statusLabelById.get(s) ?? s}
                                    </CommandItem>
                                  )
                                })}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <button
                      type="button"
                      disabled={!activeNextStatus}
                      onClick={() => {
                        if (activeNextStatus) flushField("status", activeNextStatus as PostStatus)
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-r-full border transition-colors hover:bg-muted disabled:opacity-40"
                      aria-label="Advance to next status"
                    >
                      <ChevronRight aria-hidden className="size-3" />
                    </button>
                  </div>

                  <span aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    {saveState === "saving" ? (
                      <><Loader2 aria-hidden className="size-3 animate-spin" />Saving...</>
                    ) : saveState === "saved" ? (
                      <span className="text-[var(--color-success)]">Saved</span>
                    ) : saveState === "error" ? (
                      <span className="text-destructive">Save failed</span>
                    ) : null}
                  </span>

                  {post?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Share"
                      onClick={() => setShareOpen(true)}
                    >
                      <Share2 aria-hidden className="size-4" />
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8" aria-label="More actions" />
                      }
                    >
                      <MoreHorizontal aria-hidden className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={openSaveAsTemplate} disabled={!post?.id}>
                        <LayoutTemplate aria-hidden className="mr-2 size-4" />
                        Save as template
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTemplatePickerOpen(true)}
                        disabled={!post?.id}
                      >
                        <LayoutTemplate aria-hidden className="mr-2 size-4" />
                        Apply template
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {post?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={isFollowing ? "Unfollow" : "Follow"}
                      onClick={handleFollowToggle}
                      disabled={pending}
                    >
                      {isFollowing
                        ? <BellOff aria-hidden className="size-4" />
                        : <Bell aria-hidden className="size-4" />}
                    </Button>
                  )}

                  <Button variant="ghost" size="icon" className="size-8" aria-label="Close" onClick={requestClose}>
                    <X aria-hidden className="size-4" />
                  </Button>
                </div>

                {/* Body: left metadata sidebar + right tabbed content */}
                <div className="flex min-h-0 flex-1 overflow-hidden">

                  {/* Left sidebar - metadata fields */}
                  <aside className="flex w-[240px] shrink-0 flex-col overflow-y-auto border-r pt-3 pb-6 max-sm:hidden">

                    {/* Date */}
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger render={<SidebarRowButton aria-label="Date" />}>
                        <CalendarIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground/60">Date</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                          {draft.scheduledDate
                            ? format(date, "d MMM yyyy") + (timeLabel ? `, ${timeLabel}` : "")
                            : <span className="font-normal italic text-muted-foreground/40">Add</span>}
                        </span>
                        <ChevronDown aria-hidden className="size-3 shrink-0 self-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start" side="bottom" sideOffset={4}>
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={(d) => {
                            if (d) setField("scheduledDate", format(d, "yyyy-MM-dd"))
                          }}
                        />
                        <div className="flex flex-col gap-2 border-t p-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Time</Label>
                            {draft.scheduledTime && (
                              <button
                                type="button"
                                onClick={() => setField("scheduledTime", undefined)}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={timeParts ? String(timeParts.hour12) : ""}
                              onValueChange={(v) => setTimePart({ hour12: Number(v) })}
                            >
                              <SelectTrigger className="min-w-0 flex-1">
                                <SelectValue placeholder="Hr" />
                              </SelectTrigger>
                              <SelectContent>
                                {HOUR_OPTIONS.map((h) => (
                                  <SelectItem key={h} value={String(h)}>{h}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span aria-hidden className="text-muted-foreground">:</span>
                            <Select
                              value={timeParts ? String(timeParts.minute) : ""}
                              onValueChange={(v) => setTimePart({ minute: Number(v) })}
                            >
                              <SelectTrigger className="min-w-0 flex-1">
                                <SelectValue placeholder="Min" />
                              </SelectTrigger>
                              <SelectContent>
                                {minuteOptions.map((m) => (
                                  <SelectItem key={m} value={String(m)}>
                                    {String(m).padStart(2, "0")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex shrink-0 overflow-hidden rounded-md border">
                              {(["AM", "PM"] as Meridiem[]).map((mer) => {
                                const active = (timeParts?.meridiem ?? "AM") === mer
                                return (
                                  <button
                                    key={mer}
                                    type="button"
                                    aria-pressed={timeParts ? active : false}
                                    onClick={() => setTimePart({ meridiem: mer })}
                                    className={
                                      timeParts && active
                                        ? "bg-foreground px-2.5 py-1.5 text-xs font-medium text-background"
                                        : "px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                                    }
                                  >
                                    {mer}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                        {/* Recurrence */}
                        <div className="border-t">
                          <button
                            type="button"
                            aria-expanded={recurrenceOpen}
                            aria-controls={recurrenceBodyId}
                            onClick={() => setRecurrenceOpen((o) => !o)}
                            className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <span className="flex items-center gap-1.5">
                              <Repeat2 aria-hidden className="size-3" />
                              {draft.recurrence
                                ? `Repeat: ${draft.recurrence.freq}${draft.recurrence.interval && draft.recurrence.interval > 1 ? ` x${draft.recurrence.interval}` : ""}`
                                : "Set recurring"}
                            </span>
                            <DisclosureChevron open={recurrenceOpen} className="size-3" />
                          </button>
                          <DisclosureBody id={recurrenceBodyId} open={recurrenceOpen} className="flex flex-col gap-2 px-3 pb-3">
                              <div className="flex gap-1.5">
                                {(["daily", "weekly", "custom"] as const).map((freq) => (
                                  <button
                                    key={freq}
                                    type="button"
                                    onClick={() => setField("recurrence", { ...draft.recurrence, freq })}
                                    className={`flex-1 rounded-md border px-2 py-1 text-xs capitalize transition-colors ${draft.recurrence?.freq === freq ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`}
                                  >
                                    {freq}
                                  </button>
                                ))}
                              </div>
                              {draft.recurrence && (
                                <button
                                  type="button"
                                  onClick={() => setField("recurrence", undefined)}
                                  className="text-left text-xs text-muted-foreground hover:text-destructive"
                                >
                                  Clear recurrence
                                </button>
                              )}
                          </DisclosureBody>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <div className="mx-4 my-1.5 border-t border-border/30" />

                    {/* Category */}
                    <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
                      <PopoverTrigger render={<SidebarRowButton aria-label="Category" />}>
                        <Tag aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground/60">Category</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                          {selectedCategory ? (
                            <>
                              <span
                                aria-hidden
                                className="mr-1.5 inline-block size-2 translate-y-[1px] rounded-full"
                                style={{ backgroundColor: selectedCategory.color }}
                              />
                              {selectedCategory.name}
                            </>
                          ) : (
                            <span className="font-normal italic text-muted-foreground/40">Add</span>
                          )}
                        </span>
                        <ChevronDown aria-hidden className="size-3 shrink-0 self-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[208px] p-2" align="start" alignOffset={16} side="bottom" sideOffset={4}>
                        <Command>
                          <CommandInput placeholder="Search categories..." />
                          <CommandList>
                            <CommandEmpty>No category.</CommandEmpty>
                            <CommandGroup>
                              {categories.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.name}
                                  onSelect={() => {
                                    setField("categoryId", c.id)
                                    setCategoryPickerOpen(false)
                                  }}
                                >
                                  <span
                                    aria-hidden
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  {c.name}
                                </CommandItem>
                              ))}
                              <CommandItem
                                value="new category"
                                onSelect={() => {
                                  setCategoryPickerOpen(false)
                                  setNewCategoryOpen(true)
                                }}
                              >
                                <Plus className="size-4" />
                                New category
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Campaign */}
                    <Popover
                      open={campaignPickerOpen}
                      onOpenChange={(o) => {
                        setCampaignPickerOpen(o)
                        if (!o) setCampaignSearch("")
                      }}
                    >
                      <PopoverTrigger render={<SidebarRowButton aria-label="Campaign" />}>
                        <Layers aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground/60">Campaign</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                          {selectedCampaign
                            ? selectedCampaign.name
                            : <span className="font-normal italic text-muted-foreground/40">Add</span>}
                        </span>
                        <ChevronDown aria-hidden className="size-3 shrink-0 self-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[208px] p-2" align="start" alignOffset={16} side="bottom" sideOffset={4}>
                        <Command>
                          <CommandInput
                            placeholder="Search campaigns..."
                            value={campaignSearch}
                            onValueChange={setCampaignSearch}
                          />
                          <CommandList>
                            <CommandEmpty>No campaigns found.</CommandEmpty>
                            {showCreateCampaign && (
                              <CommandGroup>
                                <CommandItem
                                  value={`create-${trimmedCampaignSearch}`}
                                  onSelect={() => createCampaignFromSearch(trimmedCampaignSearch)}
                                >
                                  <Plus />
                                  Create &quot;{trimmedCampaignSearch}&quot;
                                </CommandItem>
                              </CommandGroup>
                            )}
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setField("campaignId", undefined)
                                  setCampaignPickerOpen(false)
                                }}
                              >
                                None
                              </CommandItem>
                              {allCampaigns.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.name}
                                  onSelect={() => {
                                    setField("campaignId", c.id)
                                    setCampaignPickerOpen(false)
                                  }}
                                >
                                  {c.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <div className="mx-4 my-1.5 border-t border-border/30" />

                    {/* Lead */}
                    <Popover open={leadPickerOpen} onOpenChange={setLeadPickerOpen}>
                      <PopoverTrigger render={<SidebarRowButton aria-label="Lead" />}>
                        <UserIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground/60">Lead</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                          {draft.leadUserId
                            ? (userNameById.get(draft.leadUserId) ?? draft.leadUserId)
                            : <span className="font-normal italic text-muted-foreground/40">Add</span>}
                        </span>
                        <ChevronDown aria-hidden className="size-3 shrink-0 self-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[208px] p-2" align="start" alignOffset={16} side="bottom" sideOffset={4}>
                        <Command>
                          <CommandInput placeholder="Search members..." />
                          <CommandList>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setField("leadUserId", undefined)
                                  setLeadPickerOpen(false)
                                }}
                              >
                                None
                              </CommandItem>
                              {users.map((u) => (
                                <CommandItem
                                  key={u.id}
                                  value={u.name}
                                  onSelect={() => {
                                    setField("leadUserId", u.id)
                                    setLeadPickerOpen(false)
                                  }}
                                >
                                  {u.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <div className="mx-4 my-1.5 border-t border-border/30" />

                    {/* Priority */}
                    <Popover open={priorityPickerOpen} onOpenChange={setPriorityPickerOpen}>
                      <PopoverTrigger render={<SidebarRowButton aria-label="Priority" />}>
                        <Flag aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground/60">Priority</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                          {draft.priority
                            ? <PriorityBadge priority={draft.priority} />
                            : <span className="font-normal italic text-muted-foreground/40">Add</span>}
                        </span>
                        <ChevronDown aria-hidden className="size-3 shrink-0 self-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[208px] p-1" align="start" alignOffset={16} side="bottom" sideOffset={4}>
                        <PriorityPicker
                          postId={post?.id ?? ""}
                          value={draft.priority}
                          onSave={(p) => {
                            setField("priority", p)
                            if (post?.id) flushField("priority", p)
                            setPriorityPickerOpen(false)
                          }}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Time estimate */}
                    <Popover open={timeEstimateOpen} onOpenChange={setTimeEstimateOpen}>
                      <PopoverTrigger render={<SidebarRowButton aria-label="Time estimate" />}>
                        <Clock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground/60">Estimate</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                          {draft.timeEstimateMinutes != null
                            ? formatTimeEstimate(draft.timeEstimateMinutes)
                            : <span className="font-normal italic text-muted-foreground/40">Add</span>}
                        </span>
                        <ChevronDown aria-hidden className="size-3 shrink-0 self-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[208px] p-3" align="start" alignOffset={16} side="bottom" sideOffset={4}>
                        <TimeEstimateInput
                          value={draft.timeEstimateMinutes}
                          onSave={(mins) => {
                            setField("timeEstimateMinutes", mins)
                            if (post?.id) flushField("timeEstimateMinutes", mins)
                          }}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Assignee */}
                    <Popover open={assigneePickerOpen} onOpenChange={setAssigneePickerOpen}>
                      <PopoverTrigger render={<SidebarRowButton aria-label="Assignee" />}>
                        <UsersIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                        <span className="w-[52px] shrink-0 text-[11px] text-muted-foreground/60">Assignee</span>
                        <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                          {draft.assigneeId
                            ? (userNameById.get(draft.assigneeId) ?? draft.assigneeId)
                            : <span className="font-normal italic text-muted-foreground/40">Add</span>}
                        </span>
                        <ChevronDown aria-hidden className="size-3 shrink-0 self-center text-muted-foreground/30 transition-colors group-hover:text-muted-foreground/60" />
                      </PopoverTrigger>
                      <PopoverContent className="w-[208px] p-2" align="start" alignOffset={16} side="bottom" sideOffset={4}>
                        <Command>
                          <CommandInput placeholder="Search members..." />
                          <CommandList>
                            <CommandEmpty>No members found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="none"
                                onSelect={() => {
                                  setField("assigneeId", undefined)
                                  setAssigneePickerOpen(false)
                                }}
                              >
                                None
                              </CommandItem>
                              {users.map((u) => (
                                <CommandItem
                                  key={u.id}
                                  value={u.name}
                                  onSelect={() => {
                                    setField("assigneeId", u.id)
                                    setAssigneePickerOpen(false)
                                  }}
                                >
                                  {u.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                  </aside>

                  {/* Center: segmented tabs + scrollable tab content */}
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="shrink-0 border-b px-4 pt-3 pb-0">
                      <SegmentedTabs
                        tabs={TABS}
                        value={activeTab}
                        onChange={setActiveTab}
                        scrollable
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto">

                      {/* Brief - description + notes + checklist; metadata is in the sidebar */}
                      {activeTab === "brief" && (
                        <div className="flex flex-col gap-4 px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <Label>Brief</Label>
                            </div>
                            <Textarea
                              rows={5}
                              value={draft.detailedBrief ?? ""}
                              onChange={(e) => setField("detailedBrief", e.target.value)}
                              placeholder="Write a brief for the post..."
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Notes</Label>
                            <Textarea
                              rows={4}
                              value={draft.notes ?? ""}
                              onChange={(e) => setField("notes", e.target.value)}
                              placeholder="Internal-only notes..."
                            />
                          </div>
                          {post?.id && (
                            <div className="flex flex-col gap-1.5">
                              <Label>Checklist</Label>
                              <ChecklistPanel postId={post.id} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Copy & Tags */}
                      {activeTab === "copy-tags" && (
                        <div className="flex flex-col gap-4 px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <Label>Caption</Label>
                            </div>
                            <Textarea
                              rows={6}
                              value={draft.blurb ?? ""}
                              onChange={(e) => setField("blurb", e.target.value)}
                              placeholder="Write the caption..."
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Hashtags</Label>
                            <HashtagInput
                              value={draft.hashtags ?? []}
                              onChange={(v) => setField("hashtags", v)}
                              suggestions={allHashtagSuggestions}
                              placeholder="#charity, #event"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Pages to tag</Label>
                            <Input
                              value={draft.pagesToTag ?? ""}
                              onChange={(e) => setField("pagesToTag", e.target.value)}
                              placeholder="@brand @partner"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Call to action</Label>
                            <Select
                              value={draft.ctaId ?? ""}
                              onValueChange={(v) => setField("ctaId", v || undefined)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pick CTA">
                                  {(v) => ctaLabelById.get(v) ?? v}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {ctas.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {/* Design */}
                      {activeTab === "design" && (
                        <div className="flex flex-col gap-4 px-5 py-4">
                          <div className="flex flex-col gap-1.5">
                            <Label>Post type</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {POST_TYPE_OPTIONS.map((t) => {
                                const selected = getPostTypes(draft).includes(t)
                                return (
                                  <Button
                                    key={t}
                                    type="button"
                                    size="sm"
                                    variant={selected ? "default" : "outline"}
                                    onClick={() => {
                                      const current = getPostTypes(draft)
                                      const next = selected
                                        ? current.length > 1 ? current.filter((x) => x !== t) : current
                                        : [...current, t]
                                      setDraft((prev) => ({ ...prev, ...withSyncedPostTypes(next) }))
                                    }}
                                    className="rounded-full"
                                    aria-pressed={selected}
                                  >
                                    {labelOr(POST_TYPE_LABELS, t)}
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Canva URL</Label>
                            <Input
                              value={draft.canvaUrl ?? ""}
                              onChange={(e) => setField("canvaUrl", e.target.value || undefined)}
                              onBlur={(e) => {
                                if (e.target.value) void fetchThumb(e.target.value)
                              }}
                              placeholder="https://www.canva.com/..."
                            />
                            {thumbnailLoading ? (
                              <p className="text-xs text-muted-foreground">Loading preview...</p>
                            ) : thumbnail ? (
                              <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={thumbnail} alt="Asset preview" className="h-full w-full object-cover" />
                              </div>
                            ) : draft.canvaUrl ? (
                              <p className="text-xs text-muted-foreground">No preview available.</p>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Links &amp; files</Label>
                            <DesignLinksInput
                              key={post?.id}
                              value={draft.designLinks ?? []}
                              onChange={(next) => setField("designLinks", next)}
                            />
                          </div>
                        </div>
                      )}

                      {/* Channels */}
                      {activeTab === "channels" && (
                        <div className="flex flex-col gap-3 px-5 py-4">
                          {composerChannels.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No channels selected. Configure channels in Settings.
                            </p>
                          ) : (
                            composerChannels.map((ch) => {
                              const current = draft.channelStatuses?.[ch.key]
                              const value =
                                typeof current === "string" ? current : current ? "scheduled" : "n/a"
                              return (
                                <div
                                  key={ch.key}
                                  className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0"
                                >
                                  <span className="text-sm">{ch.label}</span>
                                  <Select
                                    value={value}
                                    onValueChange={(v) => {
                                      const next = {
                                        ...(draft.channelStatuses ?? {}),
                                        [ch.key]: v as ChannelStatus,
                                      }
                                      setField("channelStatuses", next)
                                    }}
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue>
                                        {(v) => labelOr(CHANNEL_STATUS_LABELS, v)}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CHANNEL_STATUS_OPTIONS.map((s) => (
                                        <SelectItem key={s} value={s}>
                                          {CHANNEL_STATUS_LABELS[s]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}

                      {/* Preview */}
                      {activeTab === "preview" && (
                        <div className="px-5 py-4">
                          <NetworkPreview
                            post={{
                              brief: draft.brief,
                              blurb: draft.blurb,
                              firstComment: draft.firstComment,
                              isAiGenerated: draft.isAiGenerated,
                            }}
                            channels={orgChannels}
                          />
                        </div>
                      )}

                      {/* Related */}
                      {activeTab === "related" && post?.id && (
                        <RelatedPanel
                          postId={post.id}
                          campaignId={draft.campaignId}
                          campaignName={
                            allCampaigns.find((c) => c.id === draft.campaignId)?.name
                          }
                        />
                      )}

                    </div>
                  </div>

                  {/* Right: Activity panel - docked on lg+, hidden below */}
                  {post?.id && (
                    <div className="hidden lg:flex w-[300px] shrink-0 flex-col overflow-hidden border-l">
                      <ActivityPanel postId={post.id} />
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={pending || !post}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 aria-hidden className="size-4" />
                    Delete
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={requestClose} disabled={pending}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={save} disabled={pending || !post}>
                      Save
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Dirty guard */}
      <Dialog open={guardOpen} onOpenChange={setGuardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>You have unsaved changes. What would you like to do?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setGuardOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setGuardOpen(false); onOpenChange(false) }}
            >
              Discard changes
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setGuardOpen(false)
                startTransition(async () => { await persist(true) })
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete post?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => { setDeleteConfirmOpen(false); remove() }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as template */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Lifts the category, post type, hashtags, CTA, and caption into a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tpl-name">Template name</Label>
              <Input
                id="tpl-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Pick of the Week"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cadence</Label>
              <Select
                value={templateCadence}
                onValueChange={(v) => setTemplateCadence(v as TemplateCadence)}
              >
                <SelectTrigger>
                  <SelectValue>{(v) => labelOr(CADENCE_LABELS, v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{CADENCE_LABELS.weekly}</SelectItem>
                  <SelectItem value="biweekly">{CADENCE_LABELS.biweekly}</SelectItem>
                  <SelectItem value="monthly">{CADENCE_LABELS.monthly}</SelectItem>
                  <SelectItem value="quarterly">{CADENCE_LABELS.quarterly}</SelectItem>
                  <SelectItem value="ad-hoc">{CADENCE_LABELS["ad-hoc"]}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSaveAsTemplate} disabled={!templateName.trim() || pending}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {post?.id && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          postId={post.id}
          postTitle={draft.brief}
        />
      )}

      {post?.id && (
        <TemplatePicker
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          postId={post.id}
          onApplied={(tmpl) => {
            if (tmpl.blurbTemplate) setField("blurb", tmpl.blurbTemplate)
            if (tmpl.defaultHashtags?.length) setField("hashtags", tmpl.defaultHashtags)
          }}
        />
      )}

      <CategoryDialog
        open={newCategoryOpen}
        onOpenChange={setNewCategoryOpen}
        mode="create"
        nextDisplayOrder={categories.length}
        onCreated={(id) => {
          setField("categoryId", id)
          router.refresh()
        }}
      />
    </>
  )
}

function SidebarRowButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="group flex w-full items-start gap-2 px-4 py-2.5 text-left transition-all duration-100 hover:bg-muted/30 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      {...props}
    >
      {children}
    </button>
  )
}
