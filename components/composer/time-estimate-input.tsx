"use client"

import { useRef, useState } from "react"
import { parseTimeEstimate, formatTimeEstimate } from "@/lib/post-time-estimate"

interface TimeEstimateInputProps {
  value: number | undefined
  onSave: (minutes: number | undefined) => void
  disabled?: boolean
}

export function TimeEstimateInput({ value, onSave, disabled }: TimeEstimateInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState("")
  const prevValue = useRef(value)

  function handleFocus() {
    prevValue.current = value
    setDraft(value !== undefined ? formatTimeEstimate(value) : "")
    setFocused(true)
  }

  function handleBlur() {
    setFocused(false)
    if (draft.trim() === "") {
      onSave(undefined)
      return
    }
    const parsed = parseTimeEstimate(draft)
    if (parsed !== null) {
      onSave(parsed)
    } else {
      onSave(prevValue.current)
    }
    setDraft("")
  }

  const displayValue = focused
    ? draft
    : value !== undefined
    ? formatTimeEstimate(value)
    : ""

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder="e.g. 2h 30m"
        className="text-sm border border-input rounded-md px-3 py-1.5 bg-transparent outline-none focus:ring-1 focus:ring-ring w-full disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground">Changes are automatically saved</p>
    </div>
  )
}
