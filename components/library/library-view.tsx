"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  BookOpen,
  Calendar as CalendarIcon,
  Image as ImageIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Stagger, StaggerItem } from "@/components/shared/motion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTemplate as promoteTemplate } from "@/lib/actions/templates"
import type { WithId } from "@/lib/firebase/serialize"
import type { Category, Cta, Template } from "@/lib/schemas"

type Props = {
  templates: WithId<Template>[]
  categories: WithId<Category>[]
  ctas: WithId<Cta>[]
}

/*
 * Template grid. Each card surfaces the category tint, post type, default CTA,
 * cadence, and a Canva thumbnail when designTemplateCanvaUrl is set. "Use
 * template" opens a date picker, then promotes the template to a new post and
 * deep-links to the calendar (the composer will be openable from there).
 */
export function LibraryView({ templates, categories, ctas }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [pickerFor, setPickerFor] = useState<WithId<Template> | null>(null)
  const [date, setDate] = useState<Date>(new Date())

  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const ctaById = new Map(ctas.map((c) => [c.id, c]))

  const onUse = (template: WithId<Template>) => {
    setPickerFor(template)
    setDate(new Date())
  }

  const confirm = () => {
    if (!pickerFor) return
    startTransition(async () => {
      const res = await promoteTemplate({
        templateId: pickerFor.id,
        scheduledDate: format(date, "yyyy-MM-dd"),
      })
      if (!res.ok) {
        toast.error(res.error ?? "Could not create post from template")
        return
      }
      toast.success(
        `Post created on ${format(date, "EEE d MMM")} from "${pickerFor.name}"`,
      )
      setPickerFor(null)
      router.push("/calendar")
      router.refresh()
    })
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No templates yet"
        body="Save a finished post as a template from the composer kebab — handy for recurring series like Pick of the Week or Meet the Team."
        size="lg"
      />
    )
  }

  return (
    <>
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {templates.map((t) => {
          const cat = t.categoryId ? categoryById.get(t.categoryId) : null
          const cta = t.defaultCtaId ? ctaById.get(t.defaultCtaId) : null
          return (
            <StaggerItem
              key={t.id}
              className="rounded-lg border border-border bg-background overflow-hidden flex flex-col hover:shadow-sm transition-shadow"
            >
              <div className="aspect-video bg-secondary/40 border-b border-border flex items-center justify-center">
                {t.designTemplateCanvaUrl ? (
                  <a
                    href={t.designTemplateCanvaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground underline"
                  >
                    Open in Canva
                  </a>
                ) : (
                  <ImageIcon
                    aria-hidden
                    className="size-8 text-muted-foreground/40"
                  />
                )}
              </div>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div className="flex items-start gap-2">
                  {cat && (
                    <span
                      aria-hidden
                      className="mt-1 size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  <h3 className="font-medium leading-snug flex-1">{t.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="secondary" className="font-normal capitalize">
                    {t.defaultPostType}
                  </Badge>
                  <Badge variant="secondary" className="font-normal capitalize">
                    {t.cadence}
                  </Badge>
                  {cta && (
                    <Badge variant="outline" className="font-normal">
                      {cta.label}
                    </Badge>
                  )}
                </div>
                {t.blurbTemplate && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {t.blurbTemplate}
                  </p>
                )}
                <div className="mt-auto pt-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => onUse(t)}
                  >
                    Use template
                  </Button>
                </div>
              </div>
            </StaggerItem>
          )
        })}
      </Stagger>

      <Dialog
        open={!!pickerFor}
        onOpenChange={(o) => !o && setPickerFor(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Use template</DialogTitle>
            <DialogDescription>
              {pickerFor?.name} — pick a date to schedule the new post.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Popover>
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
                  onSelect={(d) => d && setDate(d)}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerFor(null)}>
              Cancel
            </Button>
            <Button onClick={confirm}>Create post</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
