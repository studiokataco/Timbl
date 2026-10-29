"use client"

import { useEffect, useId, useMemo, useTransition, type ReactNode } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { CategoryColorSwatches, DEFAULT_CATEGORY_COLOR } from "@/components/settings/categories-color-swatches"
import { createCategory, updateCategory } from "@/lib/actions/categories"
import { parseInto } from "@/lib/forms/zod-form"
import type { Category } from "@/lib/schemas"
import type { WithId } from "@/lib/firebase/serialize"

const schema = z.object({
  name: z.string().min(1, "Give the category a name").max(80, "Keep the name under 80 characters"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour"),
  description: z.string().max(280, "Keep the description under 280 characters").optional(),
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
  const uid = useId()
  const nameId = `${uid}-name`
  const descId = `${uid}-desc`

  const defaults: FormValues = useMemo(
    () =>
      mode === "edit" && category
        ? { name: category.name, color: category.color, description: category.description ?? "" }
        : { name: "", color: DEFAULT_CATEGORY_COLOR, description: "" },
    [mode, category],
  )

  const form = useForm<FormValues>({ defaultValues: defaults })
  const { errors } = form.formState
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch is intentional for live color preview
  const watchedColor = form.watch("color")

  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])

  const onSubmit = form.handleSubmit((values) => {
    const data = parseInto(schema, values, form.setError)
    if (!data) return

    const payload = {
      name: data.name,
      color: data.color,
      description: data.description || undefined,
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
      <DialogContent className="gap-0 sm:max-w-md">
        <DialogHead
          title={mode === "create" ? "New category" : "Edit category"}
          description="Categories colour posts on the calendar and power filters across every campaign."
        />

        <form onSubmit={onSubmit} noValidate>
          <div className="divide-y divide-border">
            <DialogField title="Name" htmlFor={nameId} error={errors.name?.message}>
              <Input
                id={nameId}
                autoFocus
                autoComplete="off"
                aria-invalid={errors.name ? true : undefined}
                placeholder="Event recap"
                {...form.register("name")}
              />
            </DialogField>

            <DialogField title="Colour" hint="Shown on calendar pills and filters." error={errors.color?.message}>
              <CategoryColorSwatches
                label="Category colour"
                value={watchedColor}
                onChange={(hex) => form.setValue("color", hex, { shouldDirty: true })}
              />
            </DialogField>

            <DialogField
              title="Description"
              hint="Optional. A line that tells the team what belongs here."
              htmlFor={descId}
              error={errors.description?.message}
            >
              <Textarea
                id={descId}
                rows={2}
                aria-invalid={errors.description ? true : undefined}
                {...form.register("description")}
              />
            </DialogField>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" className="h-9 sm:h-8" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-9 sm:h-8">
              {mode === "create" ? "Create category" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DialogHead({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <DialogHeader className="gap-1 pr-8">
      <DialogTitle className="text-[15px] font-semibold leading-snug">{title}</DialogTitle>
      {description ? (
        <DialogDescription className="text-[13px] leading-snug text-muted-foreground">{description}</DialogDescription>
      ) : null}
    </DialogHeader>
  )
}

export function DialogField({
  title,
  hint,
  htmlFor,
  error,
  children,
}: {
  title: string
  hint?: ReactNode
  htmlFor?: string
  error?: string
  children: ReactNode
}) {
  return (
    <section className="py-4">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-[14px] font-semibold text-foreground">
          {title}
        </label>
      ) : (
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      )}
      {hint ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{hint}</p> : null}
      <div className="mt-2.5">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}
