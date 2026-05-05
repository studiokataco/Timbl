"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { format, parseISO } from "date-fns"
import { Calendar as CalendarIcon, ChevronsUpDown, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import type { WithId } from "@/lib/firebase/serialize"
import type {
  Campaign,
  Category,
  ChannelStatus,
  Cta,
  Post,
  PostStatus,
  PostType,
  User,
} from "@/lib/schemas"
import { deletePost, updatePost } from "@/lib/actions/posts"
import { fetchOgImage } from "@/lib/actions/assets"
import { getNextStatuses } from "@/lib/post-status"
import { HashtagInput } from "./hashtag-input"

const POST_TYPE_OPTIONS: PostType[] = [
  "grid",
  "carousel",
  "reel",
  "story",
  "video",
]

const CHANNELS: { key: string; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website", label: "Website" },
  { key: "fb_groups", label: "FB Groups" },
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
  hashtagSuggestions?: string[]
  onChanged?: () => void
}

type SaveState = "idle" | "saving" | "saved" | "error"

/*
 * Side-sheet composer (full-screen drawer on mobile via Sheet's responsive
 * styling). Five tabs match the PRD shape: Brief / Copy & Tags / Design /
 * Channels / Notes.
 *
 * Save is explicit for now — Phase 3 swaps in autosave on blur/idle and
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
  hashtagSuggestions = [],
  onChanged,
}: Props) {
  const [draft, setDraft] = useState<Partial<Post>>({})
  const [pending, startTransition] = useTransition()
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [thumbnailLoading, setThumbnailLoading] = useState(false)
  const lastSavedRef = useRef<string>("")
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local draft when the parent swaps in a different post.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(post ?? {})
    lastSavedRef.current = JSON.stringify(post ?? {})
    setSaveState("idle")
    setThumbnail(null)
  }, [post])

  const setField = <K extends keyof Post>(key: K, value: Post[K] | undefined) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === draft.categoryId) ?? null,
    [categories, draft.categoryId],
  )
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === draft.campaignId) ?? null,
    [campaigns, draft.campaignId],
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

  const currentStatus = (draft.status ?? "idea") as PostStatus
  const validStatuses = useMemo(() => getNextStatuses(currentStatus), [currentStatus])
  const allHashtagSuggestions = useMemo(() => {
    const cat = categories.find((c) => c.id === draft.categoryId)
    return Array.from(new Set([...(cat?.defaultHashtags ?? []), ...hashtagSuggestions]))
  }, [draft.categoryId, categories, hashtagSuggestions])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle className="text-base font-medium">
                {post
                  ? `Edit post — ${format(date, "EEE d MMM")}`
                  : "Edit post"}
              </SheetTitle>
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                {saveState === "saving" ? (
                  <>
                    <Loader2 aria-hidden className="size-3 animate-spin" />
                    Saving…
                  </>
                ) : saveState === "saved" ? (
                  <span className="text-[var(--color-signature-forest)]">Saved</span>
                ) : saveState === "error" ? (
                  <span className="text-destructive">Save failed</span>
                ) : null}
              </span>
            </div>
            <SheetDescription className="text-xs">
              Edits autosave 1.5s after your last change. Save button forces
              an immediate write and closes.
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="brief" className="flex-1 overflow-y-auto">
            <TabsList className="mx-6 mt-4 grid grid-cols-5 w-[calc(100%-3rem)]">
              <TabsTrigger value="brief">Brief</TabsTrigger>
              <TabsTrigger value="copy">Copy</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="channels">Channels</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* --- Brief --- */}
            <TabsContent
              value="brief"
              className="px-6 py-5 flex flex-col gap-4"
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
                  <PopoverContent className="p-0" align="start">
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
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Campaign</Label>
                <Popover open={campaignPickerOpen} onOpenChange={setCampaignPickerOpen}>
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
                      <CommandInput placeholder="Search campaigns..." />
                      <CommandList>
                        <CommandEmpty>No campaign.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value=""
                            onSelect={() => {
                              setField("campaignId", undefined)
                              setCampaignPickerOpen(false)
                            }}
                          >
                            None
                          </CommandItem>
                          {campaigns.map((c) => (
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
                    <SelectTrigger>
                      <SelectValue placeholder="Pick lead" />
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
                    <SelectTrigger>
                      <SelectValue placeholder="Pick assignee" />
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Showing valid next states only.
                </p>
              </div>
            </TabsContent>

            {/* --- Copy --- */}
            <TabsContent value="copy" className="px-6 py-5 flex flex-col gap-4">
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
                  placeholder="@safefoundation @ethicalboutique"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Call to action</Label>
                <Select
                  value={draft.ctaId ?? ""}
                  onValueChange={(v) => setField("ctaId", v || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick CTA" />
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
              className="px-6 py-5 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label>Post type</Label>
                <div role="radiogroup" className="flex flex-wrap gap-1.5">
                  {POST_TYPE_OPTIONS.map((t) => {
                    const active = (draft.postType ?? "grid") === t
                    return (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() => setField("postType", t)}
                        className="capitalize rounded-full"
                        aria-pressed={active}
                      >
                        {t}
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
                    No preview available — open in Canva to view.
                  </p>
                ) : null}
              </div>
            </TabsContent>

            {/* --- Channels --- */}
            <TabsContent
              value="channels"
              className="px-6 py-5 flex flex-col gap-3"
            >
              {CHANNELS.map((ch) => {
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
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNEL_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </TabsContent>

            {/* --- Notes --- */}
            <TabsContent value="notes" className="px-6 py-5 flex flex-col gap-2">
              <Label>Notes</Label>
              <Textarea
                rows={8}
                value={draft.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Internal-only notes..."
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
    </Sheet>
  )
}
