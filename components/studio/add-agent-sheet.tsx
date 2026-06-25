"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  ArrowUpRight,
  ChevronDown,
  Loader2,
  Lock,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  BOUTIQUE_TEMPLATES,
  type AgentTemplate,
} from "@/lib/agents/template-catalog"
import { MODEL_SUGGESTIONS, modelLabel } from "@/lib/agents/provider-catalog"
import {
  createAgentConfig,
  deleteAgentConfig,
  getAgentTemplate,
  toggleAgent,
} from "@/lib/actions/agent-configs"
import { Switch } from "@/components/ui/switch"
import type { AgentConfig } from "@/lib/schemas/agentConfig"
import { usePlanFeatures } from "@/lib/plans/client"
import { stageForAgent, STAGES, type Stage } from "./stage-map"

/*
 * Sheet for installing a boutique agent template into the current org.
 *
 * Source of truth is BOUTIQUE_TEMPLATES (the infra/config agents are
 * excluded by the `boutique` flag in lib/agents/defaults.ts). Tier gates:
 * Free sees an upgrade wall, Studio/Agency see a quota meter, Scale is
 * unlimited with a custom-agent footnote. Enforcement is server-side in
 * createAgentConfig -> requireAgentCapacity; this UI only mirrors it.
 */

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  installedAgents: AgentConfig[]
}

export function AddAgentSheet({ open, onOpenChange, installedAgents }: Props) {
  const planFeatures = usePlanFeatures()

  const boutiqueNames = new Set(BOUTIQUE_TEMPLATES.map((t) => t.name))
  const configByName = new Map(installedAgents.map((a) => [a.name, a]))
  /* Capacity is measured in agents switched ON. Disabling frees a slot, so
   * the count and the gate both track `enabled`, not doc existence. */
  const activeCount = installedAgents.filter(
    (a) => boutiqueNames.has(a.name) && a.enabled,
  ).length

  const catalogTotal = BOUTIQUE_TEMPLATES.length
  const limit = planFeatures.quotas.agents
  const isFree = limit === 0
  const isUnlimited = limit === null
  /* What this plan can actually run today is bounded by the catalog, not the
   * raw tier cap - showing "5 / 20" when only 8 agents exist reads as broken.
   * The denominator is the real ceiling the user can reach. */
  const available = isUnlimited ? catalogTotal : Math.min(limit, catalogTotal)
  const planCapsBelowCatalog = !isUnlimited && limit < catalogTotal
  const atCap = activeCount >= available
  const pct = available > 0 ? Math.min(100, (activeCount / available) * 100) : 0

  const grouped: Record<Stage, AgentTemplate[]> = {
    PLAN: [],
    DRAFT: [],
    REVIEW: [],
    SCHEDULE: [],
    GATE: [],
    CONFIG: [],
    OTHER: [],
  }
  for (const t of BOUTIQUE_TEMPLATES) grouped[stageForAgent(t.name)].push(t)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 overflow-hidden flex flex-col gap-0 bg-background text-foreground"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/70 space-y-3.5">
          <div className="space-y-1">
            <SheetTitle className="text-base">Add agent</SheetTitle>
            <SheetDescription className="text-[13px] leading-relaxed text-muted-foreground">
              Pick an agent to add to your workspace.
            </SheetDescription>
          </div>

          {!isFree && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground tabular-nums">
                    {activeCount}
                  </span>{" "}
                  of {available} active
                </span>
                {planCapsBelowCatalog && atCap && (
                  <a
                    href="/settings/billing"
                    className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
                  >
                    Upgrade for more
                  </a>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    atCap && planCapsBelowCatalog
                      ? "bg-amber-500"
                      : "bg-foreground/80",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </SheetHeader>

        {isFree ? (
          <FreeWall />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {STAGES.map((stage) => {
              const items = grouped[stage]
              if (items.length === 0) return null
              return (
                <section key={stage}>
                  <h4 className="sticky top-0 z-10 bg-background/95 backdrop-blur px-5 pt-4 pb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70">
                    {stage}
                  </h4>
                  <ul>
                    {items.map((t) => (
                      <TemplateRow
                        key={t.name}
                        template={t}
                        config={configByName.get(t.name)}
                        atCap={atCap}
                        canUpgrade={planCapsBelowCatalog}
                        onInstalled={() => onOpenChange(false)}
                      />
                    ))}
                  </ul>
                </section>
              )
            })}

            {isUnlimited && (
              <div className="m-4 rounded-xl border border-dashed border-border p-4 text-center">
                <p className="text-[13px] font-medium">Want a custom agent?</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Enterprise plans can have agents built to order. Talk to us.
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function FreeWall() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-foreground/10 blur-xl" />
        <div className="relative grid size-14 place-items-center rounded-2xl bg-secondary ring-1 ring-border">
          <Sparkles className="size-6 text-foreground/70" />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-[15px] font-medium">Agents are a Studio feature</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground max-w-[17rem]">
          Upgrade to add AI agents that help plan, draft, and schedule your
          posts.
        </p>
      </div>
      <a
        href="/settings/billing"
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        View plans
        <ArrowUpRight className="size-3.5" />
      </a>
    </div>
  )
}

function TemplateRow({
  template,
  config,
  atCap,
  canUpgrade,
  onInstalled,
}: {
  template: AgentTemplate
  config: AgentConfig | undefined
  atCap: boolean
  canUpgrade: boolean
  onInstalled: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [description, setDescription] = useState(template.description)
  const [model, setModel] = useState(template.model)
  const [temperature, setTemperature] = useState<number>(template.temperature)
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null)
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null)
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const installed = config !== undefined
  const enabled = config?.enabled ?? false
  /* Can't switch this one on - no free slot. Only matters for off agents. */
  const blockedEnable = atCap && !enabled
  const label = template.label ?? template.name

  const modelOptions = Array.from(
    new Set([template.model, ...(MODEL_SUGGESTIONS[template.provider] ?? [])]),
  )

  const changes: string[] = []
  if (description.trim() !== template.description.trim()) changes.push("Description")
  if (model !== template.model) changes.push("Model")
  if (temperature !== template.temperature) changes.push("Temperature")
  if (
    originalPrompt !== null &&
    systemPrompt !== null &&
    systemPrompt.trim() !== originalPrompt.trim()
  ) {
    changes.push("System prompt")
  }
  const hasOverrides = changes.length > 0

  async function expand() {
    setOpen((prev) => !prev)
    if (!systemPrompt && !installed) {
      setLoadingPrompt(true)
      try {
        const full = await getAgentTemplate(template.name)
        if (full) {
          setSystemPrompt(full.systemPrompt)
          setOriginalPrompt(full.systemPrompt)
        }
      } finally {
        setLoadingPrompt(false)
      }
    }
  }

  function resetFields() {
    setDescription(template.description)
    setModel(template.model)
    setTemperature(template.temperature)
    setSystemPrompt(originalPrompt)
  }

  function install(overrides?: {
    description?: string
    model?: string
    temperature?: number
    systemPrompt?: string
  }) {
    startTransition(async () => {
      const res = await createAgentConfig({ name: template.name, overrides })
      if (res.ok) {
        toast.success(`${template.label ?? template.name} installed`)
        queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
        router.refresh()
        onInstalled()
      } else {
        toast.error(
          res.error === "already_exists" ? "Already installed" : "Install failed",
          { description: res.error },
        )
      }
    })
  }

  function installWithOverrides() {
    setConfirmOpen(false)
    install({
      description: description.trim() || undefined,
      model: model.trim() || undefined,
      temperature,
      systemPrompt: systemPrompt?.trim() || undefined,
    })
  }

  function onCustomizeInstall() {
    if (hasOverrides) setConfirmOpen(true)
    else install()
  }

  function setEnabled(next: boolean) {
    startTransition(async () => {
      const res = await toggleAgent({ name: template.name, enabled: next })
      if (res.ok) {
        toast.success(next ? `${label} switched on` : `${label} switched off`)
        queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
        router.refresh()
      } else {
        toast.error(
          next ? "Could not switch on" : "Could not switch off",
          { description: res.error },
        )
      }
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteAgentConfig({ name: template.name })
      if (res.ok) {
        toast.success(`${template.label ?? template.name} removed`)
        queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
        router.refresh()
        setRemoveOpen(false)
      } else {
        toast.error("Could not remove agent", { description: res.error })
      }
    })
  }

  return (
    <li className="border-b border-border/50 last:border-0">
      <div
        className={cn(
          "group flex items-start gap-3 px-5 py-3.5 transition-colors",
          !installed && !blockedEnable && "hover:bg-secondary/40",
          !installed && blockedEnable && "opacity-60",
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {template.label ?? template.name}
            </span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            {template.tagline ?? template.description}
          </p>
          {!installed && !blockedEnable && (
            <button
              type="button"
              onClick={expand}
              aria-expanded={open}
              className="mt-2 inline-flex items-center gap-1 text-[12px] text-muted-foreground/80 hover:text-foreground transition-colors"
            >
              <Settings2 className="size-3.5" />
              Customize
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
          )}
        </div>

        <div className="shrink-0 pt-0.5">
          {installed ? (
            <div className="flex items-center gap-2">
              {pending && (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              )}
              {!enabled && blockedEnable && canUpgrade && (
                <a
                  href="/settings/billing"
                  className="text-[12px] font-medium text-foreground underline underline-offset-2 hover:no-underline"
                >
                  Upgrade
                </a>
              )}
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={pending || blockedEnable}
                aria-label={enabled ? `Switch off ${label}` : `Switch on ${label}`}
              />
              {!enabled && (
                <button
                  type="button"
                  onClick={() => setRemoveOpen(true)}
                  title="Remove agent"
                  className="grid size-7 place-items-center rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  <span className="sr-only">Remove {label}</span>
                </button>
              )}
            </div>
          ) : blockedEnable ? (
            <a
              href="/settings/billing"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground underline underline-offset-2 hover:no-underline"
            >
              <Lock className="size-3.5" />
              Upgrade
            </a>
          ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => install()}
              className="h-8 rounded-full px-3.5 text-[13px]"
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Install
            </Button>
          )}
        </div>
      </div>

      {open && !installed && (
        <div className="px-5 pb-4 pt-1 flex flex-col gap-3">
          <Field label="Description">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Model">
            <Select
              value={model}
              onValueChange={(v) => setModel(v ?? template.model)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {modelLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={`Temperature - ${temperatureLabel(temperature)} (${temperature.toFixed(1)})`}
          >
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-foreground cursor-pointer"
              aria-label="Temperature"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/70">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </Field>
          <Field label="System prompt">
            {loadingPrompt ? (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-3">
                <Loader2 className="size-3.5 animate-spin" /> Loading...
              </div>
            ) : (
              <Textarea
                rows={8}
                value={systemPrompt ?? ""}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="font-mono text-[12px]"
              />
            )}
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasOverrides || pending}
              onClick={resetFields}
            >
              Reset
            </Button>
            <Button size="sm" disabled={pending} onClick={onCustomizeInstall}>
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Install
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Install with custom settings?</DialogTitle>
            <DialogDescription>
              You changed {formatList(changes)} from the recommended defaults.
              You can always edit this later in the agent&apos;s settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={pending} onClick={installWithOverrides}>
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Install anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {template.label ?? template.name}?</DialogTitle>
            <DialogDescription>
              This removes the agent and any settings you customized. You can
              reinstall it any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={remove}
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}

function temperatureLabel(t: number): string {
  if (t <= 0.3) return "Precise"
  if (t <= 0.7) return "Balanced"
  if (t <= 1.1) return "Creative"
  return "Experimental"
}

function formatList(items: string[]): string {
  const lower = items.map((s) => s.toLowerCase())
  if (lower.length <= 1) return lower[0] ?? ""
  if (lower.length === 2) return `${lower[0]} and ${lower[1]}`
  return `${lower.slice(0, -1).join(", ")}, and ${lower[lower.length - 1]}`
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
