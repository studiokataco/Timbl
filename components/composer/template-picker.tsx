"use client"

import { useTransition } from "react"
import { useQuery } from "@tanstack/react-query"
import { LayoutTemplate, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { listTemplates, applyTemplate } from "@/lib/actions/templates"
import type { Template } from "@/lib/schemas"
import type { WithId } from "@/lib/firebase/serialize"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: string
  onApplied?: (template: WithId<Template>) => void
}

export function TemplatePicker({ open, onOpenChange, postId, onApplied }: Props) {
  const [applying, startApply] = useTransition()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates-list"],
    queryFn: () => listTemplates(),
    staleTime: 60_000,
    enabled: open,
  })

  const handleSelect = (tmpl: WithId<Template>) => {
    startApply(async () => {
      const res = await applyTemplate({ postId, templateId: tmpl.id })
      if (!res.ok) {
        toast.error(res.error ?? "Could not apply template")
        return
      }
      onOpenChange(false)
      toast.success(`Template "${tmpl.name}" applied`)
      onApplied?.(tmpl)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-sm font-medium">Apply template</DialogTitle>
        </DialogHeader>
        <Command className="border-t">
          <CommandInput placeholder="Search templates..." />
          <CommandList className="max-h-64">
            {isLoading ? (
              <div className="flex flex-col gap-1 p-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ) : (
              <>
                <CommandEmpty>No templates found.</CommandEmpty>
                {templates.map((tmpl) => (
                  <CommandItem
                    key={tmpl.id}
                    value={tmpl.name}
                    onSelect={() => handleSelect(tmpl)}
                    disabled={applying}
                    className="flex items-center gap-2"
                  >
                    {applying ? (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <LayoutTemplate className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate">{tmpl.name}</span>
                    {tmpl.cadence !== "ad-hoc" && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground capitalize">
                        {tmpl.cadence}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
