"use client"

import { Keyboard, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AmbientGlow } from "../ambient/ambient-glow"
import { PresenceOrb } from "../primitives/presence-orb"
import { FrameSheet } from "./frame-sheet"
import { tw } from "../lib"
import { usePrototype } from "../prototype-context"
import type { ResolvedEntityChip, TalkState, VoiceToken } from "../types"

export type TalkPanelProps = {
  state: TalkState
  tokens: VoiceToken[]
  chips: ResolvedEntityChip[]
  level: number
  workspace: string
  framed?: boolean
  holding?: boolean
  onOrb: () => void
  onHoldStart: () => void
  onHoldEnd: () => void
  onPermission: (granted: boolean) => void
  onClose: () => void
  onTypeInstead: () => void
  onRetry: () => void
}

export type TalkSheetProps = TalkPanelProps & {
  open: boolean
  finalFocus?: () => HTMLElement | null
}

export function TalkPanel({
  state,
  tokens,
  chips,
  level,
  workspace,
  framed = true,
  holding = false,
  onOrb,
  onHoldStart,
  onHoldEnd,
  onPermission,
  onClose,
  onTypeInstead,
  onRetry,
}: TalkPanelProps): React.JSX.Element {
  const { copy, view, prefs } = usePrototype()
  const voiceGlow = (view.glow ?? prefs.ambient.glow) && (holding || state === "listening" || state === "sending")
  const t = copy.mobile.talk
  const finalWords = tokens.filter((w) => w.final).map((w) => w.text).join(" ")
  const interimWords = tokens.filter((w) => !w.final).map((w) => w.text).join(" ")

  const hint =
    state === "denied"
      ? t.denied
      : state === "no_speech"
        ? t.noSpeech
        : state === "sending"
          ? t.sending
          : holding
            ? t.hold
            : state === "listening"
              ? t.listening
              : t.idle

  return (
    <div className="dark relative size-full flex-1">
      <div
        data-slot="agentic-talk-panel"
        data-state={holding ? "hold" : state}
        data-figma="TalkSheet/panel"
        className={tw(
          "relative flex min-h-full flex-1 flex-col bg-background px-7 pb-9 text-foreground",
          framed ? "pt-16" : "pt-6",
        )}
      >
        {voiceGlow ? (
          <AmbientGlow
            scope="container"
            state={state === "sending" ? "output" : "listening"}
            enabled
            source={null}
            spread="mobile"
            level={level}
          />
        ) : null}
        <h2 className="sr-only">{t.title}</h2>
        <span role="status" className="sr-only">
          {finalWords}
        </span>

        <header className="relative z-10 flex h-11 items-center justify-between">
          <span className="text-caption text-muted-foreground">{workspace}</span>
          <Button
            type="button"
            variant="outline"
            aria-label={t.close}
            onClick={onClose}
            className="size-11 rounded-lg border-input"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </header>

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-7 py-6">
          {state === "requesting" ? (
            <div className="flex flex-col gap-3 rounded-xl border border-input bg-card p-5">
              <p className="text-title-sm text-foreground">{copy.mic.permissionTitle}</p>
              <p className="text-body-sm text-muted-foreground">{copy.mic.permissionBody}</p>
              <div className="mt-2 flex gap-2">
                <Button className="h-11 flex-1" onClick={() => onPermission(true)}>
                  {copy.mic.continue}
                </Button>
                <Button variant="outline" className="h-11 flex-1" onClick={() => onPermission(false)}>
                  {copy.mic.notNow}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p data-figma="TalkSheet/transcript" className="text-display-sm text-balance text-foreground">
                <span>{finalWords || (state === "listening" ? t.listening : t.idle)}</span>
                {interimWords ? (
                  <span aria-hidden="true" className="text-muted-foreground">
                    {" "}
                    {interimWords}
                  </span>
                ) : null}
              </p>
              {chips.length > 0 ? (
                <div data-figma="TalkSheet/chips" className="flex flex-wrap gap-2">
                  {chips.map((chip, idx) => (
                    <span
                      key={`${chip.label}-${idx}`}
                      className="inline-flex h-7 items-center rounded-md border border-input bg-card px-3 text-caption text-foreground"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="relative z-10 flex flex-col items-center gap-5">
          {state !== "denied" ? (
            <PresenceOrb
              state={state === "listening" ? "listening" : "idle"}
              size="talk"
              level={state === "listening" ? level : 0}
              interactive={{
                onPress: onOrb,
                onHoldStart,
                onHoldEnd,
                ariaLabel: state === "listening" ? t.stop : t.start,
              }}
            />
          ) : null}
          <p className="text-center text-caption text-muted-foreground">{hint}</p>
          <div className="flex items-center gap-2">
            {state === "no_speech" ? (
              <Button variant="outline" className="h-11 rounded-lg px-4" onClick={onRetry}>
                {t.tryAgain}
              </Button>
            ) : null}
            <Button
              variant={state === "denied" ? "default" : "outline"}
              className="h-11 rounded-lg px-4"
              onClick={onTypeInstead}
            >
              <Keyboard className="size-4" aria-hidden />
              <span>{t.typeInstead}</span>
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export function TalkSheet({ open, finalFocus, ...panelProps }: TalkSheetProps): React.JSX.Element | null {
  const { copy } = usePrototype()
  return (
    <FrameSheet
      open={open}
      onClose={panelProps.onClose}
      title={copy.mobile.talk.title}
      hideTitle
      size="full"
      dark
      finalFocus={finalFocus}
    >
      <TalkPanel {...panelProps} />
    </FrameSheet>
  )
}
