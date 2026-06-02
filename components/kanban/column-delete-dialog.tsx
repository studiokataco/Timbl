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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { deleteKanbanColumn } from "@/lib/actions/kanban-columns"
import type { WithId } from "@/lib/firebase/serialize"
import type { KanbanColumn } from "@/lib/schemas"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  column: WithId<KanbanColumn> | null
  allColumns: WithId<KanbanColumn>[]
  postCount: number
  onDone?: () => void
}

export function ColumnDeleteDialog({
  open,
  onOpenChange,
  column,
  allColumns,
  postCount,
  onDone,
}: Props) {
  const [moveTo, setMoveTo] = useState("")
  const [pending, startTransition] = useTransition()

  const candidates = allColumns.filter((c) => c.id !== column?.id)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMoveTo(candidates[0]?.id ?? "")
  }, [open, column?.id, candidates])

  const submit = () => {
    if (!column || !moveTo) return
    startTransition(async () => {
      const res = await deleteKanbanColumn({ id: column.id, moveTo })
      if (!res.ok) {
        toast.error(res.error ?? "Could not delete column")
        return
      }
      const moved = postCount
      toast.success(
        moved > 0
          ? `Column deleted; moved ${moved} ${moved === 1 ? "post" : "posts"}`
          : "Column deleted",
      )
      onOpenChange(false)
      onDone?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete column</DialogTitle>
          <DialogDescription>
            {postCount > 0
              ? `Moves ${postCount} ${postCount === 1 ? "post" : "posts"} to another column, then deletes “${column?.label}”.`
              : `Deletes “${column?.label}”.`}
          </DialogDescription>
        </DialogHeader>
        {postCount > 0 && (
          <div className="flex flex-col gap-1.5 py-2">
            <Label>Move posts to</Label>
            <Select value={moveTo} onValueChange={(v) => setMoveTo(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick column">
                  {(v) => candidates.find((c) => c.id === v)?.label ?? v}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={(postCount > 0 && !moveTo) || pending || !column}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
