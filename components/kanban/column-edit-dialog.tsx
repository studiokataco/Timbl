"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  createKanbanColumn,
  recolorKanbanColumn,
  renameKanbanColumn,
} from "@/lib/actions/kanban-columns"
import type { WithId } from "@/lib/firebase/serialize"
import type { KanbanColumn } from "@/lib/schemas"

const COLOR_SWATCHES = [
  "#94a3b8", // slate-400
  "#fbbf24", // amber-400
  "#fb923c", // orange-400
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#34d399", // emerald-400
  "#ef4444", // red-500
  "#64748b", // slate-500
  "#f59e0b", // amber-500
  "#a855f7", // purple-500
]

type Mode = "create" | "edit"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  /** Required when mode === "edit". */
  column?: WithId<KanbanColumn>
  onDone?: () => void
}

export function ColumnEditDialog({ open, onOpenChange, mode, column, onDone }: Props) {
  const [label, setLabel] = useState("")
  const [color, setColor] = useState(COLOR_SWATCHES[0])
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && column) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabel(column.label)
      setColor(column.color)
    } else {
      setLabel("")
      setColor(COLOR_SWATCHES[0])
    }
  }, [open, mode, column])

  const submit = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    startTransition(async () => {
      if (mode === "create") {
        const res = await createKanbanColumn({ label: trimmed, color })
        if (!res.ok) {
          toast.error(res.error ?? "Could not create column")
          return
        }
        toast.success(`Column “${trimmed}” added`)
      } else if (column) {
        const renameRes = await renameKanbanColumn({ id: column.id, label: trimmed })
        const recolorRes =
          color !== column.color
            ? await recolorKanbanColumn({ id: column.id, color })
            : { ok: true }
        if (!renameRes.ok || !recolorRes.ok) {
          toast.error(renameRes.error ?? recolorRes.error ?? "Could not save")
          return
        }
        toast.success("Column updated")
      }
      onOpenChange(false)
      onDone?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New column" : "Edit column"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Adds a new status to the board."
              : "Rename or recolor this column."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="col-label">Label</Label>
            <Input
              id="col-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="In review"
              maxLength={40}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                    color === c ? "ring-foreground" : "ring-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Pick ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!label.trim() || pending}>
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
