"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import {
  Calendar as CalendarIcon,
  ChevronsUpDown,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { NetworkPreview } from "./network-preview"
import { toast } from "sonner"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { LEGACY_POST_STATUSES } from "@/lib/schemas"
import {
  CADENCE_LABELS,
  CHANNEL_STATUS_LABELS,
  POST_TYPE_LABELS,
  labelOr,
} from "@/lib/labels/enums"
import { deletePost, updatePost } from "@/lib/actions/posts"
import { createCampaign } from "@/lib/actions/campaigns"
import { fetchOgImage } from "@/lib/actions/assets"
import { saveAsTemplate } from "@/lib/actions/templates"
import { getNextStatuses } from "@/lib/post-status"
import { getPostTypes, withSyncedPostTypes } from "@/lib/post-types"
import { channelsForComposer } from "@/lib/channels"
import { recordRecentPost } from "@/components/shared/command-palette"
import { HashtagInput } from "./hashtag-input"
import { DesignLinksInput } from "./design-links-input"
import { CategoryDialog } from "@/components/settings/category-dialog"

const POST_TYPE_OPTIONS: PostType[] = [
  "grid",
  "carousel",
  "reel",
  "story",
  "video",
]

const CHANNEL_STATUS_OPTIONS: ChannelStatus[] = [
  "n/a",
  "scheduled",
  "published",
  "failed",
]

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

/*
 * Side-sheet composer (full-screen drawer on mobile via Sheet's responsive
 * styling). Tabs: Brief (notes live here) / Copy & Tags / Design /
 * Channels / Preview.
 *
 * Save is explicit for now - Phase 3 swaps in autosave on blur/idle and
 * keeps the Save button as a fallback.
 */
export function PostComposerSheet({
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
  const [draft, setDraft] = useState<Partial<Post>>({})
  const [pending, startTransition] = useTransition()
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [campaignSearch, setCampaignSearch] = useState("")
  const [extraCampaigns, setExtraCampaigns] = useState<WithId<Campaign>[]>([])
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateCadence, setTemplateCadence] =
    useState<TemplateCadence>("ad-hoc")
  const [composerTab, setComposerTab] = useState("brief")
  const lastSavedRef = useRef<string>("")
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local draft when the parent swaps in a different post.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(post ?? {})
    lastSavedRef.current = JSON.stringify(post ?? {})
    setSaveState("idle")
    setThumbnail(null)
    setComposerTab("brief")
    if (post?.id) recordRecentPost(post.id)
  }, [post])

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

  const persist = async (closeOnSuccess: boolean, overrideDraft?: Partial<Post>) => {
    if (!post?.id) return
    const next = overrideDraft ?? draft
    const snapshot = JSON.stringify(next)
    if (snapshot === lastSavedRef.current) {
      if (closeOnSuccess) onOpenChange(false)
      return
    }
    setSaveState("saving")
    const res = await updatePost({ id: post.id, ...next })
    if (!res.ok) {
      setSaveState("error")
      toast.error(res.error ?? "Could not save")
      return
    }
    lastSavedRef.current = snapshot
    setSaveState("saved")
    /* Optimistically patch every cached posts query so calendar / kanban /
     * list reflect the edit instantly, without waiting on the refetch. */
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

  /* Discrete controls (status, category, assignee, date) save immediately
   * instead of waiting on the debounce - a single deliberate choice
   * shouldn't risk being lost if the sheet closes before 1.5s elapses. */
  const flushField = <K extends keyof Post>(key: K, value: Post[K] | undefined) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    startTransition(() => {
      void persist(false, next)
    })
  }

  // Keep a ref to the latest persist closure so the autosave timer always
  // captures up-to-date draft state without re-creating itself on every
  // keystroke.
  const persistRef = useRef(persist)
  useEffect(() => {
    persistRef.current = persist
  })

  // Autosave: 1.5s after the last edit, persist silently. Explicit Save
  // button still works as a fallback.
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

  const save = () => {
    startTransition(async () => {
      await persist(true)
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    const snapshot = JSON.stringify(draft)
    if (snapshot === lastSavedRef.current) {
      onOpenChange(false)
      return
    }
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    startTransition(async () => {
      await persist(false)
      if (lastSavedRef.current === snapshot) onOpenChange(false)
    })
  }

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
  const validStatuses = useMemo(
    () => getNextStatuses(currentStatus, columnIds),
    [currentStatus, columnIds],
  )
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="min-w-0 flex-1 text-base font-medium">
                {post
                  ? `Edit - ${format(date, "EEE d MMM")}${timeLabel ? `, ${timeLabel}` : ""}`
                  : "Edit "}
              </SheetTitle>
              <div className="shrink-0 flex items-center gap-3">
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  {saveState === "saving" ? (
                    <>
                      <Loader2 aria-hidden className="size-3 animate-spin" />
                      Saving…
                    </>
                  ) : saveState === "saved" ? (
                    <span className="text-[var(--color-success)]">
                      Saved
                    </span>
                  ) : saveState === "error" ? (
                    <span className="text-destructive">Save failed</span>
                  ) : null}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label="More post actions"
                      />
                    }
                  >
                    <MoreHorizontal aria-hidden className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={openSaveAsTemplate}
                      disabled={!post?.id}
                    >
                      Save as template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <SheetClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Close"
                    />
                  }
                >
                  <X aria-hidden className="size-4" />
                </SheetClose>
              </div>
            </div>
          </SheetHeader>

          <Tabs
            value={composerTab}
            onValueChange={setComposerTab}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="shrink-0 px-4 pt-4 sm:px-6">
              <SegmentedTabs
                tabs={[
                  { id: "brief", label: "Brief" },
                  { id: "copy", label: "Copy" },
                  { id: "design", label: "Design" },
                  { id: "channels", label: "Channels" },
                  { id: "preview", label: "Preview" },
                ]}
                value={composerTab}
                onChange={setComposerTab}
                scrollable
                className="w-full"
              />
            </div>

            {/* --- Brief --- */}
            <TabsContent
              value="brief"
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label>Title</Label>
                <Input
                  value={draft.brief ?? ""}
                  onChange={(e) => setField("brief", e.target.value)}
                  placeholder="Short title"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Date &amp; time</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="justify-start font-normal" />
                    }
                  >
                    <CalendarIcon aria-hidden className="size-4" />
                    {format(date, "EEE d MMM yyyy")}
                    {timeLabel ? `, ${timeLabel}` : ""}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        if (d) {
                          setField("scheduledDate", format(d, "yyyy-MM-dd"))
                        }
                      }}
                    />
                    <div className="flex flex-col gap-2 border-t border-border p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Time</Label>
                        {draft.scheduledTime ? (
                          <button
                            type="button"
                            onClick={() => setField("scheduledTime", undefined)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </button>
                        ) : null}
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
                              <SelectItem key={h} value={String(h)}>
                                {h}
                              </SelectItem>
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
                        <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
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
                                    ? "px-2.5 py-1.5 text-xs font-medium bg-foreground text-background"
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
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="justify-between font-normal" />
                    }
                  >
                    {selectedCategory ? (
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: selectedCategory.color }}
                        />
                        {selectedCategory.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">No category</span>
                    )}
                    <ChevronsUpDown aria-hidden className="size-4 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
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
                                className="size-2.5 rounded-full"
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
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Campaign</Label>
                <Popover
                  open={campaignPickerOpen}
                  onOpenChange={(open) => {
                    setCampaignPickerOpen(open)
                    if (!open) setCampaignSearch("")
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="justify-between font-normal" />
                    }
                  >
                    {selectedCampaign?.name ?? (
                      <span className="text-muted-foreground">No campaign</span>
                    )}
                    <ChevronsUpDown aria-hidden className="size-4 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                    <Command>
                      <CommandInput
                        placeholder="Search campaigns..."
                        value={campaignSearch}
                        onValueChange={setCampaignSearch}
                      />
                      <CommandList>
                        <CommandEmpty>No campaigns found.</CommandEmpty>
                        {showCreateCampaign ? (
                          <CommandGroup>
                            <CommandItem
                              value={`create-${trimmedCampaignSearch}`}
                              onSelect={() => createCampaignFromSearch(trimmedCampaignSearch)}
                            >
                              <Plus />
                              Create &quot;{trimmedCampaignSearch}&quot;
                            </CommandItem>
                          </CommandGroup>
                        ) : null}
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
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Lead</Label>
                  <Select
                    value={draft.leadUserId ?? ""}
                    onValueChange={(v) => setField("leadUserId", v || undefined)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick lead">
                        {(v) => userNameById.get(v) ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Assignee</Label>
                  <Select
                    value={draft.assigneeId ?? ""}
                    onValueChange={(v) => setField("assigneeId", v || undefined)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pick assignee">
                        {(v) => userNameById.get(v) ?? v}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Brief</Label>
                <Textarea
                  rows={4}
                  value={draft.detailedBrief ?? ""}
                  onChange={(e) => setField("detailedBrief", e.target.value)}
                  placeholder="Write a brief for the post..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={currentStatus}
                  onValueChange={(v) => flushField("status", v as PostStatus)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(v) => statusLabelById.get(v) ?? v}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {validStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabelById.get(s) ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
            </TabsContent>

            {/* --- Copy --- */}
            <TabsContent value="copy" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Caption</Label>
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
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              

              
            </TabsContent>

            {/* --- Design --- */}
            <TabsContent
              value="design"
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 flex flex-col gap-4"
            >
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
                            ? current.length > 1
                              ? current.filter((x) => x !== t)
                              : current
                            : [...current, t]
                          setDraft((prev) => ({
                            ...prev,
                            ...withSyncedPostTypes(next),
                          }))
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
                  <p className="text-xs text-muted-foreground">Loading preview…</p>
                ) : thumbnail ? (
                  <div className="rounded-md border border-border overflow-hidden bg-secondary aspect-video relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnail}
                      alt="Asset preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : draft.canvaUrl ? (
                  <p className="text-xs text-muted-foreground">
                    No preview available - open in Canva to view.
                  </p>
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
            </TabsContent>

            {/* --- Channels --- */}
            <TabsContent
              value="channels"
              className="px-6 py-5 flex flex-col gap-3"
            >
              {composerChannels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No channels selected yet. Pick channels in onboarding or Settings → Brand.
                </p>
              ) : (
                composerChannels.map((ch) => {
                const current = draft.channelStatuses?.[ch.key]
                const value =
                  typeof current === "string" ? current : current ? "scheduled" : "n/a"
                return (
                  <div
                    key={ch.key}
                    className="flex items-center justify-between gap-3 border-b border-border last:border-b-0 pb-2"
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
            </TabsContent>

            {/* --- Preview --- */}
            <TabsContent value="preview" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <NetworkPreview
                post={{
                  brief: draft.brief,
                  blurb: draft.blurb,
                  firstComment: draft.firstComment,
                  isAiGenerated: draft.isAiGenerated,
                }}
                channels={orgChannels}
              />
            </TabsContent>
          </Tabs>

          <div className="border-t border-border px-6 py-4 flex items-center justify-between gap-2 bg-background sticky bottom-0">
            <Button
              variant="ghost"
              onClick={remove}
              disabled={pending || !post}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 aria-hidden className="size-4" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={pending || !post}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Lifts the category, post type, hashtags, CTA, and caption into a
              reusable template.
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
                  <SelectValue>
                    {(v) => labelOr(CADENCE_LABELS, v)}
                  </SelectValue>
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
            <Button
              variant="ghost"
              onClick={() => setTemplateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSaveAsTemplate}
              disabled={!templateName.trim() || pending}
            >
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </Sheet>
  )
}
