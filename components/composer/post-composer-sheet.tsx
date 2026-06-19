"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
 * styling). Five tabs match the PRD shape: Brief / Copy & Tags / Design /
 * Channels / Notes.
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

  const persist = async (closeOnSuccess: boolean) => {
    if (!post?.id) return
    const snapshot = JSON.stringify(draft)
    if (snapshot === lastSavedRef.current) {
      if (closeOnSuccess) onOpenChange(false)
      return
    }
    setSaveState("saving")
    const res = await updatePost({ id: post.id, ...draft })
    if (!res.ok) {
      setSaveState("error")
      toast.error(res.error ?? "Could not save")
      return
    }
    lastSavedRef.current = snapshot
    setSaveState("saved")
    onChanged?.()
    if (closeOnSuccess) onOpenChange(false)
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="min-w-0 flex-1 text-base font-medium">
                {post
                  ? `Edit post - ${format(date, "EEE d MMM")}`
                  : "Edit post"}
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
            <SheetDescription className="text-xs">
              Edits autosave 1.5s after your last change. Save button forces
              an immediate write and closes.
            </SheetDescription>
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
                  { id: "notes", label: "Notes" },
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
                <Label>Date</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="justify-start font-normal" />
                    }
                  >
                    <CalendarIcon aria-hidden className="size-4" />
                    {format(date, "EEE d MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        if (d) {
                          setField("scheduledDate", format(d, "yyyy-MM-dd"))
                          setDatePickerOpen(false)
                        }
                      }}
                    />
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

              <div className="grid grid-cols-2 gap-3">
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
                <Label>Detailed brief</Label>
                <Textarea
                  rows={4}
                  value={draft.detailedBrief ?? ""}
                  onChange={(e) => setField("detailedBrief", e.target.value)}
                  placeholder="Tone, references, must-haves..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={currentStatus}
                  onValueChange={(v) => setField("status", v as PostStatus)}
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
                <p className="text-xs text-muted-foreground">
                  Move the post to any column.
                </p>
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

              <div className="flex flex-col gap-1.5">
                <Label>First comment</Label>
                <Textarea
                  rows={3}
                  maxLength={2200}
                  value={draft.firstComment ?? ""}
                  onChange={(e) => setField("firstComment", e.target.value || undefined)}
                  placeholder="Add a first comment that posts immediately after (LinkedIn, Instagram, Facebook)..."
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="ai-assisted-toggle">AI-assisted</Label>
                <Switch
                  id="ai-assisted-toggle"
                  checked={draft.isAiGenerated ?? false}
                  onCheckedChange={(v) => setField("isAiGenerated", v || undefined)}
                />
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
                <p className="text-xs text-muted-foreground">
                  Add Canva, Google Drive, Dropbox or OneDrive links - paste a
                  share link for each file.
                </p>
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

            {/* --- Notes --- */}
            <TabsContent value="notes" className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea
                rows={8}
                value={draft.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Internal-only notes..."
              />
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
                onClick={() => onOpenChange(false)}
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
