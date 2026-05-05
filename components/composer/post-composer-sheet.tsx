"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { format, parseISO } from "date-fns"
import { Calendar as CalendarIcon, ChevronsUpDown, Trash2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
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

const STATUS_OPTIONS: PostStatus[] = [
  "idea",
  "brief",
  "researching",
  "designing",
  "review",
  "scheduled",
  "posted",
  "missed",
  "archived",
]

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
  onChanged?: () => void
}

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
  onChanged,
}: Props) {
  const [draft, setDraft] = useState<Partial<Post>>({})
  const [pending, startTransition] = useTransition()
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false)
  const [hashtagInput, setHashtagInput] = useState("")

  // Sync local draft when the parent swaps in a different post. Acceptable
  // prop→state sync; ESLint's blanket rule is overcautious here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(post ?? {})
    setHashtagInput("")
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

  const save = () => {
    if (!post?.id) return
    startTransition(async () => {
      const res = await updatePost({ id: post.id, ...draft })
      if (!res.ok) {
        toast.error(res.error ?? "Could not save")
        return
      }
      toast.success("Saved")
      onChanged?.()
      onOpenChange(false)
    })
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

  const addHashtag = () => {
    const raw = hashtagInput.trim().replace(/^#?/, "#")
    if (raw.length <= 1) return
    const next = Array.from(new Set([...(draft.hashtags ?? []), raw]))
    setField("hashtags", next)
    setHashtagInput("")
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="px-6 py-5 border-b border-border">
            <SheetTitle className="text-base font-medium">
              {post
                ? `Edit post — ${format(date, "EEE d MMM")}`
                : "Edit post"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Updates save when you press Save. Auto-save lands in the next
              polish pass.
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
                  value={draft.status ?? "idea"}
                  onValueChange={(v) => setField("status", v as PostStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 min-h-10">
                  {(draft.hashtags ?? []).map((h) => (
                    <Badge
                      key={h}
                      variant="secondary"
                      className="rounded-full pl-2 pr-1.5 gap-1 font-normal"
                    >
                      {h}
                      <button
                        type="button"
                        onClick={() =>
                          setField(
                            "hashtags",
                            (draft.hashtags ?? []).filter((x) => x !== h),
                          )
                        }
                        className="opacity-60 hover:opacity-100"
                        aria-label={`Remove ${h}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  <input
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault()
                        addHashtag()
                      } else if (
                        e.key === "Backspace" &&
                        !hashtagInput &&
                        (draft.hashtags ?? []).length > 0
                      ) {
                        const next = (draft.hashtags ?? []).slice(0, -1)
                        setField("hashtags", next)
                      }
                    }}
                    placeholder={
                      (draft.hashtags ?? []).length === 0
                        ? "#charity, #event"
                        : ""
                    }
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
                  />
                </div>
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
                  placeholder="https://www.canva.com/..."
                />
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
