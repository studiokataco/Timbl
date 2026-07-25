"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBrand } from "@/lib/actions/brands"

export function AddBrandDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (brandId: string) => void
}) {
  const [name, setName] = useState("")
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    startTransition(async () => {
      const res = await createBrand({ name: trimmed })
      if (!res.ok || !res.id) {
        toast.error(res.error ?? "Could not create brand")
        return
      }
      toast.success(`Brand "${trimmed}" created`)
      setName("")
      onOpenChange(false)
      onCreated(res.id)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setName("")
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a brand</DialogTitle>
          <DialogDescription>
            Each brand keeps its own voice, channels, posts and agent memory. You
            can switch between them any time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northwind Coffee"
              maxLength={120}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating..." : "Create brand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
