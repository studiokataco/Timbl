"use client"

import { useState, useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AGENT_PROVIDER_LABELS, labelOr } from "@/lib/labels/enums"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  listAgentConfigs,
  toggleAgent,
  updateAgentConfig,
} from "@/lib/actions/agent-configs"
import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { AgentChat } from "@/components/agents/agent-chat"

interface Props {
  initial: AgentConfig[]
}

export function AgentsClient({ initial }: Props) {
  const queryClient = useQueryClient()
  const { data: configs = initial } = useQuery({
    queryKey: ["agent-configs"],
    queryFn: () => listAgentConfigs(),
    initialData: initial,
  })

  const [editing, setEditing] = useState<AgentConfig | null>(null)
  const [testingAgent, setTestingAgent] = useState<string | null>(null)

  return (
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              <Th className="w-1/4">Agent</Th>
              <Th>Role</Th>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th className="text-right">Enabled</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {configs.map((cfg) => (
              <Row
                key={cfg.id}
                config={cfg}
                onEdit={() => setEditing(cfg)}
                onTest={() => setTestingAgent(cfg.name)}
                onToggle={async (enabled) => {
                  const res = await toggleAgent({ name: cfg.name, enabled })
                  if (res.ok) {
                    queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
                  } else {
                    toast.error("Toggle failed", { description: res.error })
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <EditSheet
        config={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["agent-configs"] })
          setEditing(null)
        }}
      />

      <Sheet
        open={!!testingAgent}
        onOpenChange={(open) => {
          if (!open) setTestingAgent(null)
        }}
      >
        <SheetContent
          side="right"
          className="!w-full sm:!max-w-2xl flex flex-col p-0"
        >
          <SheetHeader className="px-4 sm:px-6 py-3 border-b border-border">
            <SheetTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4" aria-hidden /> Test run · {testingAgent}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Streams a one-off run against {testingAgent}. Nothing is persisted beyond the normal session log.
            </SheetDescription>
          </SheetHeader>
          {testingAgent && (
            <div className="flex-1 min-h-0">
              <AgentChat
                agentName={testingAgent}
                intro={`Try anything - this is a sandboxed manual run of the "${testingAgent}" agent.`}
                placeholder="Type a test prompt…"
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-[11px] uppercase tracking-wider font-medium ${className ?? ""}`}
    >
      {children}
    </th>
  )
}

function Row({
  config,
  onEdit,
  onTest,
  onToggle,
}: {
  config: AgentConfig
  onEdit: () => void
  onTest: () => void
  onToggle: (enabled: boolean) => void
}) {
  return (
    <tr className="border-t border-border last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{config.name}</span>
          {config.description && (
            <span className="text-xs text-muted-foreground line-clamp-2">
              {config.description}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <Badge variant="outline" className="text-xs capitalize">
          {config.role}
        </Badge>
      </td>
      <td className="px-3 py-2.5 capitalize">{config.provider}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{config.model}</td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => onToggle(!config.enabled)}
          className={`inline-flex items-center h-5 w-9 rounded-full transition-colors ${
            config.enabled ? "bg-foreground" : "bg-muted"
          }`}
          aria-label={`Toggle ${config.name}`}
        >
          <span
            aria-hidden
            className={`size-4 rounded-full bg-background transition-transform ${
              config.enabled ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" onClick={onTest}>
            <Sparkles className="size-3.5" aria-hidden /> Test run
          </Button>
        </div>
      </td>
    </tr>
  )
}

function EditSheet({
  config,
  onClose,
  onSaved,
}: {
  config: AgentConfig | null
  onClose: () => void
  onSaved: () => void
}) {
  const [provider, setProvider] = useState<AgentConfig["provider"]>(
    config?.provider ?? "gemini",
  )
  const [model, setModel] = useState(config?.model ?? "")
  const [temperature, setTemperature] = useState<number>(
    config?.temperature ?? 0.5,
  )
  const [systemPrompt, setSystemPrompt] = useState(config?.systemPrompt ?? "")
  const [schedule, setSchedule] = useState<string>(config?.schedule ?? "")
  const [pending, startTransition] = useTransition()

  /* Re-sync local state when a different config is opened. */
  if (config && config.id !== model + "::" + provider /* sentinel */) {
    /* noop - values seeded above via initial useState */
  }

  return (
    <Sheet
      open={!!config}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent side="right" className="!w-full sm:!max-w-xl overflow-y-auto">
        {config && (
          <>
            <SheetHeader>
              <SheetTitle>Edit {config.name}</SheetTitle>
              <SheetDescription className="text-xs">
                Changes apply on the next run. Existing in-flight runs continue with their previous configuration.
              </SheetDescription>
            </SheetHeader>
            <form
              className="space-y-4 mt-4"
              onSubmit={(e) => {
                e.preventDefault()
                startTransition(async () => {
                  const res = await updateAgentConfig({
                    name: config.name,
                    patch: {
                      provider,
                      model,
                      temperature,
                      systemPrompt,
                      schedule: schedule || undefined,
                    },
                  })
                  if (res.ok) {
                    toast.success(`Saved ${config.name}`)
                    onSaved()
                  } else {
                    toast.error("Save failed", { description: res.error })
                  }
                })
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={provider}
                    onValueChange={(v) => setProvider(v as AgentConfig["provider"])}
                  >
                    <SelectTrigger id="provider">
                      <SelectValue>
                        {(v) => labelOr(AGENT_PROVIDER_LABELS, v)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini">
                        {AGENT_PROVIDER_LABELS.gemini}
                      </SelectItem>
                      <SelectItem value="anthropic">
                        {AGENT_PROVIDER_LABELS.anthropic}
                      </SelectItem>
                      <SelectItem value="mock">
                        {AGENT_PROVIDER_LABELS.mock}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={
                      provider === "anthropic"
                        ? "claude-sonnet-4-6"
                        : "gemini-2.5-flash"
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="schedule">Schedule (cron)</Label>
                  <Input
                    id="schedule"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="0 6 * * *"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="systemPrompt">System prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={14}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  Save
                </Button>
              </div>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
