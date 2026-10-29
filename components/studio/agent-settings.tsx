"use client"

import { useId, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import {
  agentSettingsFormSchema,
  type AgentSettingsForm,
} from "@/lib/schemas/agentSettingsForm"
import { updateAgentConfig } from "@/lib/actions/agent-configs"
import { ChoiceChips } from "@/components/shared/choice-chips"
import { DisclosureBody, DisclosureTrigger } from "@/components/ui/disclosure"
import { FormRow } from "@/components/shared/form-row"
import { UnsavedBar } from "@/components/shared/unsaved-bar"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { getTool, listToolKeys } from "./tool-catalog"
import {
  WEEKDAYS,
  agentLabel,
  buildCron,
  clock,
  describeCron,
  parseSchedule,
  type ScheduleMode,
} from "./agent-meta"

const MODES: { key: ScheduleMode; label: string }[] = [
  { key: "manual", label: "On demand" },
  { key: "daily", label: "Daily" },
  { key: "weekdays", label: "Weekdays" },
  { key: "weekly", label: "Weekly" },
  { key: "custom", label: "Custom" },
]

const LIMITS: { key: keyof AgentSettingsForm["budgets"]; label: string; hint: string; step: number; prefix?: string }[] = [
  { key: "monthlyUsdCap", label: "Monthly spend cap", hint: "Agent stops for the month once reached", step: 1, prefix: "$" },
  { key: "maxUsdCost", label: "Spend per run", hint: "A single run stops past this", step: 0.1, prefix: "$" },
  { key: "maxLlmCalls", label: "Model calls per run", hint: "Upper bound on thinking steps", step: 1 },
  { key: "maxToolCalls", label: "Tool calls per run", hint: "Upper bound on actions taken", step: 1 },
  { key: "maxReviewLoops", label: "Review rounds", hint: "Draft and review passes before stopping", step: 1 },
]

function toForm(agent: AgentConfig): AgentSettingsForm {
  const s = parseSchedule(agent)
  return {
    scheduleMode: s.mode,
    time: s.time,
    weekday: s.weekday,
    cron: s.cron,
    manual: agent.triggers.manual,
    temperature: agent.temperature,
    systemPrompt: agent.systemPrompt ?? "",
    allowedTools: [...agent.allowedTools],
    budgets: { ...agent.budgets },
  }
}

export function AgentSettings({ agent }: { agent: AgentConfig }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [saving, startSave] = useTransition()
  const [limitsOpen, setLimitsOpen] = useState(false)
  const limitsId = useId()
  const defaults = useMemo(() => toForm(agent), [agent])

  const form = useForm<AgentSettingsForm>({ defaultValues: defaults })
  const { control, register, handleSubmit, reset, setError, formState } = form
  const values = useWatch({ control }) as AgentSettingsForm
  const dirty = formState.isDirty

  const previewSchedule = useMemo(() => {
    const at = clock(values.time || "09:00")
    switch (values.scheduleMode) {
      case "manual":
        return "Runs only when you start it or chat with it."
      case "daily":
        return `Runs every day at ${at}.`
      case "weekdays":
        return `Runs Monday to Friday at ${at}.`
      case "weekly":
        return `Runs every ${WEEKDAYS[values.weekday]} at ${at}.`
      case "custom":
        return values.cron.trim() ? describeCron(values.cron.trim()) ?? "Not a valid cron expression." : "Add a cron expression."
    }
  }, [values.scheduleMode, values.time, values.weekday, values.cron])

  const onSubmit = handleSubmit((raw) => {
    const parsed = agentSettingsFormSchema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(issue.path.join(".") as never, { message: issue.message })
      }
      return
    }
    const v = parsed.data
    const cron = buildCron({ mode: v.scheduleMode, time: v.time, weekday: v.weekday, cron: v.cron })
    startSave(async () => {
      const res = await updateAgentConfig({
        name: agent.name,
        patch: {
          temperature: v.temperature,
          systemPrompt: v.systemPrompt,
          allowedTools: v.allowedTools,
          budgets: v.budgets,
          ...(v.scheduleMode === "manual" ? {} : { schedule: cron }),
          triggers: {
            manual: v.manual,
            cron: v.scheduleMode !== "manual",
            systemUserId: agent.triggers.systemUserId,
          },
        },
      })
      if (!res.ok) {
        toast.error("Couldn't save", { description: res.error })
        return
      }
      toast.success(`${agentLabel(agent.name)} updated`)
      reset(v)
      queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
      router.refresh()
    })
  })

  const tools = values.allowedTools ?? []
  const available = listToolKeys().filter((k) => !tools.includes(k))
  const temp = values.temperature ?? 0

  return (
    <form onSubmit={onSubmit} className="pb-28" noValidate>
      <FormRow title="Schedule" hint="When the agent works on its own.">
        <Controller
          control={control}
          name="scheduleMode"
          render={({ field }) => (
            <ChoiceChips label="Schedule" options={MODES} value={field.value} onChange={field.onChange} />
          )}
        />

        {values.scheduleMode !== "manual" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {values.scheduleMode === "custom" ? (
              <div className="w-full max-w-xs">
                <Input {...register("cron")} placeholder="0 9 * * 1" className="font-mono" aria-label="Cron expression" aria-invalid={!!formState.errors.cron} />
              </div>
            ) : (
              <>
                {values.scheduleMode === "weekly" && (
                  <Controller
                    control={control}
                    name="weekday"
                    render={({ field }) => (
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger className="w-40" aria-label="Day of the week">
                          <SelectValue>{WEEKDAYS[field.value]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((d, i) => (
                            <SelectItem key={d} value={String(i)}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
                <span className="text-[13px] text-muted-foreground">at</span>
                <Input type="time" {...register("time")} className="w-32 tabular-nums" aria-label="Time" />
              </>
            )}
          </div>
        )}
        <p className={cn("mt-2 text-[13px]", formState.errors.cron ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
          {formState.errors.cron?.message ?? previewSchedule}
        </p>

        <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
          <span>
            <span className="block text-[13px] font-medium text-foreground">Allow manual runs</span>
            <span className="block text-[12px] text-muted-foreground">Start it from chat or the Run now button.</span>
          </span>
          <Controller
            control={control}
            name="manual"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Allow manual runs" />
            )}
          />
        </label>
      </FormRow>

      <FormRow title="Instructions" hint="The brief this agent follows on every run. Plain language works best.">
        <Textarea
          {...register("systemPrompt")}
          rows={12}
          aria-label="Instructions"
          aria-invalid={!!formState.errors.systemPrompt}
          className="min-h-56 text-[13px] leading-relaxed"
        />
        <p className="mt-1.5 flex justify-between text-[12px] text-muted-foreground">
          <span className="text-rose-600 dark:text-rose-400">{formState.errors.systemPrompt?.message}</span>
          <span className="tabular-nums">{(values.systemPrompt ?? "").length.toLocaleString()} / 20,000</span>
        </p>
      </FormRow>

      <FormRow title="Creativity" hint="Lower is consistent and literal. Higher is varied and playful.">
        <Controller
          control={control}
          name="temperature"
          render={({ field }) => (
            <div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  aria-label="Creativity"
                  aria-valuetext={tempLabel(field.value)}
                  className="h-1.5 w-full max-w-sm cursor-pointer accent-foreground"
                />
                <span className="w-24 text-[13px] font-medium text-foreground">{tempLabel(temp)}</span>
              </div>
              <div className="mt-1 flex w-full max-w-sm justify-between text-[11px] text-muted-foreground">
                <span>Precise</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>
          )}
        />
      </FormRow>

      <FormRow title="Tools" hint="What the agent is allowed to do beyond writing text.">
        <Controller
          control={control}
          name="allowedTools"
          render={({ field }) => (
            <div className="space-y-2">
              {field.value.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No tools. This agent can only reply in text.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {field.value.map((key) => {
                    const t = getTool(key)
                    return (
                      <li key={key} className="flex items-start gap-3 px-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-foreground">{t.title}</span>
                          <span className="block text-[12px] leading-snug text-muted-foreground">{t.description}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => field.onChange(field.value.filter((k) => k !== key))}
                          aria-label={`Remove ${t.title}`}
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {available.length > 0 && (
                <Select value="" onValueChange={(v) => v && field.onChange([...field.value, v as string])}>
                  <SelectTrigger className="w-full sm:w-64" aria-label="Add a tool">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Plus className="size-3.5" aria-hidden />
                      Add a tool
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((k) => (
                      <SelectItem key={k} value={k}>
                        {getTool(k).title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        />
      </FormRow>

      <FormRow title="Limits" hint="Guardrails on spend and effort. Defaults suit most teams.">
        <div className="rounded-lg border border-border">
          <DisclosureTrigger
            open={limitsOpen}
            onOpenChange={setLimitsOpen}
            controls={limitsId}
            className="gap-3 rounded-lg px-3 py-2.5 text-[13px]"
          >
            <span className="text-foreground">
              <span className="font-medium">${values.budgets?.monthlyUsdCap ?? 0}</span>
              <span className="text-muted-foreground"> a month, ${values.budgets?.maxUsdCost ?? 0} per run</span>
            </span>
          </DisclosureTrigger>
          <DisclosureBody
            id={limitsId}
            open={limitsOpen}
            className="grid gap-x-6 gap-y-4 border-t border-border p-3 sm:grid-cols-2"
          >
            {LIMITS.map((l) => (
              <label key={l.key} className="block">
                <span className="block text-[13px] font-medium text-foreground">{l.label}</span>
                <span className="block text-[12px] text-muted-foreground">{l.hint}</span>
                <span className="relative mt-1.5 block">
                  {l.prefix && (
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                      {l.prefix}
                    </span>
                  )}
                  <Input
                    type="number"
                    step={l.step}
                    min={0}
                    inputMode="decimal"
                    {...register(`budgets.${l.key}`, { valueAsNumber: true })}
                    className={cn("tabular-nums", l.prefix && "pl-6")}
                  />
                </span>
              </label>
            ))}
          </DisclosureBody>
        </div>
      </FormRow>

      <UnsavedBar show={dirty} saving={saving} onDiscard={() => reset(defaults)} />
    </form>
  )
}

function tempLabel(t: number): string {
  if (t <= 0.4) return "Precise"
  if (t <= 1.1) return "Balanced"
  return "Creative"
}
