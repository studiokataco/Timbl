"use client"

import { useId } from "react"
import { CircleAlert } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AgenticCard, type AgenticCardProps } from "../primitives/agentic-card"
import { usePrototype } from "../prototype-context"
import type { BriefChannels, BriefFields, BriefObjective, BriefVolume, CardStatus } from "../types"

export type BriefCardProps = {
  brief: BriefFields
  status: CardStatus
  onEdit: (patch: Partial<BriefFields>) => void
  onCreate: () => void
  onDebate: () => void
  error?: AgenticCardProps["error"]
  cap?: AgenticCardProps["cap"]
  disabled?: boolean
  disabledReason?: string
}

const OBJECTIVES: BriefObjective[] = ["awareness", "engagement", "leads"]
const CHANNELS: BriefChannels[] = ["ig_li", "ig", "li", "ig_li_x"]
const VOLUMES: BriefVolume[] = ["three_with_reel", "five_two_reels", "three_with_carousel"]

export function BriefCard({
  brief,
  status,
  onEdit,
  onCreate,
  onDebate,
  error,
  cap,
  disabled,
  disabledReason,
}: BriefCardProps): React.JSX.Element {
  const { copy } = usePrototype()
  const c = copy.cards.brief
  const baseId = useId()
  const errId = `${baseId}-err`
  const nameInvalid = brief.campaignName.trim().length < 2

  const objItems = OBJECTIVES.map((value) => ({ value, label: c.objectives[value] }))
  const chanItems = CHANNELS.map((value) => ({ value, label: c.channels[value] }))
  const volItems = VOLUMES.map((value) => ({ value, label: c.volume[value] }))

  return (
    <AgenticCard
      id="brief"
      meta={copy.canvas.meta.brief}
      title={c.title}
      status={status}
      disabled={disabled}
      disabledReason={disabledReason}
      streamingLabel={c.streaming}
      empty={{ title: c.empty }}
      error={error}
      cap={cap}
      summary={status === "done" ? c.done(brief.campaignName) : undefined}
      primary={
        status === "ready" || status === "needs_you"
          ? { label: c.primary, onClick: onCreate, disabled: nameInvalid, disabledReason: c.nameRequired }
          : undefined
      }
      secondary={status === "ready" || status === "needs_you" ? { label: c.secondary, onClick: onDebate } : undefined}
      figmaName="BriefCard"
    >
      <div className="grid grid-cols-1 gap-4 @xl/card:grid-cols-2">
        <div className="flex flex-col gap-1.5 @xl/card:col-span-2">
          <Label htmlFor={`${baseId}-name`}>{c.labels.name}</Label>
          <Input
            id={`${baseId}-name`}
            value={brief.campaignName}
            aria-invalid={nameInvalid}
            aria-describedby={nameInvalid ? errId : undefined}
            onChange={(e) => onEdit({ campaignName: e.target.value })}
          />
          {nameInvalid ? (
            <p id={errId} className="flex items-center gap-1.5 text-caption text-foreground">
              <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
              <span>{c.nameRequired}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${baseId}-obj`}>{c.labels.objective}</Label>
          <Select items={objItems} value={brief.objective} onValueChange={(v) => v && onEdit({ objective: v as BriefObjective })}>
            <SelectTrigger id={`${baseId}-obj`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((k) => (
                <SelectItem key={k} value={k}>
                  {c.objectives[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${baseId}-start`}>{c.labels.start}</Label>
          <Input
            id={`${baseId}-start`}
            type="date"
            value={brief.startDate}
            onChange={(e) => onEdit({ startDate: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${baseId}-chan`}>{c.labels.channels}</Label>
          <Select items={chanItems} value={brief.channels} onValueChange={(v) => v && onEdit({ channels: v as BriefChannels })}>
            <SelectTrigger id={`${baseId}-chan`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((k) => (
                <SelectItem key={k} value={k}>
                  {c.channels[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${baseId}-vol`}>{c.labels.volume}</Label>
          <Select items={volItems} value={brief.volume} onValueChange={(v) => v && onEdit({ volume: v as BriefVolume })}>
            <SelectTrigger id={`${baseId}-vol`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOLUMES.map((k) => (
                <SelectItem key={k} value={k}>
                  {c.volume[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 rounded-lg bg-muted/60 px-3 py-2 @xl/card:col-span-2">
          <span className="text-caption font-medium text-muted-foreground">{c.labels.assumptions}</span>
          <span className="text-body-sm text-foreground">{c.assumptions(c.channels[brief.channels])}</span>
        </div>
      </div>
    </AgenticCard>
  )
}
