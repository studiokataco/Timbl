"use client"

import { useCallback, useEffect, useRef, type ReactNode } from "react"
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Globe,
  Lightbulb,
  MoreHorizontal,
  PenLine,
  Send,
  Sparkles,
  Square,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import type { AgentChatHandle } from "./agent-chat"

type Suggestion = {
  label: string
  prompt: string
  icon: typeof PenLine
  tone: "coral" | "forest" | "peach" | "mint" | "yellow" | "muted"
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: "Draft a post",
    prompt: "Draft a post about ",
    icon: PenLine,
    tone: "coral",
  },
  {
    label: "Plan the week",
    prompt: "Plan this week's posting cadence across our channels.",
    icon: CalendarClock,
    tone: "forest",
  },
  {
    label: "Brainstorm ideas",
    prompt: "Brainstorm five post ideas for ",
    icon: Lightbulb,
    tone: "peach",
  },
  {
    label: "Awareness day",
    prompt: "Find an awareness day worth posting about next month.",
    icon: Globe,
    tone: "mint",
  },
  {
    label: "Approve drafts",
    prompt: "Triage the pending agent drafts and approve the strongest.",
    icon: CheckCircle2,
    tone: "yellow",
  },
]

const FOOTER_SELECT =
  "h-7 appearance-none rounded-md border border-border bg-background pl-2.5 pr-8 text-caption text-foreground"

const TONE_CLASS: Record<Suggestion["tone"], string> = {
  coral: "text-[oklch(0.65_0.18_25)]",
  forest: "text-[oklch(0.45_0.12_150)]",
  peach: "text-[oklch(0.70_0.13_55)]",
  mint: "text-[oklch(0.65_0.12_175)]",
  yellow: "text-[oklch(0.70_0.14_85)]",
  muted: "text-muted-foreground",
}

export type AgentAskShellProps = {
  chatRef: React.RefObject<AgentChatHandle | null>
  resolvedActiveAgent: string
  pickerAgentNames: string[]
  onAgentSwitch: (name: string) => void
  input: string
  onInputChange: (value: string) => void
  streaming: boolean
  onSubmit: (override?: string) => void
  isEmpty: boolean
  showShortcutHints?: boolean
  children: ReactNode
  className?: string
}

export function AgentAskShell({
  chatRef,
  resolvedActiveAgent,
  pickerAgentNames,
  onAgentSwitch,
  input,
  onInputChange,
  streaming,
  onSubmit,
  isEmpty,
  showShortcutHints = true,
  children,
  className,
}: AgentAskShellProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [input])

  const pickSuggestion = useCallback(
    (s: Suggestion) => {
      onInputChange(s.prompt)
      requestAnimationFrame(() => {
        textareaRef.current?.focus()
        const len = s.prompt.length
        textareaRef.current?.setSelectionRange(len, len)
      })
    },
    [onInputChange],
  )

  return (
    <div className={cn("flex flex-1 min-h-0 flex-col", className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {children}
        {isEmpty && (
          <div
            aria-hidden={!isEmpty}
            className="absolute inset-0 flex flex-col items-center justify-center bg-background px-6 py-8"
          >
            <div className="flex size-12 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="mt-6 flex flex-col items-center gap-1 text-center">
              <h2 className="text-body-md text-muted-foreground">Hi there,</h2>
              <h3 className="text-title-md">
                What can {resolvedActiveAgent} do for you?
              </h3>
              <p className="mt-1 max-w-prose text-body-sm text-muted-foreground">
                Pick a prompt below or just describe what you need.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
              {SUGGESTIONS.map((s) => {
                const Icon = s.icon
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 text-xs",
                      "text-foreground transition-colors hover:bg-background hover:shadow-sm",
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn("size-3.5", TONE_CLASS[s.tone])}
                    />
                    {s.label}
                  </button>
                )
              })}
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground">
                <MoreHorizontal
                  aria-hidden
                  className={cn("size-3.5", TONE_CLASS.muted)}
                />
                …or type your own
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <div className="px-5 py-3">
            <div className="flex items-end gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Ask anything…"
                rows={1}
                disabled={streaming}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault()
                    onSubmit()
                  }
                }}
                className="min-h-6 max-h-40 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-0 shadow-none outline-none focus-visible:ring-0 disabled:opacity-50 dark:bg-transparent dark:disabled:bg-transparent text-body-sm"
                aria-label="Message"
              />
              {streaming ? (
                <Button
                  type="button"
                  size="sm"
                  className="mb-0.5 shrink-0"
                  onClick={() => chatRef.current?.stop()}
                  aria-label="Stop streaming"
                >
                  <Square className="size-3.5" aria-hidden />
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  className="mb-0.5 shrink-0"
                  disabled={!input.trim()}
                  aria-label="Send"
                >
                  <Send className="size-3.5" aria-hidden />
                  Send
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/40 px-5 py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="shrink-0 uppercase tracking-wide">
                  Agent Mode
                </span>
                <div className="relative">
                  <select
                    aria-label="Agent mode"
                    value={resolvedActiveAgent}
                    disabled={streaming}
                    onChange={(e) => onAgentSwitch(e.target.value)}
                    className={FOOTER_SELECT}
                  >
                    {pickerAgentNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
            </div>
            {showShortcutHints && (
              <dl className="hidden sm:grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] leading-tight text-muted-foreground/60">
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">esc</kbd>
                  <span>close</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">⌘↵</kbd>
                  <span>send</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">⌘J</kbd>
                  <span>toggle</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="font-sans">⌘⇧J</kbd>
                  <span>history</span>
                </div>
              </dl>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
