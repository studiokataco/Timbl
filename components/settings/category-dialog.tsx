"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
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

/*
 * Create/edit category dialog. Two modes:
 *   - mode="create": empty form, posts createCategory
 *   - mode="edit": prefilled from `category`, posts updateCategory
 *
 * Color picker is intentionally swatch-only (no free hex input) so every
 * category stays inside the DESIGN.md signature palette. If a future
 * design pass wants more colors, add the token here and to globals.css —
 * never let users paste an arbitrary hex.
 *
 * Slug is auto-derived from name on create; locked on edit (changing a
 * slug breaks any external integration referencing it by slug).
 */

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

const POST_TYPES = ["grid", "carousel", "reel", "story", "video"] as const

const schema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, digits, and hyphens only"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().max(60).optional(),
  description: z.string().max(280).optional(),
  defaultPostType: z.enum(POST_TYPES),
})
type FormValues = z.infer<typeof schema>

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export type CategoryDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  category?: WithId<Category>
}

export function CategoryDialog({
  open,
  onOpenChange,
  mode,
  category,
}: CategoryDialogProps) {
  const [pending, startTransition] = useTransition()
  const [slugTouched, setSlugTouched] = useState(false)

  const defaults: FormValues = useMemo(
    () =>
      mode === "edit" && category
        ? {
            name: category.name,
            slug: category.slug,
            color: category.color,
            icon: category.icon ?? "",
            description: category.description ?? "",
            defaultPostType: (category.defaultPostType ?? "grid") as (typeof POST_TYPES)[number],
          }
        : {
            name: "",
            slug: "",
            color: PALETTE[0].hex,
            icon: "",
            description: "",
            defaultPostType: "grid" as const,
          },
    [mode, category],
  )

  const form = useForm<FormValues>({ defaultValues: defaults })
  const watchedColor = form.watch("color")

  useEffect(() => {
    if (open) {
      form.reset(defaults)
      setSlugTouched(mode === "edit")
    }
  }, [open, defaults, form, mode])

  /* Auto-derive slug from name until the user types into the slug field. */
  useEffect(() => {
    if (mode !== "create" || slugTouched) return
    const sub = form.watch((values, info) => {
      if (info.name === "name") {
        form.setValue("slug", slugify(values.name ?? ""), { shouldDirty: true })
      }
    })
    return () => sub.unsubscribe()
  }, [form, mode, slugTouched])

  const onSubmit = form.handleSubmit((values) => {
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      form.setError((issue?.path[0] as keyof FormValues) ?? "name", {
        message: issue?.message ?? "Invalid input",
      })
      return
    }

    startTransition(async () => {
      const payload = {
        ...parsed.data,
        icon: parsed.data.icon || undefined,
        description: parsed.data.description || undefined,
      }
      const result =
        mode === "create"
          ? await createCategory(payload)
          : await updateCategory({ id: category!.id, ...payload })

      if (!result.ok) {
        if (result.gate?.kind === "feature") {
          toast.error("Upgrade required", {
            description:
              "Custom categories are on Studio and Agency plans. Upgrade to add more.",
          })
        } else {
          toast.error(result.error ?? "Could not save category")
        }
        return
      }
      toast.success(mode === "create" ? "Category created" : "Category updated")
      onOpenChange(false)
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
            Categories control color, default post type, and hashtags for posts
            in this stream.
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
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              disabled={mode === "edit"}
              {...form.register("slug", {
                onChange: () => setSlugTouched(true),
              })}
            />
            <p className="text-xs text-muted-foreground">
              {mode === "edit"
                ? "Slugs can't be changed after creation."
                : "Used in URLs and integrations. Auto-derived from the name."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {PALETTE.map((swatch) => {
                const selected = watchedColor.toLowerCase() === swatch.hex.toLowerCase()
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-icon">Icon</Label>
              <Input
                id="cat-icon"
                placeholder="shopping-bag"
                {...form.register("icon")}
              />
              <p className="text-xs text-muted-foreground">lucide-react name.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-type">Default post type</Label>
              <select
                id="cat-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                {...form.register("defaultPostType")}
              >
                {POST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
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
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Create category" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
