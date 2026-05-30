"use client"

import { useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  AGENT_TEMPLATES,
  type AgentTemplate,
} from "@/lib/agents/template-catalog"
import {
  createAgentConfig,
  getAgentTemplate,
} from "@/lib/actions/agent-configs"
import type { AgentConfig } from "@/lib/schemas/agentConfig"
import { stageForAgent, STAGES, type Stage } from "./stage-map"
import { PROVIDER_TONE } from "./status-tone"

/*
 * Sheet for installing one of the 13 known agent templates into the current
 * org. Each row shows install state; expanding "Customize" reveals override
 * fields (description / model / temperature / systemPrompt). The full prompt
 * is fetched on demand to keep the page bundle small.
 */

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  installedAgents: AgentConfig[]
}

export function AddAgentSheet({ open, onOpenChange, installedAgents }: Props) {
  const installedNames = new Set(installedAgents.map((a) => a.name))

  const grouped: Record<Stage, AgentTemplate[]> = {
    PLAN: [],
    DRAFT: [],
    REVIEW: [],
    SCHEDULE: [],
    GATE: [],
    CONFIG: [],
    OTHER: [],
  }
  for (const t of AGENT_TEMPLATES) grouped[stageForAgent(t.name)].push(t)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 overflow-hidden flex flex-col bg-background text-foreground"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle>Add agent</SheetTitle>
          <SheetDescription className="text-[13px] text-muted-foreground">
            Install one of the built-in agent templates. Customize the prompt,
            model, or temperature before installing if you like.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-5">
          {STAGES.map((stage) => {
            const items = grouped[stage]
            if (items.length === 0) return null
            return (
              <section key={stage} className="flex flex-col gap-2">
                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground px-2">
                  {stage}
                </h4>
                <ul className="flex flex-col gap-1.5">
                  {items.map((t) => (
                    <li key={t.name}>
                      <TemplateRow
                        template={t}
                        installed={installedNames.has(t.name)}
                        onInstalled={() => onOpenChange(false)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TemplateRow({
  template,
  installed,
  onInstalled,
}: {
  template: AgentTemplate
  installed: boolean
  onInstalled: () => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  // Customize form state - loaded lazily when the panel opens.
  const [description, setDescription] = useState(template.description)
  const [model, setModel] = useState(template.model)
  const [temperature, setTemperature] = useState<number>(template.temperature)
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null)
  const [loadingPrompt, setLoadingPrompt] = useState(false)

  async function expand() {
    setOpen((prev) => !prev)
    if (!systemPrompt && !installed) {
      setLoadingPrompt(true)
      try {
        const full = await getAgentTemplate(template.name)
        if (full) setSystemPrompt(full.systemPrompt)
      } finally {
        setLoadingPrompt(false)
      }
    }
  }

  function install(overrides?: {
    description?: string
    model?: string
    temperature?: number
    systemPrompt?: string
  }) {
    startTransition(async () => {
      const res = await createAgentConfig({
        name: template.name,
        overrides,
      })
      if (res.ok) {
        toast.success(`Installed ${template.name}`)
        queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
        router.refresh()
        onInstalled()
      } else {
        toast.error(res.error === "already_exists"
          ? "Already installed"
          : "Install failed", {
          description: res.error,
        })
      }
    })
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-background",
        installed && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-foreground truncate">
              {template.name}
            </span>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wide rounded-pill px-1.5 py-0.5 shrink-0",
                PROVIDER_TONE[template.provider] ??
                  "bg-secondary text-muted-foreground",
              )}
            >
              {template.provider}
            </span>
            {installed && (
              <Badge variant="secondary" className="text-[10px]">
                Installed
              </Badge>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!installed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={expand}
              className="h-8 px-2"
              aria-expanded={open}
            >
              {open ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              <span className="ml-1">Customize</span>
            </Button>
          )}
          <Button
            size="sm"
            disabled={installed || pending}
            onClick={() => install()}
            className="h-8"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            <span className="ml-1">{installed ? "Installed" : "Install"}</span>
          </Button>
        </div>
      </div>

      {open && !installed && (
        <div className="border-t border-border px-3 py-3 flex flex-col gap-3 bg-secondary/30">
          <Field label="Description">
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </Field>
            <Field label="Temperature">
              <Input
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={temperature}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next)) setTemperature(next)
                }}
              />
            </Field>
          </div>
          <Field label="System prompt">
            {loadingPrompt ? (
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-3">
                <Loader2 className="size-3.5 animate-spin" /> Loading…
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
              onClick={() => {
                setDescription(template.description)
                setModel(template.model)
                setTemperature(template.temperature)
                getAgentTemplate(template.name).then((full) => {
                  if (full) setSystemPrompt(full.systemPrompt)
                })
              }}
            >
              Reset
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                install({
                  description: description.trim() || undefined,
                  model: model.trim() || undefined,
                  temperature,
                  systemPrompt: systemPrompt?.trim() || undefined,
                })
              }
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span className="ml-1">Install with overrides</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
