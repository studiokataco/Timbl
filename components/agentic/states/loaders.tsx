"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { tw } from "../lib"
import { useAgenticMotion } from "../prototype-context"

type Mesh = "mint" | "tide" | "bloom" | "ember"

const DAYS = [
  ["Mon", "2"],
  ["Tue", "3"],
  ["Wed", "4"],
  ["Thu", "5"],
  ["Fri", "6"],
  ["Sat", "7"],
  ["Sun", "8"],
] as const

const HOURS = ["09:00", "10:00", "11:00", "12:00"] as const

const NAV = ["Calendar", "All posts", "Kanban", "Campaigns", "AI Studio", "Templates", "Awareness days"]

const PILLS: { day: number; hour: number; wide: boolean }[] = [
  { day: 0, hour: 0, wide: false },
  { day: 2, hour: 1, wide: true },
  { day: 3, hour: 2, wide: false },
  { day: 4, hour: 0, wide: true },
]

function useMeshLive(): string {
  const { reduced } = useAgenticMotion()
  return reduced ? "" : "timbl-mesh-live"
}

function Bone({ className, style, mesh = "mint" }: { className: string; style?: React.CSSProperties & { "--mesh-delay"?: string }; mesh?: Mesh }): React.JSX.Element {
  const live = useMeshLive()
  return <Skeleton className={tw("timbl-mesh animate-none", live, className)} data-mesh={mesh} style={style} />
}

function PreloadBar(): React.JSX.Element {
  const live = useMeshLive()
  return <div aria-hidden className={tw("timbl-mesh h-0.5 w-full", live)} data-mesh="tide" />
}

export function WeekSkeleton(): React.JSX.Element {
  return (
    <section aria-busy="true" className="relative flex flex-col gap-4 overflow-hidden bg-background p-4 text-foreground">
      <p className="sr-only">Loading the week</p>
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-title-sm">2-8 Nov</span>
          <Bone className="size-7" />
          <Bone className="size-7" />
          <Bone className="h-7 w-14" />
        </div>
        <Bone className="h-8 w-44" />
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-background/70">
        <div className="flex border-b border-border">
          <div className="w-14 shrink-0 border-r border-border" />
          {DAYS.map(([weekday, date]) => (
            <div key={weekday} className="flex h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 border-r border-border px-1.5 last:border-r-0">
              <div className="flex items-center gap-1">
                <span className="inline-flex size-5 items-center justify-center text-caption font-medium">{date}</span>
                <span className="truncate text-caption text-muted-foreground">{weekday}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="relative flex">
          <div className="flex w-14 shrink-0 flex-col border-r border-border">
            {HOURS.map((hour) => (
              <div key={hour} className="h-14 border-t border-border px-1.5 pt-1 text-right text-caption text-muted-foreground first:border-t-0">
                {hour}
              </div>
            ))}
          </div>
          <div className="relative flex flex-1">
            {DAYS.map(([weekday]) => (
              <div key={weekday} className="relative min-w-0 flex-1 border-r border-border last:border-r-0">
                {HOURS.map((hour) => (
                  <div key={hour} className="h-14 border-t border-border first:border-t-0" />
                ))}
              </div>
            ))}
            {PILLS.map((pill, index) => (
              <Bone
                key={`${pill.day}-${pill.hour}`}
                mesh={(["mint", "tide", "bloom", "ember"] as const)[index % 4]}
                className="absolute h-11 rounded-md"
                style={{
                  top: pill.hour * 56 + 4,
                  left: `calc(${pill.day} * (100% / 7) + 4px)`,
                  width: pill.wide ? "calc(100% / 7 - 8px)" : "calc(100% / 7 - 28px)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function ShellPreload(): React.JSX.Element {
  return (
    <section aria-busy="true" className="relative flex min-h-[36rem] flex-col overflow-hidden bg-background text-foreground">
      <p className="sr-only">Loading Timbl</p>
      <PreloadBar />
      <div className="flex min-h-0 flex-1">
        <aside className="relative flex w-52 shrink-0 flex-col gap-1 border-r border-border bg-background/85 p-3">
          <Bone className="mb-3 h-8 w-32" />
          {NAV.map((item) => (
            <span key={item} className="flex h-8 items-center px-2 text-caption text-foreground">
              {item}
            </span>
          ))}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex h-14 items-center justify-end gap-2 border-b border-border px-4">
            <Bone className="h-8 w-40" />
            <Bone className="size-8 rounded-full" />
          </div>
          <WeekSkeleton />
        </div>
      </div>
    </section>
  )
}

export function CardSkeleton(): React.JSX.Element {
  return (
    <section aria-busy="true" className="relative overflow-hidden bg-background p-4 text-foreground">
      <p className="sr-only">Loading this card</p>
      <div className="relative flex flex-col gap-4 rounded-xl border border-border bg-background/80 p-4">
        <Bone mesh="bloom" className="h-3 w-24" />
        <Bone mesh="bloom" className="h-5 w-3/5" />
        <div className="flex flex-col gap-2">
          <Bone mesh="bloom" className="h-4 w-full" />
          <Bone mesh="bloom" className="h-4 w-5/6" />
          <Bone mesh="bloom" className="h-4 w-2/3" />
        </div>
        <Bone mesh="bloom" className="h-8 w-24" />
      </div>
    </section>
  )
}

export function SheetSkeleton(): React.JSX.Element {
  return (
    <section aria-busy="true" className="relative flex flex-col gap-4 overflow-hidden bg-background p-4 text-foreground">
      <p className="sr-only">Loading previews</p>
      <div className="relative flex items-center justify-between">
        <span className="text-title-sm">This week</span>
        <Bone mesh="tide" className="h-8 w-20" />
      </div>
      <div className="relative grid grid-cols-1 gap-3 @md:grid-cols-3">
        {(["mint", "tide", "bloom"] as const).map((mesh, index) => (
          <div key={mesh}>
            <Bone mesh={mesh} className="aspect-4/5 w-full" style={{ "--mesh-delay": `${index * -4}s` }} />
            <Bone mesh={mesh} className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function ApprovalSkeleton(): React.JSX.Element {
  return (
    <section aria-busy="true" className="relative flex flex-col gap-3 overflow-hidden bg-background p-4 text-foreground">
      <p className="sr-only">Loading approvals</p>
      <Bone mesh="mint" className="relative h-5 w-40" />
      {(["mint", "tide", "bloom"] as const).map((mesh, index) => (
        <div key={mesh} className="relative flex items-center gap-3 rounded-xl border border-border bg-background p-3">
          <Bone mesh={mesh} className="size-4 shrink-0" style={{ "--mesh-delay": `${index * -6}s` }} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone mesh={mesh} className="h-3.5 w-3/5" />
            <Bone mesh={mesh} className="h-3 w-2/5" />
          </div>
          <Bone mesh={mesh} className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </section>
  )
}

export function SearchSkeleton(): React.JSX.Element {
  return (
    <section aria-busy="true" className="relative flex flex-col items-start gap-4 overflow-hidden bg-background p-8 text-foreground">
      <p className="sr-only">Searching</p>
      <p className="relative flex h-9 w-full max-w-sm items-center rounded-lg border border-border bg-background/80 px-3 text-body-sm">launch week</p>
      <div className="relative flex w-full max-w-md flex-col gap-3">
        {["a", "b", "c", "d"].map((id) => (
          <div key={id} className="flex items-center gap-3">
            <Bone mesh="ember" className="size-4 shrink-0" />
            <Bone mesh="ember" className="h-3.5 flex-1" />
            <Bone mesh="ember" className="h-3 w-16" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function AgendaSkeleton(): React.JSX.Element {
  return (
    <section aria-busy="true" className="relative flex flex-col gap-4 overflow-hidden bg-background p-4 text-foreground">
      <p className="sr-only">Loading the week</p>
      <PreloadBar />
      <div className="relative flex items-center justify-between">
        <span className="text-title-sm">2-8 Nov</span>
        <Bone mesh="tide" className="h-7 w-16" />
      </div>
      {(["Mon 2", "Tue 3", "Wed 4"] as const).map((day, index) => (
        <div key={day} className="relative flex flex-col gap-2">
          <span className="text-caption text-muted-foreground">{day}</span>
          <Bone mesh={index === 1 ? "bloom" : "tide"} className="h-14 w-full rounded-lg" style={{ "--mesh-delay": `${index * -5}s` }} />
          <Bone mesh={index === 2 ? "ember" : "mint"} className="h-14 w-full rounded-lg" style={{ "--mesh-delay": `${index * -5 - 7}s` }} />
        </div>
      ))}
    </section>
  )
}
