"use client"

import { useId } from "react"
import { Controller, useForm, type FieldErrors, type Resolver, type ResolverResult } from "react-hook-form"
import { CircleAlert, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { personaSchema, REDUCED_POPUP, showCursorsEffective, tw } from "../lib"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { Personality, PresencePrefs, UserRole, VoiceLocale } from "../types"

export type PersonaPanelProps = {
  role: UserRole
  assistantName: string
  prefs: PresencePrefs
  inFrame: boolean
  onSave: (name: string, prefs: PresencePrefs) => void
  onCancel: () => void
}

export type PersonaPresenceSheetProps = PersonaPanelProps & {
  open: boolean
  onOpenChange: (o: boolean) => void
  layout: "side" | "bottom" | "frame"
  finalFocus: () => HTMLElement | null
  reduced: boolean
}

type FormValues = {
  assistantName: string
  reduceMotion: boolean
  largerTarget: boolean
  tips: boolean
  voiceLocale: VoiceLocale
  personality: Personality
  workingStyle: string
  showCursors: boolean
  shortcuts: boolean
  ambient: { glow: boolean; backgroundMotion: boolean }
}

const PERSONALITY_KEYS: Personality[] = ["calm", "warm", "direct", "playful"]
const LOCALE_KEYS: VoiceLocale[] = ["en-IN", "en-GB", "en-US", "hi-IN", "hinglish"]

const personaResolver: Resolver<FormValues> = async (values): Promise<ResolverResult<FormValues>> => {
  const result = personaSchema.safeParse(values)
  if (result.success) return { values: result.data, errors: {} }
  const errors: FieldErrors<FormValues> = {}
  for (const issue of result.error.issues) {
    if (issue.path[0] === "assistantName" && !errors.assistantName) {
      errors.assistantName = { type: issue.code, message: issue.message }
    }
  }
  return { values: {}, errors }
}

export function PersonaPanel({
  role,
  assistantName,
  prefs,
  inFrame,
  onSave,
  onCancel,
}: PersonaPanelProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const p = copy.persona
  const baseId = useId()
  const nameErrId = `${baseId}-name-err`
  const isAdmin = role === "admin"

  const form = useForm<FormValues>({
    resolver: personaResolver,
    shouldFocusError: true,
    defaultValues: {
      assistantName,
      reduceMotion: prefs.reduceMotion,
      largerTarget: prefs.largerTarget,
      tips: prefs.tips,
      voiceLocale: prefs.voiceLocale,
      personality: prefs.personality,
      workingStyle: prefs.workingStyle,
      showCursors: showCursorsEffective(prefs, reduced),
      shortcuts: prefs.shortcuts,
      ambient: { glow: prefs.ambient.glow, backgroundMotion: prefs.ambient.backgroundMotion },
    },
  })

  const nameError = form.formState.errors.assistantName?.message
  const localeItems = LOCALE_KEYS.map((value) => ({ value, label: p.locales[value] }))

  const submit = form.handleSubmit((values) => {
    onSave(values.assistantName.trim(), {
      reduceMotion: values.reduceMotion,
      largerTarget: values.largerTarget,
      tips: values.tips,
      voiceLocale: values.voiceLocale,
      personality: values.personality,
      workingStyle: values.workingStyle,
      showCursors: values.showCursors,
      shortcuts: values.shortcuts,
      ambient: { glow: values.ambient.glow, backgroundMotion: values.ambient.backgroundMotion },
    })
  })

  const renderSwitchRow = (
    key: "reduceMotion" | "largerTarget" | "tips" | "ambient.glow" | "ambient.backgroundMotion" | "showCursors" | "shortcuts",
    label: string,
    description: string,
  ) => {
    const id = `${baseId}-${key}`
    return (
      <Controller
        key={key}
        control={form.control}
        name={key}
        render={({ field }) => (
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <Label htmlFor={id} className="flex flex-1 cursor-pointer flex-col items-start gap-0.5">
              <span className="text-body-sm font-medium text-foreground">{label}</span>
              <span className="text-caption text-muted-foreground">{description}</span>
            </Label>
            <Switch id={id} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
          </div>
        )}
      />
    )
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      data-slot="agentic-persona-panel"
      data-state={role}
      data-figma="PersonaPresenceSheet/panel"
      className="flex min-h-0 flex-1 flex-col gap-6"
    >
      <section className="flex flex-col gap-3">
        {isAdmin ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${baseId}-name`}>{p.nameLabel}</Label>
            <Input
              id={`${baseId}-name`}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? nameErrId : undefined}
              {...form.register("assistantName")}
            />
            <p className="text-caption text-muted-foreground">{p.nameHelp}</p>
            {nameError ? (
              <p id={nameErrId} className="flex items-center gap-1.5 text-caption text-foreground">
                <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
                <span>{nameError}</span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex flex-col">
              <span className="text-body-sm font-medium text-foreground">{assistantName}</span>
              <span className="text-caption text-muted-foreground">{p.nameLocked}</span>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-title-sm text-foreground">{p.sections.yours}</h3>
        <div className="flex flex-col gap-2">
          <Label>{p.personality}</Label>
          <Controller
            control={form.control}
            name="personality"
            render={({ field }) => (
              <ToggleGroup
                aria-label={p.personality}
                value={[field.value]}
                onValueChange={(vals) => {
                  const next = vals[0] as Personality | undefined
                  if (next) field.onChange(next)
                }}
                variant="outline"
                spacing={1}
                className="flex-wrap"
              >
                {PERSONALITY_KEYS.map((k) => (
                  <ToggleGroupItem
                    key={k}
                    value={k}
                    className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                  >
                    {p.personalities[k]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${baseId}-voice`}>{p.voice}</Label>
          <Controller
            control={form.control}
            name="voiceLocale"
            render={({ field }) =>
              inFrame ? (
                <ToggleGroup
                  aria-label={p.voice}
                  value={[field.value]}
                  onValueChange={(vals) => {
                    const next = vals[0] as VoiceLocale | undefined
                    if (next) field.onChange(next)
                  }}
                  variant="outline"
                  spacing={1}
                  className="flex-wrap"
                >
                  {LOCALE_KEYS.map((loc) => (
                    <ToggleGroupItem
                      key={loc}
                      value={loc}
                      className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                    >
                      {p.locales[loc]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : (
                <Select items={localeItems} value={field.value} onValueChange={(v) => v && field.onChange(v as VoiceLocale)}>
                  <SelectTrigger id={`${baseId}-voice`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_KEYS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {p.locales[loc]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${baseId}-style`}>{p.workingStyle}</Label>
          <Textarea id={`${baseId}-style`} rows={2} {...form.register("workingStyle")} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-title-sm text-foreground">{p.sections.presence}</h3>
        <p className="text-caption text-muted-foreground">{p.presenceIntro}</p>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {renderSwitchRow("reduceMotion", p.toggles.reduce.label, p.toggles.reduce.description)}
        {renderSwitchRow("largerTarget", p.toggles.larger.label, p.toggles.larger.description)}
        {renderSwitchRow("tips", p.toggles.tips.label, p.toggles.tips.description)}
        {renderSwitchRow("ambient.glow", p.toggles.glow.label, p.toggles.glow.description)}
        {renderSwitchRow("ambient.backgroundMotion", p.toggles.backgroundMotion.label, p.toggles.backgroundMotion.description)}
        {renderSwitchRow("showCursors", p.toggles.cursors.label, p.toggles.cursors.description)}
        {renderSwitchRow("shortcuts", p.toggles.shortcuts.label, p.toggles.shortcuts.description)}
        <div className="flex items-start justify-between gap-3 px-4 py-3 opacity-60">
          <Label htmlFor={`${baseId}-drift`} className="flex flex-1 flex-col items-start gap-0.5">
            <span className="text-body-sm font-medium text-foreground">{p.toggles.drift.label}</span>
            <span className="text-caption text-muted-foreground">{p.toggles.drift.description}</span>
          </Label>
          <Switch id={`${baseId}-drift`} checked={false} disabled />
        </div>
        </div>
      </section>

      <SheetFooter className="mt-auto flex-row justify-end gap-2 p-0 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {p.cancel}
        </Button>
        <Button type="submit">{p.save}</Button>
      </SheetFooter>
    </form>
  )
}

export function PersonaPresenceSheet({
  open,
  onOpenChange,
  layout,
  finalFocus,
  reduced,
  ...panelProps
}: PersonaPresenceSheetProps): React.JSX.Element {
  const { copy } = usePrototype()
  if (layout === "frame") {
    return <PersonaPanel {...panelProps} />
  }
  const side = layout === "bottom" ? "bottom" : "right"
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        finalFocus={finalFocus}
        data-slot="agentic-persona-sheet"
        data-state={panelProps.role}
        data-figma="PersonaPresenceSheet/root"
        className={tw(
          "overflow-y-auto p-6",
          layout === "bottom" && "max-h-9/10 rounded-t-2xl",
          reduced && REDUCED_POPUP,
        )}
      >
        <SheetHeader className="p-0">
          <SheetTitle>
            <span className="text-title-md text-foreground">{copy.persona.title}</span>
          </SheetTitle>
          <SheetDescription>{copy.persona.description}</SheetDescription>
        </SheetHeader>
        <PersonaPanel {...panelProps} />
      </SheetContent>
    </Sheet>
  )
}
