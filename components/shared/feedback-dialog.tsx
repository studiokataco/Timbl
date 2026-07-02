"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { submitFeedbackAction } from "@/lib/actions/feedback"
import { feedbackFormSchema, type FeedbackFormValues } from "@/lib/schemas/feedback"

const CATEGORY_LABEL: Record<FeedbackFormValues["category"], string> = {
  idea: "An idea",
  bug: "Something's broken",
  praise: "Just saying thanks",
  other: "Other",
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as FeedbackFormValues["category"][]

export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  const form = useForm<FeedbackFormValues>({
    defaultValues: { message: "", category: "other" },
  })
  // eslint-disable-next-line react-hooks/incompatible-library -- RHF watch is intentional for the category select
  const category = form.watch("category")

  const onSubmit = form.handleSubmit((values) => {
    const parsed = feedbackFormSchema.safeParse(values)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      form.setError((issue?.path[0] as keyof FeedbackFormValues) ?? "message", {
        message: issue?.message ?? "Invalid input",
      })
      return
    }

    startTransition(async () => {
      const result = await submitFeedbackAction(parsed.data)
      if (!result.ok) {
        toast.error(result.error ?? "Could not send feedback")
        return
      }
      toast.success("Thanks for the feedback - check your inbox")
      form.reset({ message: "", category: "other" })
      onOpenChange(false)
    })
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) form.reset({ message: "", category: "other" })
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s working, what&apos;s not, or what you wish Timbl did. We read every note.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) =>
                form.setValue("category", v as FeedbackFormValues["category"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="feedback-category">
                <SelectValue>{CATEGORY_LABEL[category]}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CATEGORY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-message">Your feedback</Label>
            <Textarea
              id="feedback-message"
              rows={5}
              autoFocus
              placeholder="What's on your mind?"
              {...form.register("message", { required: true })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
