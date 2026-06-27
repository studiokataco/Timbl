"use client"

import { Check, Flag } from "lucide-react"
import { cn } from "@/lib/utils"

type Priority = "urgent" | "high" | "normal" | "low"

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "#ef4444" },
  { value: "high", label: "High", color: "#f59e0b" },
  { value: "normal", label: "Normal", color: "#3b82f6" },
  { value: "low", label: "Low", color: "#94a3b8" },
]

interface PriorityPickerProps {
  postId: string
  value: Priority | undefined
  onSave: (priority: Priority | undefined) => void
  disabled?: boolean
}

export function PriorityPicker({ value, onSave, disabled }: PriorityPickerProps) {
  return (
    <div className="flex flex-col gap-0.5 p-1 min-w-[140px]">
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          disabled={disabled}
          onClick={() => onSave(p.value)}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: p.color }} />
          <span className="flex-1 text-left">{p.label}</span>
          {value === p.value && <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </button>
      ))}
      <button
        disabled={disabled}
        onClick={() => onSave(undefined)}
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-sm hover:bg-muted/50 transition-colors disabled:opacity-50 text-muted-foreground",
          "border-t border-border mt-0.5 pt-1.5"
        )}
      >
        <Flag className="h-3.5 w-3.5 shrink-0 opacity-40" />
        <span className="flex-1 text-left">None</span>
        {value === undefined && <Check className="h-3.5 w-3.5 shrink-0" />}
      </button>
    </div>
  )
}

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#ef4444" },
  high: { label: "High", color: "#f59e0b" },
  normal: { label: "Normal", color: "#3b82f6" },
  low: { label: "Low", color: "#94a3b8" },
}

export function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null
  const meta = PRIORITY_META[priority as Priority]
  if (!meta) return null

  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
      <span style={{ color: meta.color }}>{meta.label}</span>
    </span>
  )
}
