"use client"

import { useRef } from "react"

import { Check, Sparkles } from "lucide-react"

import { gsap, landingScroller, ScrollTrigger, useGSAP } from "./gsap"

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

function lighten(hex: string, amount = 0.82) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`
}

const STAGE =
  "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border"

function GridBg() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundColor: "var(--muted)",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(17,17,17,0.05) 1px, transparent 0)",
        backgroundSize: "15px 15px",
      }}
    />
  )
}

function gate(root: HTMLElement, anims: gsap.core.Animation[]) {
  const st = ScrollTrigger.create({
    trigger: root,
    scroller: landingScroller(root),
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

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm"
      style={{ backgroundColor: lighten(color), color: PILL_TEXT }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

function MiniCard({ color }: { color: string }) {
  return (
    <div
      className="w-16 rounded-md border border-border border-l-[3px] bg-background p-1.5 shadow-sm"
      style={{ borderLeftColor: color }}
    >
      <div className="h-1 w-3/4 rounded-full bg-foreground/20" />
      <div className="mt-1 h-1 w-1/2 rounded-full bg-foreground/10" />
    </div>
  )
}

function AskAiChip() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-[10px] font-medium"
      style={{ boxShadow: `0 0 0 1px ${SIG.blue}, 0 0 12px -2px ${SIG.blue}` }}
    >
      <Sparkles className="size-3" style={{ color: SIG.blue }} />
      Ask AI
    </span>
  )
}

function TemplateChip() {
  return (
    <div className="w-14 overflow-hidden rounded-md border border-border bg-background shadow-sm">
      <div className="aspect-video bg-secondary" />
      <div className="p-1">
        <div className="h-1 w-2/3 rounded-full bg-foreground/15" />
      </div>
    </div>
  )
}

function Pot() {
  return (
    <svg viewBox="0 0 120 92" className="w-full text-foreground">
      <path
        d="M22 56 q-12 0 -12 9 q0 7 9 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M98 56 q12 0 12 9 q0 7 -9 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g className="hiw-pot">
        <path
          d="M20 46 H100 L93 84 Q92 88 86 88 H34 Q28 88 27 84 Z"
          fill="currentColor"
        />
        <rect x="17" y="42" width="86" height="9" rx="4.5" fill="currentColor" />
      </g>
      <g className="hiw-lid">
        <path d="M22 42 Q60 14 98 42 Z" fill="currentColor" />
        <rect x="54" y="9" width="12" height="8" rx="3" fill="currentColor" />
        <rect x="58.5" y="15" width="3" height="6" fill="currentColor" />
      </g>
    </svg>
  )
}

const SETUP_POS = [
  { left: 16, top: 27 },
  { left: 33, top: 14 },
  { left: 50, top: 9 },
  { left: 67, top: 14 },
  { left: 84, top: 27 },
]

const SETUP_CHIPS = [
  <MiniCard key="a" color={SIG.violet} />,
  <Pill key="b" color={SIG.coral} label="Promo" />,
  <AskAiChip key="c" />,
  <Pill key="d" color={SIG.forest} label="Brand" />,
  <TemplateChip key="e" />,
]

export function SceneSetup() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = ref.current
      if (!root) return
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root)
        const chips = q(".hiw-chip")
        const W = root.clientWidth
        const H = root.clientHeight
        const anims: gsap.core.Animation[] = []
        const STEP = 0.9

        const tl = gsap.timeline({ repeat: -1 })
        chips.forEach((el, i) => {
          const p = SETUP_POS[i]
          const dx = ((50 - p.left) / 100) * W
          const dy = ((53 - p.top) / 100) * H
          const t = i * STEP
          tl.to(
            el,
            {
              x: dx,
              y: dy,
              scale: 0.3,
              rotate: i % 2 ? 40 : -40,
              opacity: 0,
              duration: 0.6,
              ease: "power1.in",
            },
            t
          )
            .set(el, { x: 0, y: -24, scale: 0.6, rotate: 0, opacity: 0 }, t + 0.62)
            .to(
              el,
              { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" },
              t + 0.66
            )
          tl.to(
            q(".hiw-lid"),
            { y: -7, rotate: -7, duration: 0.25, ease: "power2.out", transformOrigin: "92% 100%" },
            t + 0.05
          ).to(
            q(".hiw-lid"),
            { y: 0, rotate: 0, duration: 0.25, ease: "power2.in", transformOrigin: "92% 100%" },
            t + 0.5
          )
          tl.to(
            q(".hiw-pot"),
            { scaleX: 1.05, scaleY: 0.95, duration: 0.12, ease: "power2.out", transformOrigin: "50% 100%" },
            t + 0.54
          ).to(
            q(".hiw-pot"),
            { scaleX: 1, scaleY: 1, duration: 0.4, ease: "elastic.out(1,0.4)", transformOrigin: "50% 100%" },
            t + 0.66
          )
        })
        tl.to({}, { duration: 0.8 })
        anims.push(tl)

        anims.push(
          gsap.to(".hiw-group", {
            rotation: 6,
            duration: 4,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            transformOrigin: "50% 72%",
          })
        )
        anims.push(
          gsap.to(".hiw-group", {
            y: -6,
            duration: 2.6,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
          })
        )
        anims.push(
          gsap.to(q(".hiw-steam"), {
            keyframes: { opacity: [0, 0.4, 0], y: [0, -12, -26] },
            duration: 1.9,
            stagger: 0.5,
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
    <div ref={ref} className={STAGE}>
      <GridBg />
      <div className="absolute left-1/2 top-[44%] -translate-x-1/2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="hiw-steam absolute size-1.5 rounded-full bg-foreground/25"
            style={{ left: `${i * 8 - 8}px` }}
          />
        ))}
      </div>
      <div className="absolute bottom-[6%] left-1/2 h-2 w-[40%] -translate-x-1/2 rounded-[50%] bg-foreground/10 blur-[2px]" />
      <div className="absolute bottom-[8%] left-1/2 w-[42%] -translate-x-1/2">
        <Pot />
      </div>
      <div className="hiw-group absolute inset-0">
        {SETUP_POS.map((p, i) => (
          <div
            key={i}
            className="hiw-chip absolute"
            style={{ left: `${p.left}%`, top: `${p.top}%`, transform: "translate(-50%, -50%)" }}
          >
            {SETUP_CHIPS[i]}
          </div>
        ))}
      </div>
    </div>
  )
}

function Ladder({ rail }: { rail: string }) {
  return (
    <div className="relative h-full w-full">
      <div
        className="absolute inset-y-0 left-0 w-[3px] rounded-full"
        style={{ background: rail }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[3px] rounded-full"
        style={{ background: rail }}
      />
      {[8, 22, 36, 50, 64, 78, 92].map((t) => (
        <div
          key={t}
          className="absolute left-0 right-0 h-[2px] rounded bg-foreground/30"
          style={{ top: `${t}%` }}
        />
      ))}
    </div>
  )
}

function Climber() {
  return (
    <svg viewBox="0 0 16 24" className="w-full text-foreground/85">
      <circle cx="8" cy="3.5" r="2.8" fill="currentColor" />
      <path
        d="M8 6 V13 M8 8 L3.5 5 M8 8 L12.5 5 M8 13 L4.5 21 M8 13 L11.5 21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="10.5" y="2.5" width="4.5" height="3.4" rx="0.8" fill={SIG.blue} />
    </svg>
  )
}

function Placer() {
  return (
    <svg viewBox="0 0 18 24" className="w-full text-foreground/85">
      <circle cx="7" cy="3.5" r="2.8" fill="currentColor" />
      <path
        d="M7 6 V14 M7 14 L3.5 21 M7 14 L10.5 21 M7 9 L3 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="hiw-parm"
        d="M7 9 L13 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        style={{ transformBox: "fill-box", transformOrigin: "0% 100%" }}
      />
    </svg>
  )
}

function GroundWorker() {
  return (
    <svg viewBox="0 0 20 24" className="w-full text-foreground/85">
      <circle cx="8" cy="4" r="2.8" fill="currentColor" />
      <path
        d="M8 7 V14 M8 14 L4.5 21 M8 14 L11.5 21 M8 9 L4 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="hiw-garm"
        d="M8 9 L13 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        style={{ transformBox: "fill-box", transformOrigin: "0% 100%" }}
      />
      <rect x="12" y="3.5" width="5" height="4" rx="1" fill={SIG.coral} />
    </svg>
  )
}

const PLAN_FLOORS = [
  [SIG.yellow, null, SIG.pink, null],
  [null, SIG.blue, null, SIG.forest],
  [SIG.coral, null, SIG.violet, null],
]

export function ScenePlan() {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const root = ref.current
      if (!root) return
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root)
        const H = root.clientHeight
        const anims: gsap.core.Animation[] = []
        const risers = [".hiw-climber", ".hiw-placer"]
        const yMid = ((44 - 66) / 100) * H
        const yTop = ((22 - 66) / 100) * H

        const tl = gsap.timeline({ repeat: -1 })
        tl.set(q(".hiw-post"), { scale: 0, opacity: 0, transformOrigin: "0% 50%" }, 0)
        tl.set(risers, { y: 0 }, 0)
        tl.to(
          q(".hiw-floor-0"),
          { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.3 },
          0.3
        )
        tl.to(risers, { y: yMid, duration: 0.75, ease: "power2.inOut" }, 1.3)
        tl.to(
          q(".hiw-floor-1"),
          { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.3 },
          2.2
        )
        tl.to(risers, { y: yTop, duration: 0.75, ease: "power2.inOut" }, 3.2)
        tl.to(
          q(".hiw-floor-2"),
          { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.3 },
          4.1
        )
        tl.to(q(".hiw-post"), { scale: 0, opacity: 0, duration: 0.3, stagger: 0.05 }, 6.0)
        tl.to(risers, { y: 0, duration: 0.7, ease: "power2.inOut" }, 6.0)
        tl.to({}, { duration: 0.5 }, 6.8)
        anims.push(tl)

        anims.push(
          gsap.to(q(".hiw-climber svg"), {
            rotation: 4,
            duration: 0.34,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            transformOrigin: "50% 0%",
          })
        )
        anims.push(
          gsap.to(q(".hiw-parm"), {
            rotation: -34,
            duration: 0.5,
            yoyo: true,
            repeat: -1,
            ease: "power1.inOut",
          })
        )
        anims.push(
          gsap.to(q(".hiw-garm"), {
            rotation: -40,
            duration: 0.7,
            yoyo: true,
            repeat: -1,
            ease: "power1.inOut",
          })
        )
        anims.push(
          gsap.to(".hiw-ground", {
            y: -2,
            duration: 0.7,
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
    <div ref={ref} className={STAGE}>
      <GridBg />
      <div
        className="absolute"
        style={{ left: "34%", right: "5%", top: "12%", bottom: "18%" }}
      >
        <div className="grid h-full grid-cols-4 grid-rows-3 gap-1">
          {PLAN_FLOORS.map((row, r) =>
            row.map((c, col) => {
              const floor = 2 - r
              return (
                <div
                  key={`${r}-${col}`}
                  className="relative rounded border border-border bg-background/50"
                >
                  <span className="absolute right-0.5 top-0.5 size-1 rounded-full bg-foreground/15" />
                  {c && (
                    <div
                      className={`hiw-post hiw-floor-${floor} absolute inset-1 rounded-sm border-l-2 bg-background shadow-sm`}
                      style={{ borderLeftColor: c }}
                    >
                      <div className="ml-1 mt-1 h-[3px] w-3/4 rounded-full bg-foreground/20" />
                      <div className="ml-1 mt-0.5 h-[3px] w-1/2 rounded-full bg-foreground/10" />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div
        className="absolute"
        style={{ left: "15%", top: "12%", bottom: "14%", width: "7%" }}
      >
        <Ladder rail={SIG.coral} />
      </div>

      <div
        className="hiw-climber absolute"
        style={{ left: "18.5%", top: "66%", width: "4.5%", transform: "translate(-50%, -50%)" }}
      >
        <Climber />
      </div>

      <div
        className="hiw-placer absolute"
        style={{ left: "31%", top: "66%", width: "6%", transform: "translate(-50%, -50%)" }}
      >
        <Placer />
      </div>

      <div
        className="hiw-ground absolute"
        style={{ left: "8%", bottom: "10%", width: "6%" }}
      >
        <GroundWorker />
      </div>

      <div className="absolute inset-x-[4%] bottom-[10%] h-[2px] rounded bg-foreground/10" />
    </div>
  )
}

function CloudShape() {
  return (
    <div className="relative h-7 w-20">
      <div className="absolute bottom-0 left-0 h-5 w-20 rounded-full bg-background shadow-sm ring-1 ring-black/[0.05]" />
      <div className="absolute bottom-1 left-3 size-9 rounded-full bg-background shadow-sm ring-1 ring-black/[0.05]" />
      <div className="absolute bottom-1 right-3 size-7 rounded-full bg-background shadow-sm ring-1 ring-black/[0.05]" />
    </div>
  )
}

type Station = {
  sfx: string
  cloudLeft: number
  cloudTop: number
  cardLeft: number
  cardTop: number
  color: string
  delay: number
}

const STATIONS: Station[] = [
  { sfx: "a", cloudLeft: 27, cloudTop: 34, cardLeft: 32, cardTop: 45, color: SIG.blue, delay: 0 },
  { sfx: "b", cloudLeft: 65, cloudTop: 29, cardLeft: 70, cardTop: 40, color: SIG.violet, delay: 1.6 },
]

const CAL = { left: 49, top: 79 }

const SKY = {
  dawn: "linear-gradient(to top, #fde4d0, #fbd3df 38%, #e9ecff)",
  day: "linear-gradient(to top, #ffffff, #ecf5ff 58%, #d3e9ff)",
  dusk: "linear-gradient(to top, #f9c79a, #f3a981 30%, #c7a3e8 76%, #8f82c6)",
  night: "linear-gradient(to top, #2b3358, #1a2142 52%, #0d1330)",
}

const STARS = [
  { l: 12, t: 12 },
  { l: 24, t: 22 },
  { l: 33, t: 8 },
  { l: 44, t: 17 },
  { l: 56, t: 10 },
  { l: 62, t: 23 },
  { l: 74, t: 14 },
  { l: 85, t: 9 },
  { l: 90, t: 24 },
  { l: 8, t: 28 },
  { l: 48, t: 27 },
  { l: 80, t: 31 },
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
        const W = root.clientWidth
        const H = root.clientHeight
        const anims: gsap.core.Animation[] = []

        gsap.set(q(".hiw-line"), { scaleX: 0 })
        gsap.set(q(".hiw-stamp"), { scale: 0, opacity: 0 })

        STATIONS.forEach((s) => {
          const card = q(`.hiw-card-${s.sfx}`)
          const lines = q(`.hiw-line-${s.sfx}`)
          const stamp = q(`.hiw-stamp-${s.sfx}`)
          const calCheck = q(".hiw-cal-check")
          const dx = ((CAL.left - s.cardLeft) / 100) * W
          const dy = ((CAL.top - s.cardTop) / 100) * H
          const bow = s.sfx === "a" ? -W * 0.05 : W * 0.05

          const tl = gsap.timeline({ repeat: -1, delay: s.delay })
          tl.set(card, { x: 0, y: 0, opacity: 1, scale: 1 })
          tl.set(lines, { scaleX: 0 })
          tl.set(stamp, { scale: 0, opacity: 0 })
          tl.to(lines, { scaleX: 1, duration: 0.45, ease: "power1.out", stagger: 0.22 })
          tl.to(stamp, { scale: 1, opacity: 1, duration: 0.22, ease: "back.out(2)" })
          tl.to({}, { duration: 0.2 })
          tl.to(card, {
            keyframes: { x: [0, dx * 0.5 + bow, dx], y: [0, dy * 0.45 - H * 0.05, dy] },
            duration: 0.95,
            ease: "power1.inOut",
          })
          tl.to(card, { opacity: 0, scale: 0.7, duration: 0.18 })
          tl.fromTo(
            calCheck,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.22, ease: "back.out(2)" },
            "<"
          )
          tl.to(calCheck, { opacity: 0, duration: 0.3 })
          tl.to({}, { duration: 0.4 })
          anims.push(tl)
        })

        anims.push(
          gsap.to(q(".hiw-cloud"), {
            x: "+=10",
            duration: 5,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            stagger: 0.7,
          })
        )
        anims.push(
          gsap.to(q(".hiw-spark"), {
            scale: 1.4,
            opacity: 0.5,
            duration: 0.8,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            stagger: 0.3,
            transformOrigin: "50% 50%",
          })
        )
        const sky = gsap.timeline({ repeat: -1 })
        sky.set(
          [".hiw-sky-day", ".hiw-sky-dusk", ".hiw-sky-night", ".hiw-stars", ".hiw-moon"],
          { opacity: 0 },
          0
        )
        sky.set(".hiw-sky-dawn", { opacity: 1 }, 0)
        sky.set(".hiw-sun", { x: -W * 0.42, y: H * 0.1, opacity: 0 }, 0)
        sky.to(
          ".hiw-sun",
          {
            keyframes: {
              x: [-W * 0.4, -W * 0.22, 0, W * 0.22, W * 0.4, W * 0.42],
              y: [H * 0.08, -H * 0.22, -H * 0.36, -H * 0.22, H * 0.08, H * 0.1],
              opacity: [1, 1, 1, 1, 1, 0],
            },
            duration: 8,
            ease: "sine.inOut",
          },
          0.3
        )
        sky.to(".hiw-sky-day", { opacity: 1, duration: 2 }, 1.2)
        sky.to(".hiw-sky-dawn", { opacity: 0, duration: 2 }, 1.2)
        sky.to(".hiw-sky-dusk", { opacity: 1, duration: 2 }, 5.2)
        sky.to(".hiw-sky-day", { opacity: 0, duration: 2 }, 5.2)
        sky.to(".hiw-sky-night", { opacity: 1, duration: 2 }, 7.6)
        sky.to(".hiw-sky-dusk", { opacity: 0, duration: 2 }, 7.6)
        sky.to(".hiw-stars", { opacity: 1, duration: 1.5 }, 7.9)
        sky.set(".hiw-moon", { x: -W * 0.3, y: H * 0.16, opacity: 0 }, 7.4)
        sky.to(
          ".hiw-moon",
          {
            keyframes: { x: [-W * 0.26, -W * 0.12], y: [H * 0.02, -H * 0.28], opacity: [1, 1] },
            duration: 2.4,
            ease: "sine.out",
          },
          7.6
        )
        sky.to(".hiw-sky-dawn", { opacity: 1, duration: 2 }, 12)
        sky.to(".hiw-sky-night", { opacity: 0, duration: 2 }, 12)
        sky.to([".hiw-stars", ".hiw-moon"], { opacity: 0, duration: 1.5 }, 12)
        sky.to({}, { duration: 0.6 }, 14)
        anims.push(sky)

        anims.push(
          gsap.to(q(".hiw-star"), {
            opacity: 0.3,
            scale: 0.6,
            duration: 0.9,
            yoyo: true,
            repeat: -1,
            ease: "sine.inOut",
            stagger: { each: 0.2, from: "random" },
          })
        )

        return gate(root, anims)
      })
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={STAGE}>
      <div className="hiw-sky-dawn absolute inset-0" style={{ background: SKY.dawn }} />
      <div className="hiw-sky-day absolute inset-0" style={{ background: SKY.day, opacity: 0 }} />
      <div className="hiw-sky-dusk absolute inset-0" style={{ background: SKY.dusk, opacity: 0 }} />
      <div className="hiw-sky-night absolute inset-0" style={{ background: SKY.night, opacity: 0 }} />

      <div className="hiw-stars absolute inset-0" style={{ opacity: 0 }}>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="hiw-star absolute rounded-full bg-white"
            style={{
              left: `${s.l}%`,
              top: `${s.t}%`,
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
            }}
          />
        ))}
      </div>

      <div className="hiw-sun absolute left-1/2 top-1/2" style={{ transform: "translate(-50%, -50%)" }}>
        <div
          className="size-8 rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 45%, #fff3c4, #fbbf24 70%)",
            boxShadow: "0 0 18px 5px rgba(251,191,36,0.45)",
          }}
        />
      </div>

      <div
        className="hiw-moon absolute left-1/2 top-1/2"
        style={{ transform: "translate(-50%, -50%)", opacity: 0 }}
      >
        <div
          className="relative size-6 rounded-full"
          style={{
            background: "radial-gradient(circle at 38% 38%, #f6f8fc, #d7dded)",
            boxShadow: "0 0 12px 3px rgba(226,232,240,0.4)",
          }}
        >
          <span
            className="absolute right-1 top-1.5 size-1.5 rounded-full"
            style={{ backgroundColor: "#c4ccdf" }}
          />
        </div>
      </div>

      {STATIONS.map((s) => (
        <div
          key={s.sfx}
          className="hiw-cloud absolute"
          style={{ left: `${s.cloudLeft}%`, top: `${s.cloudTop}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="relative">
            <CloudShape />
            <Sparkles
              className="hiw-spark absolute -top-5 left-2 size-3"
              style={{ color: SIG.blue }}
            />
          </div>
        </div>
      ))}

      {STATIONS.map((s) => (
        <div
          key={s.sfx}
          className={`hiw-card hiw-card-${s.sfx} absolute`}
          style={{ left: `${s.cardLeft}%`, top: `${s.cardTop}%`, transform: "translate(-50%, -50%)" }}
        >
          <div
            className="w-11 rounded-md border border-border border-l-[3px] bg-background p-1 shadow-sm"
            style={{ borderLeftColor: s.color }}
          >
            <div className={`hiw-line hiw-line-${s.sfx} h-[3px] w-3/4 origin-left rounded-full bg-foreground/25`} />
            <div className={`hiw-line hiw-line-${s.sfx} mt-1 h-[3px] w-1/2 origin-left rounded-full bg-foreground/15`} />
          </div>
          <span
            className={`hiw-stamp hiw-stamp-${s.sfx} absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full text-white`}
            style={{ backgroundColor: SIG.forest }}
          >
            <Check className="size-2" />
          </span>
        </div>
      ))}

      <div
        className="absolute"
        style={{ left: `${CAL.left}%`, top: `${CAL.top}%`, transform: "translate(-50%, -50%)" }}
      >
        <div className="relative w-16 rounded-md border border-border bg-background p-1 shadow-sm">
          <div className="mb-1 h-1 w-1/2 rounded-full bg-foreground/15" />
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[2px] bg-secondary" />
            ))}
          </div>
          <span
            className="hiw-cal-check absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: SIG.forest, opacity: 0 }}
          >
            <Check className="size-2.5" />
          </span>
        </div>
      </div>
    </div>
  )
}
