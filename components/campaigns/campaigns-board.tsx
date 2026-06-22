"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CAMPAIGN_STATUS_LABELS, labelOr } from "@/lib/labels/enums"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "@/lib/actions/campaigns"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign, CampaignStatus } from "@/lib/schemas"

/*
 * Single campaigns surface - the browse grid AND create/edit/delete in one
 * page. Replaces the old split where /campaigns was read-only and bounced
 * every action to a near-duplicate /settings/campaigns manager. The card
 * grid is the browse view; the New-campaign / per-card edit buttons open
 * the same dialog the settings manager used.
 */

type CampaignRow = WithId<Campaign> & {
  postCount: number
  scheduledOrPosted: number
}
type Props = { campaigns: CampaignRow[] }

type FormState = {
  name: string
  description: string
  color: string
  startDate: string
  endDate: string
  status: CampaignStatus
}

const BLANK: FormState = {
  name: "",
  description: "",
  color: "",
  startDate: "",
  endDate: "",
  status: "active",
}

const PRESET_COLORS = ["#fb923c", "#ec4899", "#8b5cf6", "#34d399", "#f59e0b", "#3b82f6"]
const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function CampaignsBoard({ campaigns }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CampaignRow | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  /* Optimistic grid - create/edit/delete update this instantly. */
  const [items, setItems] = useState(campaigns)
  const inflightRef = useRef(0)
  useEffect(() => {
    if (inflightRef.current === 0) setItems(campaigns)
  }, [campaigns])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const openCreate = () => {
    setEditing(null)
    setForm(BLANK)
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = (c: CampaignRow) => {
    setEditing(c)
    setForm({
      name: c.name,
      description: c.description ?? "",
      color: c.color ?? "",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      status: c.status,
    })
    setErrors({})
    setDialogOpen(true)
  }

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!form.name.trim()) next.name = "Name is required"
    if (form.color && !HEX_RE.test(form.color))
      next.color = "Must be a hex color like #fb923c"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color.trim() || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      status: form.status,
    }
    const prev = items
    const wasEditing = editing
    const now = new Date().toISOString()
    if (wasEditing) {
      setItems((curr) =>
        curr.map((c) => (c.id === wasEditing.id ? { ...c, ...payload } : c)),
      )
    } else {
      setItems((curr) => [
        ...curr,
        {
          id: `temp-${now}`,
          organizationId: "",
          name: payload.name,
          description: payload.description,
          color: payload.color,
          startDate: payload.startDate,
          endDate: payload.endDate,
          status: payload.status,
          slug: `temp-${now}`,
          createdAt: now,
          updatedAt: now,
          postCount: 0,
          scheduledOrPosted: 0,
        } as CampaignRow,
      ])
    }
    setDialogOpen(false)
    toast.success(wasEditing ? "Campaign updated." : "Campaign created.")
    inflightRef.current++
    startTransition(async () => {
      const res = wasEditing
        ? await updateCampaign({ id: wasEditing.id, ...payload })
        : await createCampaign(payload)
      inflightRef.current--
      if (!res.ok) {
        setItems(prev)
        toast.dismiss()
        toast.error(res.error ?? "Could not save campaign")
        return
      }
      router.refresh()
    })
  }

  const onDelete = (c: CampaignRow) => {
    if (!confirm(`Delete "${c.name}"? This won't remove linked posts.`)) return
    const prev = items
    setItems((curr) => curr.filter((x) => x.id !== c.id))
    toast.success("Campaign deleted.")
    inflightRef.current++
    startTransition(async () => {
      const res = await deleteCampaign(c.id)
      inflightRef.current--
      if (!res.ok) {
        setItems(prev)
        toast.dismiss()
        toast.error(res.error ?? "Could not delete")
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Content series with a shared theme, timeline, and goal."
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus aria-hidden className="size-4" />
            New campaign
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          body="Group related posts into a series with a shared timeline, theme, and progress bar"
          action={
            <Button size="sm" onClick={openCreate}>
              Create your first campaign
            </Button>
          }
          size="lg"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
          {items.map((c) => {
            const pct =
              c.postCount > 0
                ? Math.round((c.scheduledOrPosted / c.postCount) * 100)
                : 0
            const href = `/campaigns/${c.slug ?? c.id}`
            return (
              <div
                key={c.id}
                className="group rounded-lg border border-border bg-background p-6 hover:shadow-sm transition-shadow flex flex-col h-full"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span
                    className="mt-0.5 size-3 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        c.color ?? "var(--color-muted-foreground)",
                    }}
                    aria-hidden
                  />
                  <Link href={href} className="flex-1 min-w-0">
                    <h2 className="font-medium leading-snug">{c.name}</h2>
                  </Link>
                  {/* Edit / delete - kept outside the Link so the card is
                      valid HTML (no button nested in an anchor). */}
                  <div className="flex items-center gap-0.5 -mt-1 -mr-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(c)}
                      aria-label={`Edit ${c.name}`}
                    >
                      <Pencil aria-hidden className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(c)}
                      aria-label={`Delete ${c.name}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <Link href={href} className="flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em] mb-3">
                    {c.description ?? ""}
                  </p>
                  <div className="mt-auto space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.startDate && (
                        <span>
                          {format(parseISO(c.startDate), "d MMM yyyy")}
                        </span>
                      )}
                      {c.startDate && c.endDate && <span>→</span>}
                      {c.endDate && (
                        <span>{format(parseISO(c.endDate), "d MMM yyyy")}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {c.postCount} posts
                        </span>
                        <span className="text-muted-foreground">
                          {pct}% ready
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              c.color ?? "var(--color-foreground)",
                          }}
                        />
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {labelOr(CAMPAIGN_STATUS_LABELS, c.status)}
                    </Badge>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="20th Anniversary Ball"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-description">Description</Label>
              <Textarea
                id="c-description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="What's this campaign about?"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      className="size-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: col,
                        borderColor:
                          form.color === col
                            ? "var(--color-foreground)"
                            : "transparent",
                      }}
                      onClick={() => setField("color", col)}
                      aria-label={col}
                    />
                  ))}
                </div>
                <Input
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  placeholder="#fb923c"
                  className="w-28 font-mono text-xs"
                />
              </div>
              {errors.color && (
                <p className="text-xs text-destructive">{errors.color}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-start">Start date</Label>
                <Input
                  id="c-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-end">End date</Label>
                <Input
                  id="c-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setField("status", v as CampaignStatus)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v) => labelOr(CAMPAIGN_STATUS_LABELS, v)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editing ? "Save changes" : "Create campaign"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
