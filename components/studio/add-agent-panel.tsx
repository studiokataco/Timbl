"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowUpRight, ChevronRight, Clock, Loader2, Plus, Sparkles, Wrench, X } from "lucide-react"
import { toast } from "sonner"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import { BOUTIQUE_TEMPLATES, type AgentTemplate } from "@/lib/agents/template-catalog"
import { createAgentConfig, deleteAgentConfig, getAgentTemplate } from "@/lib/actions/agent-configs"
import { usePlanFeatures } from "@/lib/plans/client"
import { useMediaQuery } from "@/lib/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { getTool } from "./tool-catalog"
import { groupAgents, scheduleLabel } from "./agent-meta"
import { AgentGlyph } from "./bits"
import { DisclosureBody, DisclosureChevron, DisclosureTrigger, useRemembered } from "@/components/ui/disclosure"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: AgentConfig[]
  pending: string | null
  onToggle: (name: string, enabled: boolean) => void
  onOpenAgent: (name: string) => void
}

export function AddAgentPanel({ open, onOpenChange, agents, pending, onToggle, onOpenAgent }: Props) {
  const quotas = usePlanFeatures().quotas
  const wide = useMediaQuery("(min-width: 640px)")
  const [teamOpen, setTeamOpen] = useRemembered("add-team", false)
  const teamId = useId()

  const configByName = new Map(agents.map((a) => [a.name, a]))
  const ready = BOUTIQUE_TEMPLATES.filter((t) => !configByName.get(t.name)?.enabled)
  const team = BOUTIQUE_TEMPLATES.filter((t) => configByName.get(t.name)?.enabled)

  const showTeam = teamOpen || ready.length === 0
  const isFree = quotas.agents === 0
  const unlimited = quotas.agents == null
  const slots = unlimited ? BOUTIQUE_TEMPLATES.length : Math.min(quotas.agents ?? 0, BOUTIQUE_TEMPLATES.length)
  const canUpgrade = !unlimited && (quotas.agents ?? 0) < BOUTIQUE_TEMPLATES.length
  const atCap = team.length >= slots

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden bg-background p-0 text-foreground",
          wide ? "w-full sm:max-w-md" : "max-h-[90dvh] rounded-t-2xl",
        )}
      >
        {!wide && <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />}
        <SheetHeader className="space-y-0 border-b border-border px-5 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-[16px] font-semibold">Add an agent</SheetTitle>
              <SheetDescription className="mt-0.5 text-[13px] text-muted-foreground">
                Agents work in the background and ask you before anything ships.
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="-mr-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {!isFree && <SlotMeter used={team.length} slots={slots} unlimited={unlimited} warn={atCap && canUpgrade} />}
        </SheetHeader>

        {isFree ? (
          <FreeWall />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {atCap && ready.length > 0 && (
              <div className="mx-5 mt-4 flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[13px]">
                <p className="flex-1 text-foreground">
                  All slots are in use. Turn an agent off{canUpgrade ? " or upgrade" : ""} to add another.
                </p>
                {canUpgrade && (
                  <a href="/settings/billing" className="shrink-0 font-medium text-foreground underline underline-offset-4 hover:no-underline">
                    Upgrade
                  </a>
                )}
              </div>
            )}

            {ready.length === 0 ? (
              <p className="px-5 pt-6 text-[13px] text-muted-foreground">Every agent is already on your team.</p>
            ) : (
              groupAgents(ready).map((g) => (
                <div key={g.key} className="pt-4">
                  <p className="px-5 pb-1.5 text-[12px] font-medium text-muted-foreground">{g.label}</p>
                  <ul className="space-y-2 px-3">
                    {g.agents.map((t) => (
                      <li key={t.name}>
                        <CatalogRow
                          template={t}
                          config={configByName.get(t.name)}
                          blocked={atCap}
                          togglePending={pending === t.name}
                          onTurnOn={() => onToggle(t.name, true)}
                          onOpenAgent={() => {
                            onOpenChange(false)
                            onOpenAgent(t.name)
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}

            {team.length > 0 && (
              <div className="mx-5 mt-6 border-t border-border pt-3">
                <DisclosureTrigger
                  open={showTeam}
                  onOpenChange={setTeamOpen}
                  controls={teamId}
                  className="-mx-1.5 w-[calc(100%+0.75rem)] rounded-md px-1.5 py-1.5 text-[13px]"
                >
                  <span className="font-medium text-foreground">On your team</span>
                  <span className="tabular-nums text-muted-foreground">{team.length}</span>
                </DisclosureTrigger>
                <DisclosureBody id={teamId} open={showTeam}>
                  <ul className="mt-1">
                    {team.map((t) => (
                      <li key={t.name}>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenChange(false)
                            onOpenAgent(t.name)
                          }}
                          className="group flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <AgentGlyph name={t.name} size="sm" />
                          <span className="flex-1 truncate text-[13px] font-medium text-foreground">{t.label ?? t.name}</span>
                          <span className="text-[12px] text-muted-foreground">Manage</span>
                          <ChevronRight className="size-3.5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </DisclosureBody>
              </div>
            )}

            {unlimited && (
              <p className="mx-5 mt-6 text-[12px] text-muted-foreground">
                Need an agent that isn&rsquo;t here? Enterprise plans can have one built to order.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SlotMeter({ used, slots, unlimited, warn }: { used: number; slots: number; unlimited: boolean; warn: boolean }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{used}</span>
          {unlimited ? " agents on, no limit" : ` of ${slots} slots in use`}
        </span>
        {!unlimited && slots - used > 0 && (
          <span className="tabular-nums text-muted-foreground">{slots - used} free</span>
        )}
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i < used ? (warn ? "bg-amber-500" : "bg-foreground") : "bg-secondary",
            )}
          />
        ))}
      </div>
    </div>
  )
}

function CatalogRow({
  template,
  config,
  blocked,
  togglePending,
  onTurnOn,
  onOpenAgent,
}: {
  template: AgentTemplate
  config: AgentConfig | undefined
  blocked: boolean
  togglePending: boolean
  onTurnOn: () => void
  onOpenAgent: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const detailsId = useId()
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [instructions, setInstructions] = useState<string | null>(null)
  const [defaultInstructions, setDefaultInstructions] = useState<string | null>(null)
  const [temperature, setTemperature] = useState(template.temperature)
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const installed = config !== undefined
  const label = template.label ?? template.name
  const busy = pending || togglePending
  const schedule = scheduleLabel({
    schedule: template.schedule ?? null,
    triggers: { cron: !!template.schedule, manual: true, systemUserId: "" },
  })
  const tools = template.allowedTools.map((k) => getTool(k).title)

  async function startCustomizing() {
    setCustomizing(true)
    if (instructions != null) return
    setLoadingPrompt(true)
    try {
      const full = await getAgentTemplate(template.name)
      if (full) {
        setInstructions(full.systemPrompt)
        setDefaultInstructions(full.systemPrompt)
      }
    } finally {
      setLoadingPrompt(false)
    }
  }

  function add() {
    if (installed) return onTurnOn()
    const customized =
      customizing &&
      (temperature !== template.temperature ||
        (instructions != null && instructions.trim() !== (defaultInstructions ?? "").trim()))
    startTransition(async () => {
      const res = await createAgentConfig({
        name: template.name,
        overrides: customized
          ? { temperature, systemPrompt: instructions?.trim() || undefined }
          : undefined,
      })
      if (!res.ok) {
        toast.error(res.error === "already_exists" ? "Already added" : "Couldn't add agent", { description: res.error })
        return
      }
      toast.success(`${label} added`, { action: { label: "Open", onClick: onOpenAgent } })
      queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
      router.refresh()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteAgentConfig({ name: template.name })
      if (!res.ok) {
        toast.error("Couldn't remove agent", { description: res.error })
        return
      }
      toast.success(`${label} removed`)
      setRemoveOpen(false)
      queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
      router.refresh()
    })
  }

  return (
    <div className={cn("rounded-xl border border-border transition-colors", expanded && "bg-secondary/25")}>
      <div className="flex items-start gap-3 p-3">
        <AgentGlyph name={template.name} />
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((v) => !v)}
          className="group min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-[14px] font-medium text-foreground">{label}</span>
            {installed && <span className="text-[12px] text-muted-foreground">· off</span>}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
            {template.tagline ?? template.description}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              {schedule}
            </span>
            <span className="inline-flex items-center gap-1">
              <Wrench className="size-3" aria-hidden />
              {tools.length} {tools.length === 1 ? "tool" : "tools"}
            </span>
            <span className="inline-flex items-center gap-0.5 font-medium text-foreground/80">
              {expanded ? "Less" : "Details"}
              <DisclosureChevron open={expanded} className="size-3 text-current group-hover:text-current" />
            </span>
          </span>
        </button>
        {blocked ? (
          <span className="shrink-0 pt-1 text-[12px] text-muted-foreground">No slot</span>
        ) : (
          <Button size="sm" disabled={busy} onClick={add} className="shrink-0">
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
            {installed ? "Turn on" : "Add"}
          </Button>
        )}
      </div>

      <DisclosureBody id={detailsId} open={expanded} className="space-y-3 border-t border-border px-3 pb-3 pt-3 sm:pl-[3.75rem]">
        {tools.length > 0 && (
          <div>
            <p className="text-[12px] text-muted-foreground">It can</p>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {tools.map((t) => (
                <li key={t} className="rounded-md bg-secondary px-1.5 py-0.5 text-[12px] text-foreground">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {installed ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
            <button type="button" onClick={onOpenAgent} className="font-medium text-foreground underline-offset-4 hover:underline">
              Review its settings
            </button>
            <button
              type="button"
              onClick={() => setRemoveOpen(true)}
              className="text-muted-foreground underline-offset-4 hover:text-rose-600 hover:underline dark:hover:text-rose-400"
            >
              Remove from workspace
            </button>
          </div>
        ) : !customizing ? (
          <button
            type="button"
            onClick={startCustomizing}
            className="text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
          >
            Customize before adding
          </button>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="flex items-baseline justify-between text-[12px]">
                <span className="font-medium text-foreground">Creativity</span>
                <span className="text-muted-foreground">{creativity(temperature)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="mt-1.5 h-1.5 w-full cursor-pointer accent-foreground"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-foreground">Instructions</span>
              {loadingPrompt ? (
                <span className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading the default instructions
                </span>
              ) : (
                <Textarea
                  rows={6}
                  value={instructions ?? ""}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="mt-1.5 bg-background text-[13px] leading-relaxed"
                />
              )}
            </label>
            <button
              type="button"
              onClick={() => {
                setCustomizing(false)
                setTemperature(template.temperature)
                setInstructions(defaultInstructions)
              }}
              className="text-[12px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Use the defaults instead
            </button>
          </div>
        )}
      </DisclosureBody>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {label}?</DialogTitle>
            <DialogDescription>
              Its custom settings are deleted. You can add it again any time with the defaults.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" disabled={pending} onClick={remove}>
              {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function creativity(t: number): string {
  if (t <= 0.4) return "Precise"
  if (t <= 1.1) return "Balanced"
  return "Creative"
}

function FreeWall() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-border bg-secondary">
        <Sparkles className="size-5 text-foreground" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold text-foreground">Agents come with the Studio plan</p>
        <p className="max-w-[30ch] text-[13px] leading-relaxed text-muted-foreground">
          Add agents that plan, draft and schedule posts, with your approval at every step.
        </p>
      </div>
      <Button render={<a href="/settings/billing" />} nativeButton={false}>
        See plans
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}

