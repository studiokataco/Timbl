"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  applyOnboardingSelections,
  completeOnboarding,
  saveOnboardingProfile,
} from "@/lib/actions/onboarding"
import {
  getIndustryDefaults,
  type IndustryId,
} from "@/lib/onboarding/industry-defaults"
import { cn } from "@/lib/utils"

/*
 * Single-page step machine. We deliberately don't use sub-routes:
 *
 *   - Each step's data is only persisted at well-defined points
 *     (profile after step 1, selections after step 4) so back/forward
 *     stays predictable.
 *   - The (onboarding) layout is shell-less, so per-step transitions
 *     in-place feel snappier than a route push.
 *
 * Persistence model:
 *   step 1 → saveOnboardingProfile (industry/audience/tone)
 *   step 4 → applyOnboardingSelections (categories + agents)
 *   step 5 → applyOnboardingSelections (channels) + completeOnboarding
 */

type StepId = "profile" | "agents" | "categories" | "templates" | "channels"
const STEPS: { id: StepId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "agents", label: "Agents" },
  { id: "categories", label: "Categories" },
  { id: "templates", label: "Templates" },
  { id: "channels", label: "Channels" },
]

/* Agent catalog — kept here for v1 so the wizard can render without a
 * round-trip. When seeds/defaults.ts ships the full agent catalog this
 * list should be derived from it instead. */
const AGENT_CATALOG: { id: string; label: string; description: string }[] = [
  {
    id: "strategist",
    label: "Strategist",
    description: "Plans monthly themes and surfaces gaps in the calendar.",
  },
  {
    id: "drafter",
    label: "Drafter",
    description: "Writes post drafts from a brief or category cadence.",
  },
  {
    id: "researcher",
    label: "Researcher",
    description: "Finds trends, sources, and references for posts.",
  },
  {
    id: "approver",
    label: "Approver",
    description: "Reviews drafts and flags off-brand or risky content.",
  },
  {
    id: "awareness-researcher",
    label: "Awareness researcher",
    description: "Finds awareness days, observances, and cultural moments.",
  },
]

const CHANNEL_OPTIONS: { id: string; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X / Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
]

interface InitialProfile {
  industry?: string
  audience?: string
  tone?: string
  channels?: string[]
}

export function OnboardingWizard({
  initialProfile,
  industries,
}: {
  initialProfile: InitialProfile
  industries: { id: IndustryId; label: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activeStep, setActiveStep] = useState<StepId>("profile")
  const [skipped, setSkipped] = useState<Set<StepId>>(new Set())

  /* Form state — flat for simplicity. Each step writes its slice. */
  const [industry, setIndustry] = useState<string>(
    initialProfile.industry ?? "agency",
  )
  const [audience, setAudience] = useState(initialProfile.audience ?? "")
  const [tone, setTone] = useState(initialProfile.tone ?? "")

  const defaults = useMemo(() => getIndustryDefaults(industry), [industry])

  const [enabledAgents, setEnabledAgents] = useState<Set<string>>(
    () => new Set(defaults.suggestedAgents),
  )
  const [pickedCategories, setPickedCategories] = useState<Set<string>>(
    () => new Set(defaults.categories.map((c) => c.slug)),
  )
  const [enabledChannels, setEnabledChannels] = useState<Set<string>>(
    () => new Set(initialProfile.channels ?? ["instagram"]),
  )

  /* When the industry changes, refresh the suggested selections so users
   * who jump back to step 1 don't get stuck with the previous industry's
   * picks. */
  function onIndustryChange(value: string) {
    setIndustry(value)
    const next = getIndustryDefaults(value)
    setEnabledAgents(new Set(next.suggestedAgents))
    setPickedCategories(new Set(next.categories.map((c) => c.slug)))
    if (!tone) {
      /* Only adopt the tone hint when the user hasn't typed one — don't
       * stomp customizations. */
      setTone(next.toneHint)
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === activeStep)

  function goNext() {
    if (stepIndex < STEPS.length - 1) setActiveStep(STEPS[stepIndex + 1].id)
  }
  function goPrev() {
    if (stepIndex > 0) setActiveStep(STEPS[stepIndex - 1].id)
  }
  function skipCurrent() {
    setSkipped((s) => new Set(s).add(activeStep))
    goNext()
  }

  function saveProfile(thenNext: boolean) {
    if (!industry) {
      toast.error("Pick an industry to continue")
      return
    }
    startTransition(async () => {
      const result = await saveOnboardingProfile({
        industry,
        audience: audience || undefined,
        tone: tone || undefined,
      })
      if (!result.ok) {
        toast.error(result.error ?? "Could not save profile")
        return
      }
      if (thenNext) goNext()
    })
  }

  function persistSelectionsThen(after: "next" | "complete") {
    startTransition(async () => {
      const result = await applyOnboardingSelections({
        categorySlugs: [...pickedCategories],
        agentIds: [...enabledAgents],
        channels: [...enabledChannels],
      })
      if (!result.ok) {
        toast.error(result.error ?? "Could not save selections")
        return
      }
      if (after === "next") {
        goNext()
        return
      }
      const completed = await completeOnboarding({
        skippedSteps: [...skipped],
      })
      if (!completed.ok) {
        toast.error(completed.error ?? "Could not finish setup")
        return
      }
      toast.success("Setup complete")
      router.push("/")
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Sparkles className="size-4 text-foreground" />
          <span className="text-sm font-medium">Set up your workspace</span>
        </div>
      </header>

      <Stepper activeStep={activeStep} skipped={skipped} />

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl">
          {activeStep === "profile" ? (
            <ProfileStep
              industries={industries}
              industry={industry}
              onIndustryChange={onIndustryChange}
              audience={audience}
              onAudienceChange={setAudience}
              tone={tone}
              onToneChange={setTone}
              suggestedTone={defaults.toneHint}
            />
          ) : null}
          {activeStep === "agents" ? (
            <AgentsStep enabled={enabledAgents} onToggle={(id) => toggle(enabledAgents, id, setEnabledAgents)} />
          ) : null}
          {activeStep === "categories" ? (
            <CategoriesStep
              suggestions={defaults.categories}
              picked={pickedCategories}
              onToggle={(slug) => toggle(pickedCategories, slug, setPickedCategories)}
            />
          ) : null}
          {activeStep === "templates" ? (
            <TemplatesStep templateSlugs={defaults.templateSlugs} />
          ) : null}
          {activeStep === "channels" ? (
            <ChannelsStep
              enabled={enabledChannels}
              onToggle={(id) => toggle(enabledChannels, id, setEnabledChannels)}
            />
          ) : null}
        </div>
      </main>

      <footer className="border-t border-border bg-background px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={stepIndex === 0 || pending}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {activeStep !== "profile" && activeStep !== "channels" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={skipCurrent}
                disabled={pending}
              >
                Skip this step
              </Button>
            ) : null}
            {activeStep === "profile" ? (
              <Button size="sm" onClick={() => saveProfile(true)} disabled={pending}>
                Continue
                <ChevronRight className="size-4" />
              </Button>
            ) : activeStep === "channels" ? (
              <Button
                size="sm"
                onClick={() => persistSelectionsThen("complete")}
                disabled={pending}
              >
                {pending ? "Finishing…" : "Finish setup"}
              </Button>
            ) : activeStep === "categories" ? (
              <Button
                size="sm"
                onClick={() => persistSelectionsThen("next")}
                disabled={pending}
              >
                Save & continue
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={goNext} disabled={pending}>
                Continue
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

function toggle<T>(
  set: Set<T>,
  value: T,
  setter: (next: Set<T>) => void,
) {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  setter(next)
}

function Stepper({
  activeStep,
  skipped,
}: {
  activeStep: StepId
  skipped: Set<StepId>
}) {
  const activeIndex = STEPS.findIndex((s) => s.id === activeStep)
  return (
    <ol className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-4 text-xs">
      {STEPS.map((s, idx) => {
        const isActive = idx === activeIndex
        const isDone = idx < activeIndex
        const isSkipped = skipped.has(s.id)
        return (
          <li key={s.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-[10px] font-medium",
                isDone && !isSkipped && "bg-foreground text-background border-foreground",
                isActive && "border-foreground text-foreground",
                !isActive && !isDone && "border-border text-muted-foreground",
                isSkipped && "border-dashed",
              )}
            >
              {isDone && !isSkipped ? <Check className="size-3" /> : idx + 1}
            </span>
            <span
              className={cn(
                "truncate",
                isActive ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 ? (
              <span aria-hidden className="ml-1 h-px flex-1 bg-border" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function ProfileStep({
  industries,
  industry,
  onIndustryChange,
  audience,
  onAudienceChange,
  tone,
  onToneChange,
  suggestedTone,
}: {
  industries: { id: IndustryId; label: string }[]
  industry: string
  onIndustryChange: (v: string) => void
  audience: string
  onAudienceChange: (v: string) => void
  tone: string
  onToneChange: (v: string) => void
  suggestedTone: string
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-medium">Tell us about your work</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll tailor categories, templates, and agent suggestions to your
          industry.
        </p>
      </header>

      <div className="space-y-1.5">
        <Label>What kind of work is this for?</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {industries.map((opt) => {
            const selected = opt.id === industry
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onIndustryChange(opt.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                  selected
                    ? "border-foreground bg-muted/30"
                    : "border-border hover:border-foreground/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-foreground bg-foreground" : "border-border",
                  )}
                >
                  {selected ? (
                    <Check className="size-2.5 text-background" />
                  ) : null}
                </span>
                <span className="text-sm">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onb-audience">Who&apos;s your audience? (optional)</Label>
        <Input
          id="onb-audience"
          placeholder="Independent agencies, in-house marketers, …"
          value={audience}
          onChange={(e) => onAudienceChange(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="onb-tone">Voice & tone (optional)</Label>
        <Textarea
          id="onb-tone"
          rows={3}
          placeholder={suggestedTone}
          value={tone}
          onChange={(e) => onToneChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Suggestion for this industry: <em>{suggestedTone}</em>
        </p>
      </div>
    </div>
  )
}

function AgentsStep({
  enabled,
  onToggle,
}: {
  enabled: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-medium">Pick your AI agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agents work in the background. Turn them on now or later in Settings.
        </p>
      </header>
      <ul className="grid gap-2">
        {AGENT_CATALOG.map((agent) => {
          const on = enabled.has(agent.id)
          return (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => onToggle(agent.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                  on ? "border-foreground bg-muted/30" : "border-border hover:border-foreground/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                    on ? "border-foreground bg-foreground" : "border-border",
                  )}
                >
                  {on ? <Check className="size-2.5 text-background" /> : null}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{agent.label}</div>
                  <p className="text-xs text-muted-foreground">{agent.description}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CategoriesStep({
  suggestions,
  picked,
  onToggle,
}: {
  suggestions: { slug: string; name: string; color: string; icon: string }[]
  picked: Set<string>
  onToggle: (slug: string) => void
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-medium">Choose starter categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You can rename, recolor, and add more in Settings → Categories.
        </p>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((cat) => {
          const on = picked.has(cat.slug)
          return (
            <li key={cat.slug}>
              <button
                type="button"
                onClick={() => onToggle(cat.slug)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                  on ? "border-foreground bg-muted/30" : "border-border hover:border-foreground/40",
                )}
              >
                <span
                  aria-hidden
                  className="size-5 shrink-0 rounded-full border border-border/60"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="flex-1 text-sm font-medium">{cat.name}</span>
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border",
                    on ? "border-foreground bg-foreground" : "border-border",
                  )}
                >
                  {on ? <Check className="size-2.5 text-background" /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TemplatesStep({ templateSlugs }: { templateSlugs: string[] }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-medium">Starter templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suggested templates for your industry. You&apos;ll be able to edit
          them in the composer.
        </p>
      </header>
      {templateSlugs.length > 0 ? (
        <ul className="space-y-2">
          {templateSlugs.map((slug) => (
            <li
              key={slug}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <span className="text-sm font-medium">{slug}</span>
              <Badge variant="outline">Suggested</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No templates curated for this industry yet. You can create your own
          later.
        </p>
      )}
    </div>
  )
}

function ChannelsStep({
  enabled,
  onToggle,
}: {
  enabled: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-medium">Which channels do you post to?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick what you care about — connecting accounts happens later.
        </p>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2">
        {CHANNEL_OPTIONS.map((ch) => {
          const on = enabled.has(ch.id)
          return (
            <li key={ch.id}>
              <button
                type="button"
                onClick={() => onToggle(ch.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                  on ? "border-foreground bg-muted/30" : "border-border hover:border-foreground/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border",
                    on ? "border-foreground bg-foreground" : "border-border",
                  )}
                >
                  {on ? <Check className="size-2.5 text-background" /> : null}
                </span>
                <span className="text-sm font-medium">{ch.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
