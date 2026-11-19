"use client"

import { useState } from "react"
import { LayoutGrid, MessagesSquare } from "lucide-react"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { useHomeChats } from "@/components/home/home-chats"

export type Mode = "timbl" | "interface"

export function ModeSwitch({
  value,
  onSwitch,
  compactClass = "sr-only @2xl/timbl:not-sr-only",
}: {
  value: Mode
  onSwitch: (mode: Mode) => void
  compactClass?: string
}) {
  const { copy, needsYouCount } = useHomeChats()
  const [mode, setMode] = useState<Mode>(value)
  return (
    <SegmentedTabs
      value={mode}
      onChange={(id) => {
        const next = id as Mode
        if (next === mode) return
        setMode(next)
        onSwitch(next)
      }}
      tabs={[
        {
          id: "timbl",
          label: (
            <>
              <MessagesSquare className="size-3.5" aria-hidden />
              <span className={compactClass}>{copy.assistant}</span>
              {value === "interface" && needsYouCount > 0 ? (
                <span className="flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-caption leading-4 text-primary-foreground tabular-nums">
                  <span className="sr-only">{`${copy.needsYou}: `}</span>
                  {needsYouCount}
                </span>
              ) : null}
            </>
          ),
        },
        {
          id: "interface",
          label: (
            <>
              <LayoutGrid className="size-3.5" aria-hidden />
              <span className={compactClass}>{copy.modeInterface}</span>
            </>
          ),
        },
      ]}
    />
  )
}
