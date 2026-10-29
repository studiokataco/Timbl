"use client"

import { useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { ChoiceChips } from "@/components/shared/choice-chips"
import { ROLE_COPY, ROLES } from "@/components/settings/team-roles"
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
import { createMemberInvite, type MemberInviteResult } from "@/lib/actions/members"
import { parseInto } from "@/lib/forms/zod-form"
import { userRole } from "@/lib/schemas/_shared"

const inviteFormSchema = z.object({
  name: z.string().trim().min(1, "Add their name").max(120, "Keep the name under 120 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  role: userRole,
})

type InviteForm = z.infer<typeof inviteFormSchema>

const DEFAULTS: InviteForm = { name: "", email: "", role: "contributor" }

const ROLE_OPTIONS = ROLES.map((key) => ({ key, label: ROLE_COPY[key].label }))

export function announceInvite(res: MemberInviteResult, email: string, title: string) {
  if (res.emailSent === false) {
    toast.warning("Invite saved, but no email went out", {
      description: res.emailError
        ? `The email didn't send (${res.emailError}). Let ${email} know they can sign in with Google.`
        : `Invite emails aren't set up yet. Let ${email} know they can sign in with Google.`,
    })
    return
  }
  toast.success(title, { description: res.emailSent ? `We emailed ${email}.` : undefined })
}

export function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvited: () => void
}) {
  const [sending, startSend] = useTransition()
  const form = useForm<InviteForm>({ defaultValues: DEFAULTS })
  const role = useWatch({ control: form.control, name: "role" })
  const { errors } = form.formState

  const setOpen = (next: boolean) => {
    if (!next) form.reset(DEFAULTS)
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((raw) => {
    const values = parseInto(inviteFormSchema, raw, form.setError)
    if (!values) return
    startSend(async () => {
      const res = await createMemberInvite(values)
      if (!res.ok) {
        toast.error("Couldn't send the invite", { description: res.error })
        return
      }
      announceInvite(res, values.email, `Invited ${values.name}`)
      setOpen(false)
      onInvited()
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">Invite people</DialogTitle>
          <DialogDescription className="text-[13px]">
            They join by signing in with Google using the exact address you enter here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              autoComplete="off"
              aria-invalid={!!errors.name}
              className="h-9"
              {...form.register("name")}
            />
            {errors.name ? (
              <p className="text-[12px] text-rose-600 dark:text-rose-400">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              placeholder="name@company.com"
              aria-invalid={!!errors.email}
              className="h-9"
              {...form.register("email")}
            />
            {errors.email ? (
              <p className="text-[12px] text-rose-600 dark:text-rose-400">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="text-sm leading-none font-medium">Role</p>
            <ChoiceChips
              label="Role"
              options={ROLE_OPTIONS}
              value={role}
              onChange={(key) => form.setValue("role", key, { shouldDirty: true })}
              disabled={sending}
            />
            <p aria-live="polite" className="text-[13px] text-muted-foreground">
              {ROLE_COPY[role].detail}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" className="h-9" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="h-9" disabled={sending}>
              {sending ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : null}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
