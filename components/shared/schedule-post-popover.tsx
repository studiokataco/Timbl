"use client"

import { useId, useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Props = {
  onConfirm: (scheduledDate: string, scheduledTime?: string) => void
  initialDate?: string
  pending?: boolean
  triggerVariant?: "outline" | "ghost"
  align?: "start" | "center" | "end"
}

/*
 * Minimal date + optional-time picker for scheduling an idea directly,
 * without the full composer round-trip. The caller owns the mutation -
 * this component only collects the slot and reports it via onConfirm.
 */
export function SchedulePostPopover({
  onConfirm,
  initialDate,
  pending,
  triggerVariant = "outline",
  align = "end",
}: Props) {
  const timeId = useId()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<Date | null>(null)
  const [time, setTime] = useState("")

  const selected = date ?? safeParse(initialDate) ?? new Date()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setDate(null)
      setTime("")
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant={triggerVariant}
            disabled={pending}
            aria-label="Schedule"
          />
        }
      >
        <CalendarClock aria-hidden className="size-3.5" />
        Schedule
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align={align}
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) setDate(d)
          }}
        />
        <div className="mt-2 flex flex-col gap-1.5">
          <Label htmlFor={timeId} className="text-xs">
            Time (optional)
          </Label>
          <Input
            id={timeId}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <Button
          className="mt-3 w-full"
          size="sm"
          disabled={pending}
          onClick={() => {
            setOpen(false)
            onConfirm(format(selected, "yyyy-MM-dd"), time || undefined)
          }}
        >
          Schedule for {format(selected, "EEE d MMM")}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function safeParse(iso?: string): Date | null {
  if (!iso) return null
  const d = parseISO(iso)
  return Number.isNaN(d.getTime()) ? null : d
}
