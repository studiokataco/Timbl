"use client"

import { useRef, type ComponentType, type SVGProps } from "react"

import { Check, ChevronsUpDown } from "lucide-react"

import { FacebookIcon, InstagramIcon, LinkedInIcon, XIcon } from "./brand-icons"
import { gsap, ScrollTrigger, useGSAP } from "./gsap"

const SIG = {
  coral: "#fb923c",
  forest: "#10b981",
  mint: "#34d399",
  yellow: "#f59e0b",
  violet: "#8b5cf6",
  pink: "#ec4899",
  blue: "#3b82f6",
}

const PILL_TEXT = "#181d26"

function lighten(hex: string, amount = 0.8) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`
}

function gate(root: HTMLElement, anims: gsap.core.Animation[]) {
  const st = ScrollTrigger.create({
    trigger: root,
    start: "top 95%",
    end: "bottom 5%",
    onToggle: (self) =>
      anims.forEach((a) => (self.isActive ? a.play() : a.pause())),
  })
  return () => {
    st.kill()
    anims.forEach((a) => a.kill())
  }
}

const FRAGMENT = "w-full"

type Entry = { color: string; glyph: string; label: string }

const CAL_DAYS = ["Mon", "Tue", "Wed", "Thu"]
const CAL_START = 12
const TODAY = 18

const CAL_CELLS: (Entry | null)[] = [
  { color: SIG.coral, glyph: "●", label: "Pick of week" },
  null,
  { color: SIG.forest, glyph: "○", label: "Meet the team" },
  { color: SIG.yellow, glyph: "●", label: "Fundraiser" },
  { color: SIG.mint, glyph: "○", label: "New idea" },
  null,
  { color: SIG.violet, glyph: "●", label: "Campaign" },
  { color: SIG.pink, glyph: "○", label: "Volunteers" },
  { color: SIG.blue, glyph: "●", label: "Newsletter" },
  null,
  { color: SIG.forest, glyph: "○", label: "Did you know" },
  { color: SIG.coral, glyph: "●", label: "Store promo" },
]

function CalPill({ entry }: { entry: Entry }) {
  return (
    <span
      className="block w-full truncate rounded-sm px-1 py-0.5 text-[9px] leading-tight"
      style={{ backgroundColor: lighten(entry.color), color: PILL_TEXT }}
    >
      <span aria-hidden className="mr-0.5 font-bold">
        {entry.glyph}
      </span>
      {entry.label}
    </span>
  )
}

export function SceneCalendar() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = ref.current
      if (!root) return
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root)
        const anims: gsap.core.Animation[] = []

        const drop = gsap.timeline({ repeat: -1, repeatDelay: 1.1 })
        drop
          .set(q(".fs-cal-ghost"), { y: -14, scale: 0.85, autoAlpha: 0 })
          .to(q(".fs-cal-ghost"), {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.55,
            ease: "back.out(1.7)",
          })
          .to(q(".fs-cal-ghost"), { autoAlpha: 0, duration: 0.3 }, "+=1.3")
        anims.push(drop)

        anims.push(
          gsap.to(q(".fs-cal-today"), {
            boxShadow: "0 0 0 4px rgba(17,17,17,0.12)",
            duration: 1.1,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          })
        )

        return gate(root, anims)
      })
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={FRAGMENT}>
      <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="grid grid-cols-4 border-b border-border bg-secondary/40">
          {CAL_DAYS.map((d) => (
            <div
              key={d}
              className="py-1.5 text-center text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4">
          {CAL_CELLS.map((entry, i) => {
            const day = CAL_START + i
            const isToday = day === TODAY
            return (
              <div
                key={i}
                className="flex min-h-[42px] flex-col gap-0.5 border-b border-r border-border p-1 last:border-r-0 [&:nth-child(4n)]:border-r-0"
              >
                <span
                  className={
                    isToday
                      ? "fs-cal-today inline-flex size-4 items-center justify-center self-start rounded-full bg-foreground text-[9px] font-semibold tabular-nums text-background"
                      : "self-start px-0.5 text-[9px] tabular-nums text-muted-foreground"
                  }
                >
                  {day}
                </span>
                {entry &&
                  (entry.label === "New idea" ? (
                    <span className="fs-cal-ghost block">
                      <CalPill entry={entry} />
                    </span>
                  ) : (
                    <CalPill entry={entry} />
                  ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type Workspace = {
  initial: string
  name: string
  meta: string
  color: string
  channels: ComponentType<SVGProps<SVGSVGElement>>[]
}

const WORKSPACES: Workspace[] = [
  {
    initial: "A",
    name: "Acme Studio",
    meta: "Owner",
    color: SIG.violet,
    channels: [InstagramIcon, FacebookIcon, LinkedInIcon],
  },
  {
    initial: "T",
    name: "Timbl Studio",
    meta: "Editor",
    color: SIG.forest,
    channels: [InstagramIcon, LinkedInIcon, XIcon],
  },
]

function WsAvatar({ ws, className }: { ws: Workspace; className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-md text-[11px] font-semibold text-white ${className ?? "size-7"}`}
      style={{ backgroundColor: ws.color }}
    >
      {ws.initial}
    </span>
  )
}

export function SceneWorkspaces() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = ref.current
      if (!root) return
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root)
        const anims: gsap.core.Animation[] = []

        const sel = (...names: string[]) => names.flatMap((n) => q(n))
        const swap = (to: 0 | 1) => {
          const from = to === 0 ? 1 : 0
          const tl = gsap.timeline()
          tl.to(sel(`.fs-hl-${from}`, `.fs-ck-${from}`, `.fs-trig-${from}`), {
            autoAlpha: 0,
            duration: 0.3,
            ease: "power1.out",
          })
            .to(
              sel(`.fs-hl-${to}`, `.fs-trig-${to}`),
              { autoAlpha: 1, duration: 0.3, ease: "power1.out" },
              "<"
            )
            .fromTo(
              q(`.fs-ck-${to}`),
              { autoAlpha: 0, scale: 0.4 },
              { autoAlpha: 1, scale: 1, duration: 0.32, ease: "back.out(2)" },
              "<0.05"
            )
            .fromTo(
              q(`.fs-av-${to}`),
              { scale: 0.82 },
              { scale: 1, duration: 0.4, ease: "back.out(2.2)" },
              "<"
            )
          return tl
        }

        const loop = gsap.timeline({ repeat: -1 })
        loop.add(swap(1), 2).add(swap(0), 4.4).to({}, { duration: 1 })
        anims.push(loop)

        return gate(root, anims)
      })
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={FRAGMENT}>
      <div className="relative flex items-center gap-2.5 rounded-lg border border-border bg-background px-2.5 py-2 shadow-sm">
        {WORKSPACES.map((ws, i) => (
          <span
            key={ws.name}
            className={`fs-trig-${i} flex flex-1 items-center gap-2.5${i === 1 ? " absolute inset-0 px-2.5 py-2 opacity-0" : ""}`}
          >
            <WsAvatar ws={ws} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-foreground">
                {ws.name}
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {ws.meta}
              </span>
            </span>
          </span>
        ))}
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-2 rounded-lg border border-border bg-background p-1.5 shadow-sm">
        <p className="px-2 pb-1 pt-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          Workspaces
        </p>
        {WORKSPACES.map((ws, i) => (
          <div
            key={ws.name}
            className="relative flex items-center gap-2.5 rounded-md px-2 py-1.5"
          >
            <span
              aria-hidden
              className={`fs-hl-${i} absolute inset-0 rounded-md bg-secondary${i === 1 ? " opacity-0" : ""}`}
            />
            <span className={`fs-av-${i} relative`}>
              <WsAvatar ws={ws} className="size-6" />
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium text-foreground">
                {ws.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-muted-foreground/70">
                {ws.channels.map((Ch, ci) => (
                  <Ch key={ci} className="size-2.5" />
                ))}
              </span>
            </span>
            <Check
              aria-hidden
              className={`fs-ck-${i} relative size-3.5 shrink-0 text-foreground${i === 1 ? " opacity-0" : ""}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const AGENT_STATUS = ["Ideation agent", "Drafting agent", "Scheduling agent"]

const AGENT_LINES = [
  "Reading brand voice",
  "Scanning awareness days",
  "Drafting 8 post ideas",
  "Matching ideas to campaigns",
  "Writing captions",
  "Generating 3 variants",
  "Checking tone of voice",
  "Finding best times to post",
  "Queuing to the calendar",
  "Awaiting your approval",
]

const LH = 24
const ORB = [
  { r: 100, c: SIG.coral, dash: "22 78" },
  { r: 84, c: SIG.blue, dash: "30 70" },
  { r: 68, c: SIG.forest, dash: "18 82" },
  { r: 52, c: SIG.yellow, dash: "26 74" },
  { r: 36, c: SIG.pink, dash: "20 80" },
  { r: 20, c: SIG.violet, dash: "34 66" },
]

export function SceneAgents() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = ref.current
      if (!root) return
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root)
        const anims: gsap.core.Animation[] = []

        q(".fs-ring").forEach((el, i) => {
          anims.push(
            gsap.to(el, {
              rotation: i % 2 ? -360 : 360,
              duration: 7 + i,
              repeat: -1,
              ease: "none",
              transformOrigin: "50% 50%",
            })
          )
        })

        anims.push(
          gsap.fromTo(
            q(".fs-lines"),
            { y: 0 },
            {
              y: -AGENT_LINES.length * LH,
              duration: AGENT_LINES.length * 0.85,
              ease: "none",
              repeat: -1,
            }
          )
        )

        const labels = q(".fs-status")
        const status = gsap.timeline({ repeat: -1 })
        labels.forEach((el, i) => {
          const next = labels[(i + 1) % labels.length]
          status
            .to({}, { duration: 2 })
            .to(el, { autoAlpha: 0, duration: 0.3, ease: "power1.in" })
            .to(next, { autoAlpha: 1, duration: 0.3, ease: "power1.out" }, "<")
        })
        anims.push(status)

        return gate(root, anims)
      })
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={`${FRAGMENT} flex h-full flex-col`}>
      <div className="flex shrink-0 items-center gap-2">
        <span className="relative size-6 shrink-0">
          <svg viewBox="0 0 240 240" className="size-full" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeWidth="12">
              {ORB.map((o, i) => (
                <circle
                  key={i}
                  className="fs-ring"
                  cx="120"
                  cy="120"
                  r={o.r}
                  stroke={o.c}
                  pathLength={100}
                  strokeDasharray={o.dash}
                />
              ))}
            </g>
          </svg>
        </span>
        <span className="relative h-4 flex-1">
          {AGENT_STATUS.map((s, i) => (
            <span
              key={s}
              className="fs-status absolute left-0 top-0 text-[12px] font-medium text-muted-foreground"
              style={{ opacity: i === 0 ? 1 : 0 }}
            >
              {s}...
            </span>
          ))}
        </span>
      </div>

      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-secondary/50 font-mono">
        <div className="fs-lines">
          {[...AGENT_LINES, ...AGENT_LINES.slice(0, 3)].map((line, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 text-[11px]"
              style={{ height: LH }}
            >
              <span className="w-3 select-none text-right tabular-nums text-muted-foreground/60">
                {(i % AGENT_LINES.length) + 1}
              </span>
              <span className="truncate text-foreground/75">{line}</span>
            </div>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-7"
          style={{
            background: "linear-gradient(to bottom, transparent, var(--card))",
          }}
        />
      </div>
    </div>
  )
}
