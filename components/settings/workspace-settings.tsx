"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Compass, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { FormGroupTitle, FormRow } from "@/components/shared/form-row"
import { UnsavedBar } from "@/components/shared/unsaved-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ColorSwatches } from "@/components/settings/color-swatches"
import { IdentityImageField } from "@/components/settings/identity-image-field"
import { startProductTour } from "@/components/tour/product-tour"
import { setDevOrg } from "@/lib/actions/dev-org"
import { updateWorkspaceIdentity } from "@/lib/actions/identity"
import { resetOnboarding } from "@/lib/actions/onboarding"
import type { DevOrgMode } from "@/lib/auth/dev-session"
import { parseInto } from "@/lib/forms/zod-form"
import type { WorkspaceIdentity } from "@/lib/identity/profile.server"
import {
  workspaceIdentityFormSchema,
  type WorkspaceIdentityForm,
} from "@/lib/schemas/identity"

export function WorkspaceSettings({
  workspace,
  canEdit,
  completedAt,
  industry,
  devShim,
  devOrgMode,
}: {
  workspace: WorkspaceIdentity
  canEdit: boolean
  completedAt?: string
  industry?: string
  devShim: boolean
  devOrgMode: DevOrgMode
}) {
  const router = useRouter()
  const [saving, startSave] = useTransition()
  const [rerunning, startRerun] = useTransition()
  const [switching, startSwitch] = useTransition()
  const form = useForm<WorkspaceIdentityForm>({
    defaultValues: { name: workspace.name, color: workspace.color },
  })
  const { isDirty, errors } = form.formState
  const [name, color] = useWatch({ control: form.control, name: ["name", "color"] })

  const onSubmit = form.handleSubmit((raw) => {
    const values = parseInto(workspaceIdentityFormSchema, raw, form.setError)
    if (!values) return
    startSave(async () => {
      const res = await updateWorkspaceIdentity(values)
      if (!res.ok) {
        toast.error("Couldn't save", { description: res.error })
        return
      }
      form.reset(values)
      toast.success("Workspace updated")
    })
  })

  function rerunSetup() {
    startRerun(async () => {
      const res = await resetOnboarding()
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't start the setup wizard")
        return
      }
      router.push("/onboarding")
    })
  }

  function toggleDemo(on: boolean) {
    startSwitch(async () => {
      const res = await setDevOrg({ mode: on ? "demo" : "tenant" })
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't switch workspace")
        return
      }
      toast.success(on ? "Switched to the demo workspace" : "Switched to your workspace")
      router.refresh()
    })
  }

  const setupStatus = completedAt
    ? `Completed ${new Date(completedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}${industry ? ` for ${industry}` : ""}.`
    : "Not completed yet."

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormRow
        title="Logo"
        hint={canEdit ? "Shown in the workspace switcher and on invites. Saves as soon as you pick one." : "Only admins can change the logo."}
      >
        <IdentityImageField
          target={{ kind: "workspace" }}
          name={name || workspace.name}
          src={workspace.logoUrl}
          color={color}
          disabled={!canEdit}
        />
      </FormRow>
      <FormRow title="Name" hint="Your agency or company. Brands live inside it." htmlFor="workspace-name">
        <Input
          id="workspace-name"
          disabled={!canEdit}
          aria-invalid={!!errors.name}
          className="max-w-sm"
          {...form.register("name")}
        />
        {errors.name ? (
          <p className="mt-1.5 text-[12px] text-rose-600 dark:text-rose-400">{errors.name.message}</p>
        ) : null}
      </FormRow>
      <FormRow title="Accent" hint="Tints the initials when there's no logo.">
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorSwatches
              label="Workspace accent"
              value={field.value}
              onChange={field.onChange}
              disabled={!canEdit}
            />
          )}
        />
      </FormRow>

      <FormGroupTitle>Setup</FormGroupTitle>
      <FormRow title="Setup wizard" hint={setupStatus}>
        <p className="max-w-[60ch] text-[13px] text-muted-foreground">
          Re-running adds newly suggested categories without touching yours, and re-tailors agents to the profile you confirm.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={rerunSetup} disabled={rerunning}>
          {rerunning ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
          Re-run setup
        </Button>
      </FormRow>
      <FormRow title="Product tour" hint="A two-minute walk through the calendar, posts, studio and settings.">
        <Button type="button" variant="outline" size="sm" onClick={() => startProductTour()}>
          <Compass aria-hidden />
          Take the tour
        </Button>
      </FormRow>
      {devShim ? (
        <FormRow title="Demo workspace" hint="Emulator only. Swap to the fully seeded demo for walkthroughs.">
          <label className="flex max-w-md items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
            <span>
              <span className="block text-[13px] font-medium text-foreground">Use the demo workspace</span>
              <span className="block text-[12px] text-muted-foreground">
                Or open the{" "}
                <Link href="/welcome" className="underline underline-offset-2 hover:text-foreground">
                  workspace chooser
                </Link>
                .
              </span>
            </span>
            <Switch
              checked={devOrgMode === "demo"}
              disabled={switching}
              onCheckedChange={toggleDemo}
              aria-label="Use the demo workspace"
            />
          </label>
        </FormRow>
      ) : null}

      <UnsavedBar show={isDirty} saving={saving} onDiscard={() => form.reset()} />
    </form>
  )
}
