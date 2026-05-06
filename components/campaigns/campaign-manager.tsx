"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { createCampaign, updateCampaign, deleteCampaign } from "@/lib/actions/campaigns"
import type { WithId } from "@/lib/firebase/serialize"
import type { Campaign, CampaignStatus } from "@/lib/schemas"

type CampaignRow = WithId<Campaign> & { postCount: number; scheduledOrPosted: number }
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

export function CampaignManager({ campaigns }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CampaignRow | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

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
    if (form.color && !HEX_RE.test(form.color)) next.color = "Must be a hex color like #fb923c"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    startTransition(async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        status: form.status,
      }
      const res = editing
        ? await updateCampaign({ id: editing.id, ...payload })
        : await createCampaign(payload)
      if (!res.ok) {
        toast.error(res.error ?? "Could not save campaign")
        return
      }
      toast.success(editing ? "Campaign updated." : "Campaign created.")
      setDialogOpen(false)
      router.refresh()
    })
  }

  const onDelete = (c: CampaignRow) => {
    if (!confirm(`Delete "${c.name}"? This won't remove linked posts.`)) return
    startTransition(async () => {
      const res = await deleteCampaign(c.id)
      if (!res.ok) toast.error(res.error ?? "Could not delete")
      else {
        toast.success("Campaign deleted.")
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden className="size-4" />
          New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          body="Click New campaign above to bundle posts into a themed series with a shared timeline."
        />
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-2.5 text-left font-medium">Name</th>
                <th className="p-2.5 text-left font-medium">Dates</th>
                <th className="p-2.5 text-left font-medium">Posts</th>
                <th className="p-2.5 text-left font-medium">Status</th>
                <th className="p-2.5" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr
                  key={c.id}
                  className={i > 0 ? "border-t border-border hover:bg-secondary/20" : "hover:bg-secondary/20"}
                >
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      {c.color && (
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                      )}
                      <span className="font-medium">{c.name}</span>
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                        {c.description}
                      </p>
                    )}
                  </td>
                  <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {c.startDate ? format(parseISO(c.startDate), "d MMM yyyy") : "—"}
                    {" → "}
                    {c.endDate ? format(parseISO(c.endDate), "d MMM yyyy") : "—"}
                  </td>
                  <td className="p-2.5 text-xs">{c.postCount}</td>
                  <td className="p-2.5">
                    <Badge variant="secondary" className="capitalize font-normal text-xs">
                      {c.status}
                    </Badge>
                  </td>
                  <td className="p-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
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
                        borderColor: form.color === col ? "var(--color-foreground)" : "transparent",
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
              {errors.color && <p className="text-xs text-destructive">{errors.color}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
