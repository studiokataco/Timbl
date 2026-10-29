"use client"

import { useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Monitor, Moon, Sun } from "lucide-react"
import { toast } from "sonner"

import { ChoiceChips } from "@/components/shared/choice-chips"
import { FormGroupTitle, FormRow } from "@/components/shared/form-row"
import { UnsavedBar } from "@/components/shared/unsaved-bar"
import { useTheme } from "@/components/shared/theme-provider"
import { Input } from "@/components/ui/input"
import { IdentityImageField } from "@/components/settings/identity-image-field"
import { updateProfile } from "@/lib/actions/identity"
import { parseInto } from "@/lib/forms/zod-form"
import type { UserProfile } from "@/lib/identity/profile.server"
import { profileFormSchema, type ProfileForm } from "@/lib/schemas/identity"

const ROLE_COPY: Record<UserProfile["role"], { label: string; detail: string }> = {
  admin: { label: "Admin", detail: "Full control of the workspace, billing and members." },
  editor: { label: "Editor", detail: "Creates, edits and approves content." },
  contributor: { label: "Contributor", detail: "Drafts content for review." },
}

const THEMES = [
  { key: "system" as const, label: <><Monitor aria-hidden />System</> },
  { key: "light" as const, label: <><Sun aria-hidden />Light</> },
  { key: "dark" as const, label: <><Moon aria-hidden />Dark</> },
]

export function ProfileSettings({ profile }: { profile: UserProfile }) {
  const { theme, setTheme } = useTheme()
  const [saving, startSave] = useTransition()
  const form = useForm<ProfileForm>({ defaultValues: { name: profile.name } })
  const { isDirty, errors } = form.formState
  const name = useWatch({ control: form.control, name: "name" })
  const role = ROLE_COPY[profile.role]

  const onSubmit = form.handleSubmit((raw) => {
    const values = parseInto(profileFormSchema, raw, form.setError)
    if (!values) return
    startSave(async () => {
      const res = await updateProfile(values)
      if (!res.ok) {
        toast.error("Couldn't save", { description: res.error })
        return
      }
      form.reset(values)
      toast.success("Profile updated")
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormRow title="Photo" hint="Appears on posts you author, comments and approvals. Saves as soon as you pick one.">
        <IdentityImageField
          target={{ kind: "user" }}
          name={name || profile.name}
          src={profile.avatarUrl}
          shape="circle"
        />
      </FormRow>
      <FormRow title="Name" hint="How teammates see you across Timbl." htmlFor="profile-name">
        <Input
          id="profile-name"
          autoComplete="name"
          aria-invalid={!!errors.name}
          className="max-w-sm"
          {...form.register("name")}
        />
        {errors.name ? (
          <p className="mt-1.5 text-[12px] text-rose-600 dark:text-rose-400">{errors.name.message}</p>
        ) : null}
      </FormRow>
      <FormRow title="Email" hint="Your sign-in address. Change it with your sign-in provider.">
        <p className="flex h-9 items-center text-[14px] text-foreground">{profile.email}</p>
      </FormRow>
      <FormRow title="Role" hint="Set by a workspace admin from Members.">
        <p className="text-[14px] font-medium text-foreground">{role.label}</p>
        <p className="text-[13px] text-muted-foreground">{role.detail}</p>
      </FormRow>

      <FormGroupTitle>Preferences</FormGroupTitle>
      <FormRow title="Theme" hint="Applies to this browser.">
        <ChoiceChips
          label="Theme"
          options={THEMES}
          value={theme}
          onChange={(key) => setTheme(key)}
        />
      </FormRow>

      <UnsavedBar show={isDirty} saving={saving} onDiscard={() => form.reset()} />
    </form>
  )
}
