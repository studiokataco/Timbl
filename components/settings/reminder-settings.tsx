"use client"

import { useTransition, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Controller, useForm, useWatch } from "react-hook-form"
import { Bell, Eye } from "lucide-react"
import { toast } from "sonner"

import { ChoiceChips } from "@/components/shared/choice-chips"
import { FormRow } from "@/components/shared/form-row"
import { UnsavedBar } from "@/components/shared/unsaved-bar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { updateReminderSettings } from "@/lib/actions/reminder-settings"
import {
  GOES_LIVE_WINDOW_LABELS,
  REMINDER_FREQUENCY_LABELS,
} from "@/lib/labels/enums"
import {
  reminderPreferencesSchema,
  type ReminderPreferences,
} from "@/lib/schemas/organisation"
import { cn } from "@/lib/utils"

type KindKey = "approvalDue" | "overdue" | "goesLiveSoon" | "silentCategory"
type DaysKey = "approvalHorizonDays" | "silentCategoryDays"
type OverdueScope = "both" | "draft" | "scheduled" | "none"

const KINDS: { key: KindKey; title: string; action: string }[] = [
  { key: "approvalDue", title: "Drafts waiting for review", action: "Review drafts" },
  { key: "overdue", title: "Overdue posts", action: "Open post" },
  { key: "goesLiveSoon", title: "Posts not ready to go live", action: "Final check" },
  { key: "silentCategory", title: "Quiet categories", action: "Plan a post" },
]

const DAYS: Record<DaysKey, { kind: KindKey; min: number; max: number; label: string }> = {
  approvalHorizonDays: { kind: "approvalDue", min: 1, max: 14, label: "Days ahead to check" },
  silentCategoryDays: { kind: "silentCategory", min: 7, max: 90, label: "Days without a post" },
}
const DAY_KEYS = Object.keys(DAYS) as DaysKey[]

const FREQUENCIES = (
  Object.keys(REMINDER_FREQUENCY_LABELS) as ReminderPreferences["frequency"][]
).map((key) => ({ key, label: REMINDER_FREQUENCY_LABELS[key] }))

const WINDOWS = (
  Object.keys(GOES_LIVE_WINDOW_LABELS) as ReminderPreferences["goesLiveWindow"][]
).map((key) => ({ key, label: GOES_LIVE_WINDOW_LABELS[key] }))

const MAX_OPTIONS = ["1", "2", "3", "4", "5"].map((key) => ({ key, label: key }))

const OVERDUE_SCOPES: { key: OverdueScope; label: string }[] = [
  { key: "both", label: "Drafts and scheduled" },
  { key: "draft", label: "Drafts only" },
  { key: "scheduled", label: "Scheduled only" },
]

function overdueScope(v: ReminderPreferences): OverdueScope {
  if (v.overdueIncludeDraft && v.overdueIncludeScheduled) return "both"
  if (v.overdueIncludeDraft) return "draft"
  if (v.overdueIncludeScheduled) return "scheduled"
  return "none"
}

function sample(key: KindKey, v: ReminderPreferences, category: string) {
  switch (key) {
    case "approvalDue": {
      const n = v.approvalHorizonDays
      return {
        title: "2 drafts need review",
        description: `Scheduled in the next ${n} day${n === 1 ? "" : "s"}`,
      }
    }
    case "overdue":
      return { title: "Overdue post", description: "Scheduled date has passed" }
    case "goesLiveSoon":
      return { title: "Final check before publish", description: "Channels still need setup" }
    case "silentCategory":
      return {
        title: `Plan a ${category} post`,
        description: `No posts in ${v.silentCategoryDays}+ days`,
      }
  }
}

function settleDays(key: DaysKey, raw: number, fallback: number): number {
  const { min, max } = DAYS[key]
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, Math.round(raw)))
}

function inRange(key: DaysKey, raw: number): boolean {
  const { min, max } = DAYS[key]
  return Number.isInteger(raw) && raw >= min && raw <= max
}

export function ReminderSettings({
  initial,
  sampleCategory,
}: {
  initial: ReminderPreferences
  sampleCategory?: string
}) {
  const [saving, startSave] = useTransition()
  const form = useForm<ReminderPreferences>({ defaultValues: initial })
  const { control, register, handleSubmit, reset, setValue, getValues, setError, clearErrors, formState } = form
  const { isDirty, errors } = formState
  const values = useWatch({ control }) as ReminderPreferences

  const savedDays = (key: DaysKey) => formState.defaultValues?.[key] ?? DAYS[key].min
  const shown: ReminderPreferences = {
    ...values,
    approvalHorizonDays: settleDays("approvalHorizonDays", values.approvalHorizonDays, savedDays("approvalHorizonDays")),
    silentCategoryDays: settleDays("silentCategoryDays", values.silentCategoryDays, savedDays("silentCategoryDays")),
  }
  const category = sampleCategory?.trim() || "category"
  const enabled = values.enabled
  const activeKinds = KINDS.filter((k) => values[k.key])
  const max = values.maxToastsPerSession

  function commitDays(key: DaysKey) {
    const raw = getValues(key)
    const next = settleDays(key, raw, savedDays(key))
    if (next !== raw) setValue(key, next, { shouldDirty: true })
    clearErrors(key)
  }

  function setOverdueScope(scope: OverdueScope) {
    setValue("overdueIncludeDraft", scope !== "scheduled", { shouldDirty: true })
    setValue("overdueIncludeScheduled", scope !== "draft", { shouldDirty: true })
  }

  function preview() {
    for (const kind of activeKinds.slice(0, max)) {
      const s = sample(kind.key, shown, category)
      toast(s.title, {
        id: `reminder-preview-${kind.key}`,
        description: s.description,
        action: { label: kind.action, onClick: () => {} },
      })
    }
  }

  const onSubmit = handleSubmit((raw) => {
    if (!isDirty) return
    const draft = { ...raw }
    let blocked = false
    for (const key of DAY_KEYS) {
      if (inRange(key, draft[key])) continue
      if (draft[DAYS[key].kind]) {
        setError(key, { message: `Pick ${DAYS[key].min} to ${DAYS[key].max} days` })
        blocked = true
      } else {
        draft[key] = settleDays(key, draft[key], savedDays(key))
      }
    }
    if (blocked) return

    const parsed = reminderPreferencesSchema.safeParse(draft)
    if (!parsed.success) {
      toast.error("Couldn't save reminders", { description: "Reload the page and try again." })
      return
    }
    const next = parsed.data
    startSave(async () => {
      const res = await updateReminderSettings(next)
      if (!res.ok) {
        toast.error("Couldn't save reminders", { description: "Try again in a moment." })
        return
      }
      toast.success("Reminders saved")
      reset(next)
    })
  })

  function daysInput(key: DaysKey) {
    return (
      <Input
        type="number"
        inputMode="numeric"
        min={DAYS[key].min}
        max={DAYS[key].max}
        aria-label={DAYS[key].label}
        aria-invalid={!!errors[key]}
        className="h-9 w-16 text-center tabular-nums sm:h-8"
        {...register(key, { valueAsNumber: true, onBlur: () => commitDays(key) })}
      />
    )
  }

  function daysError(key: DaysKey) {
    const message = errors[key]?.message
    return message ? (
      <p role="alert" className="mt-1.5 text-[12px] text-destructive">
        {message}
      </p>
    ) : null
  }

  function detail(key: KindKey): ReactNode {
    switch (key) {
      case "approvalDue":
        return (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span>Count drafts scheduled in the next</span>
              {daysInput("approvalHorizonDays")}
              <span>days</span>
            </div>
            {daysError("approvalHorizonDays")}
          </>
        )
      case "overdue":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Include</span>
            <ChoiceChips
              label="Overdue posts to include"
              options={OVERDUE_SCOPES}
              value={overdueScope(values)}
              onChange={setOverdueScope}
            />
          </div>
        )
      case "goesLiveSoon":
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Going live</span>
            <Controller
              control={control}
              name="goesLiveWindow"
              render={({ field }) => (
                <ChoiceChips label="When to check posts going live" options={WINDOWS} value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
        )
      case "silentCategory":
        return (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span>Flag a category after</span>
              {daysInput("silentCategoryDays")}
              <span>days without a post</span>
            </div>
            {daysError("silentCategoryDays")}
          </>
        )
    }
  }

  const status = !enabled
    ? "Off. Nobody in this workspace sees reminders."
    : activeKinds.length === 0
      ? "On, but every reminder type below is off."
      : `${activeKinds.length} of ${KINDS.length} types on, up to ${max} at a time.`

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormRow
        title="Reminders"
        hint="Short nudges that pop up when someone opens Timbl. Applies to everyone in this workspace."
      >
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 transition-colors duration-150 ease-out hover:bg-secondary/40">
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-foreground">Show reminders</span>
            <span className="block text-[12px] text-muted-foreground tabular-nums">{status}</span>
          </span>
          <Controller
            control={control}
            name="enabled"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Show reminders" />
            )}
          />
        </label>
      </FormRow>

      <fieldset
        disabled={!enabled}
        className={cn(
          "min-w-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
          !enabled && "opacity-50 [&_:disabled]:opacity-100!",
        )}
      >
        <FormRow
          className="first:pt-6"
          title="What to remind about"
          hint="Each line is a sample of what the reminder says. Turn one on to tune when it fires."
        >
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {KINDS.map((kind) => {
              const s = sample(kind.key, shown, category)
              return (
                <li key={kind.key}>
                  <label className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors duration-150 ease-out hover:bg-secondary/40 has-[:disabled]:cursor-default has-[:disabled]:hover:bg-transparent">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-foreground">{kind.title}</span>
                      <span className="mt-0.5 flex items-start gap-1.5 text-[12px] leading-snug text-muted-foreground">
                        <Bell className="mt-[3px] size-3 shrink-0" aria-hidden />
                        <span className="min-w-0 tabular-nums">
                          <span className="text-foreground/80">{s.title}</span>
                          <span aria-hidden> · </span>
                          <span className="sr-only">, </span>
                          {s.description}
                        </span>
                      </span>
                    </span>
                    <Controller
                      control={control}
                      name={kind.key}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label={kind.title}
                          className="mt-0.5"
                        />
                      )}
                    />
                  </label>
                  <Reveal show={values[kind.key]}>
                    <div className="px-4 pb-3 pt-1">{detail(kind.key)}</div>
                  </Reveal>
                </li>
              )
            })}
          </ul>
        </FormRow>

        <FormRow title="How often" hint="A few well-timed reminders get read. A pile of them gets ignored.">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-foreground">Repeat each reminder</p>
              <Controller
                control={control}
                name="frequency"
                render={({ field }) => (
                  <ChoiceChips label="Repeat each reminder" options={FREQUENCIES} value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium text-foreground">Most at once</p>
              <Controller
                control={control}
                name="maxToastsPerSession"
                render={({ field }) => (
                  <ChoiceChips
                    label="Most reminders at once"
                    options={MAX_OPTIONS}
                    value={String(field.value)}
                    onChange={(k) => field.onChange(Number(k))}
                  />
                )}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] text-muted-foreground tabular-nums">
                {activeKinds.length === 0
                  ? "Turn on a reminder above to preview it."
                  : `Up to ${max} per visit, in the order listed above.`}
              </p>
              <Button
                type="button"
                variant="outline"
                className="max-sm:h-9"
                onClick={preview}
                disabled={activeKinds.length === 0}
              >
                <Eye aria-hidden />
                Preview
              </Button>
            </div>
          </div>
        </FormRow>
      </fieldset>

      <UnsavedBar show={isDirty} saving={saving} onDiscard={() => reset()} />
    </form>
  )
}

function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
