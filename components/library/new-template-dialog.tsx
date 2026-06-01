"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { HashtagInput } from "@/components/composer/hashtag-input"
import { createTemplate } from "@/lib/actions/templates"
import type { WithId } from "@/lib/firebase/serialize"
import {
  postType as postTypeEnum,
  templateCadence,
  type Category,
  type Cta,
  type PostType,
  type TemplateCadence,
} from "@/lib/schemas"

/*
 * Manual "New template" form. Server-side validation lives in
 * lib/actions/templates.ts (createTemplate's zod schema); the client form
 * uses react-hook-form without a zodResolver to side-step the Zod v4 +
 * resolver incompatibility documented in project memory.
 */

const POST_TYPES = postTypeEnum.options as readonly PostType[]
const CADENCES = templateCadence.options as readonly TemplateCadence[]

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  categoryId: z.string().min(1, "Category is required"),
  defaultPostType: postTypeEnum,
  blurbTemplate: z.string().max(8_000).optional(),
  defaultHashtags: z.array(z.string()).default([]),
  defaultCtaId: z.string().optional(),
  designTemplateCanvaUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  cadence: templateCadence,
})
type FormValues = z.infer<typeof formSchema>

const cadenceLabel: Record<TemplateCadence, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "ad-hoc": "Ad-hoc",
}

const postTypeLabel: Record<PostType, string> = {
  grid: "Grid",
  carousel: "Carousel",
  reel: "Reel",
  story: "Story",
  video: "Video",
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  categories: WithId<Category>[]
  ctas: WithId<Cta>[]
  hashtagSuggestions?: string[]
}

export function NewTemplateDialog({
  open,
  onOpenChange,
  categories,
  ctas,
  hashtagSuggestions = [],
}: Props) {
  const router = useRouter()
  const [submitting, startTransition] = useTransition()

  const defaults: FormValues = useMemo(
    () => ({
      name: "",
      categoryId: categories[0]?.id ?? "",
      defaultPostType: "grid",
      blurbTemplate: "",
      defaultHashtags: [],
      defaultCtaId: undefined,
      designTemplateCanvaUrl: "",
      cadence: "ad-hoc",
    }),
    [categories],
  )

  const form = useForm<FormValues>({ defaultValues: defaults })

  useEffect(() => {
    if (open) form.reset(defaults)
  }, [open, defaults, form])

  const watchedHashtags = form.watch("defaultHashtags")
  const watchedCategoryId = form.watch("categoryId")
  const watchedPostType = form.watch("defaultPostType")
  const watchedCadence = form.watch("cadence")
  const watchedCtaId = form.watch("defaultCtaId")

  const categoryHashtagSuggestions = useMemo(() => {
    const cat = categories.find((c) => c.id === watchedCategoryId)
    return Array.from(
      new Set([...(cat?.defaultHashtags ?? []), ...hashtagSuggestions]),
    )
  }, [categories, watchedCategoryId, hashtagSuggestions])

  const onSubmit = form.handleSubmit((values) => {
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      form.setError((issue?.path[0] as keyof FormValues) ?? "name", {
        message: issue?.message ?? "Invalid input",
      })
      return
    }

    const payload = {
      name: parsed.data.name.trim(),
      categoryId: parsed.data.categoryId,
      defaultPostType: parsed.data.defaultPostType,
      defaultHashtags: parsed.data.defaultHashtags,
      defaultCtaId: parsed.data.defaultCtaId || undefined,
      blurbTemplate: parsed.data.blurbTemplate?.trim() || undefined,
      designTemplateCanvaUrl: parsed.data.designTemplateCanvaUrl?.trim() || undefined,
      cadence: parsed.data.cadence,
    }

    startTransition(async () => {
      const res = await createTemplate(payload)
      if (!res.ok) {
        if (res.gate?.kind === "feature") {
          toast.error("Upgrade required", {
            description: res.error ?? "Templates are not available on this plan.",
          })
        } else {
          toast.error(res.error ?? "Could not create template")
          form.setError("name", { message: res.error ?? "Could not create template" })
        }
        return
      }
      toast.success(`Template "${payload.name}" saved to library`)
      onOpenChange(false)
      router.refresh()
    })
  })

  const hasCategories = categories.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>
            Reusable starting point for recurring posts. Use [PLACEHOLDER] tokens
            in the blurb for parts that change each time, like [TEAM_MEMBER] or [YEARS].
          </DialogDescription>
        </DialogHeader>

        {!hasCategories ? (
          <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            Create a category in settings before adding a template - every template
            belongs to one.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                autoFocus
                placeholder="Pick of the week"
                {...form.register("name", { required: true })}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-category">Category</Label>
                <Select
                  value={watchedCategoryId}
                  onValueChange={(v) => {
                    if (v == null) return
                    form.setValue("categoryId", v, { shouldDirty: true })
                  }}
                >
                  <SelectTrigger id="template-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-post-type">Post type</Label>
                <Select
                  value={watchedPostType}
                  onValueChange={(v) => {
                    if (v == null) return
                    form.setValue("defaultPostType", v as PostType, {
                      shouldDirty: true,
                    })
                  }}
                >
                  <SelectTrigger id="template-post-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {postTypeLabel[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="template-blurb">
                Blurb <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="template-blurb"
                rows={4}
                placeholder="Today we're celebrating [TEAM_MEMBER]'s [YEARS]-year anniversary at SAFE..."
                {...form.register("blurbTemplate")}
              />
              <p className="text-xs text-muted-foreground">
                Wrap variable parts in [BRACKETS] so the drafter knows what to fill in.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Default hashtags</Label>
              <HashtagInput
                value={watchedHashtags ?? []}
                onChange={(v) =>
                  form.setValue("defaultHashtags", v, { shouldDirty: true })
                }
                suggestions={categoryHashtagSuggestions}
                placeholder="Add a tag, press enter"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="template-cta">
                  Default CTA <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Select
                  value={watchedCtaId ?? "__none"}
                  onValueChange={(v) => {
                    if (v == null) return
                    form.setValue(
                      "defaultCtaId",
                      v === "__none" ? undefined : v,
                      { shouldDirty: true },
                    )
                  }}
                >
                  <SelectTrigger id="template-cta">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {ctas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="template-cadence">Cadence</Label>
                <Select
                  value={watchedCadence}
                  onValueChange={(v) => {
                    if (v == null) return
                    form.setValue("cadence", v as TemplateCadence, {
                      shouldDirty: true,
                    })
                  }}
                >
                  <SelectTrigger id="template-cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CADENCES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {cadenceLabel[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="template-canva">
                Canva design URL <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="template-canva"
                type="url"
                placeholder="https://www.canva.com/design/..."
                {...form.register("designTemplateCanvaUrl")}
              />
              {form.formState.errors.designTemplateCanvaUrl && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.designTemplateCanvaUrl.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save template"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
