"use client"

import { useEffect, useMemo, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createCategory, updateCategory } from "@/lib/actions/categories"
import type { Category } from "@/lib/schemas"
import type { WithId } from "@/lib/firebase/serialize"

const PALETTE: { id: string; hex: string; label: string }[] = [
  { id: "orange", hex: "#fb923c", label: "Coral" },
  { id: "pink", hex: "#ec4899", label: "Pink" },
  { id: "violet", hex: "#8b5cf6", label: "Violet" },
  { id: "emerald", hex: "#34d399", label: "Emerald" },
  { id: "forest", hex: "#10b981", label: "Forest" },
  { id: "yellow", hex: "#f59e0b", label: "Yellow" },
  { id: "peach", hex: "#fbcfe8", label: "Peach" },
  { id: "cream", hex: "#fde68a", label: "Cream" },
]

const schema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().max(280).optional(),
})
type FormValues = z.infer<typeof schema>

export type CategoryDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  category?: WithId<Category>
  onOptimisticUpsert?: (cat: WithId<Category>) => void
  onCreated?: (id: string) => void
  nextDisplayOrder?: number
}

export function CategoryDialog({
  open,
  onOpenChange,
  mode,
  category,
  onOptimisticUpsert,
  onCreated,
  nextDisplayOrder,
}: CategoryDialogProps) {
  const [, startTransition] = useTransition()

  const defaults: FormValues = useMemo(
    () =>
      mode === "edit" && category
        ? {
            name: category.name,
            color: category.color,
            description: category.description ?? "",
          }
        : {
            name: "",
            color: PALETTE[0].hex,
            description: "",
          },
    [mode, category],
  )

  const form = useForm<FormValues>({ defaultValues: defaults })
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch is intentional for live color preview
  const watchedColor = form.watch("color")

  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])

  const onSubmit = form.handleSubmit((values) => {
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      form.setError((issue?.path[0] as keyof FormValues) ?? "name", {
        message: issue?.message ?? "Invalid input",
      })
      return
    }

    const payload = {
      name: parsed.data.name,
      color: parsed.data.color,
      description: parsed.data.description || undefined,
    }

    if (onOptimisticUpsert) {
      const now = new Date().toISOString()
      if (mode === "create") {
        onOptimisticUpsert({
          id: `temp-${now}`,
          organizationId: "",
          name: payload.name,
          slug: payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60),
          color: payload.color,
          description: payload.description,
          defaultPostType: "grid",
          defaultHashtags: [],
          isActive: true,
          displayOrder: nextDisplayOrder ?? 0,
          system: false,
          createdAt: now,
          updatedAt: now,
        } as WithId<Category>)
      } else if (category) {
        onOptimisticUpsert({ ...category, ...payload, updatedAt: now })
      }
    }
    onOpenChange(false)
    toast.success(mode === "create" ? "Category created" : "Category updated")

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createCategory(payload)
          : await updateCategory({ id: category!.id, ...payload })

      if (!result.ok) {
        toast.dismiss()
        toast.error(result.error ?? "Could not save category")
        return
      }
      if (mode === "create" && "id" in result && result.id) {
        onCreated?.(result.id)
      }
    })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New category" : "Edit category"}
          </DialogTitle>
          <DialogDescription>
            Name your content pillars once. They color the calendar and filters
            across every campaign.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              autoFocus
              {...form.register("name", { required: true })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {PALETTE.map((swatch) => {
                const selected =
                  watchedColor.toLowerCase() === swatch.hex.toLowerCase()
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={swatch.label}
                    onClick={() =>
                      form.setValue("color", swatch.hex, { shouldDirty: true })
                    }
                    className={cn(
                      "size-8 rounded-full ring-offset-2 ring-offset-background transition",
                      selected
                        ? "ring-2 ring-foreground"
                        : "ring-1 ring-border hover:ring-foreground/40",
                    )}
                    style={{ backgroundColor: swatch.hex }}
                  />
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description (optional)</Label>
            <Textarea
              id="cat-desc"
              rows={2}
              {...form.register("description")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {mode === "create" ? "Create category" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
