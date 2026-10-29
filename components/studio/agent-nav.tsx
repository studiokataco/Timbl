"use client"

import { useEffect, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check, ChevronDown, ChevronLeft, ChevronsUpDown, ChevronUp } from "lucide-react"

import type { AgentConfig } from "@/lib/schemas/agentConfig"
import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { STATE_COPY, agentLabel, agentState, groupAgents } from "./agent-meta"
import { AgentGlyph, StatusDot } from "./bits"

type Props = {
  agent: AgentConfig
  agents: AgentConfig[]
  runs: AgentRunDoc[]
  condensed: boolean
  action?: ReactNode
  onBack: () => void
  onSwitch: (name: string, dir: 1 | -1) => void
}

export function agentOrder(agents: AgentConfig[], current: AgentConfig): AgentConfig[] {
  const ordered = groupAgents(agents.filter((a) => a.enabled)).flatMap((g) => g.agents)
  return ordered.some((a) => a.name === current.name) ? ordered : [...ordered, current]
}

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)
}

function overlayOpen(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"], [role="menu"]')).some(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden",
  )
}

export function AgentNav({ agent, agents, runs, condensed, action, onBack, onSwitch }: Props) {
  const reduced = useReducedMotion()
  const order = agentOrder(agents, agent)
  const index = order.findIndex((a) => a.name === agent.name)
  const prev = index > 0 ? order[index - 1] : null
  const next = index < order.length - 1 ? order[index + 1] : null
  const state = agentState(agent, runs)
  const copy = STATE_COPY[state]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      if (overlayOpen()) return
      if (e.key === "Escape") {
        e.preventDefault()
        onBack()
      } else if (e.key === "j" && next) {
        onSwitch(next.name, 1)
      } else if (e.key === "k" && prev) {
        onSwitch(prev.name, -1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [next, prev, onBack, onSwitch])

  const groups = groupAgents(order)

  return (
    <TooltipProvider>
      <div
        className={cn(
          "-mx-4 flex h-14 items-center gap-2 bg-background/95 px-4 backdrop-blur-md transition-colors duration-200 supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10",
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onBack}
                aria-label="Back to AI Studio"
                className="group grid size-9 shrink-0 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
              />
            }
          >
            <ChevronLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Back <Kbd>Esc</Kbd>
          </TooltipContent>
        </Tooltip>

        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-[14px]">
          <button
            type="button"
            onClick={onBack}
            className="hidden shrink-0 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
          >
            AI Studio
          </button>
          <span aria-hidden className="hidden text-muted-foreground/50 sm:block">/</span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`${agentLabel(agent.name)}, switch agent`}
                  className="flex min-w-0 items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-secondary"
                />
              }
            >
              <AnimatePresence initial={false} mode="popLayout">
                {condensed && (
                  <motion.span
                    key="glyph"
                    initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <AgentGlyph name={agent.name} size="sm" muted={!agent.enabled} />
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="truncate font-medium text-foreground">{agentLabel(agent.name)}</span>
              {condensed && state !== "active" && (
                <span className={cn("hidden shrink-0 items-center gap-1.5 text-[12px] font-medium sm:inline-flex", copy.text)}>
                  <StatusDot className={copy.dot} pulse={state === "running"} />
                  {copy.label}
                </span>
              )}
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-1">
              {groups.map((g, gi) => (
                <DropdownMenuGroup key={g.key}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="px-2 py-1 text-[12px] font-medium text-muted-foreground">{g.label}</DropdownMenuLabel>
                  {g.agents.map((a) => {
                    const s = STATE_COPY[agentState(a, runs)]
                    const current = a.name === agent.name
                    const i = order.findIndex((o) => o.name === a.name)
                    return (
                      <DropdownMenuItem
                        key={a.name}
                        onClick={() => !current && onSwitch(a.name, i > index ? 1 : -1)}
                        className="gap-2.5 py-1.5"
                      >
                        <AgentGlyph name={a.name} size="sm" muted={!a.enabled} />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{agentLabel(a.name)}</span>
                        {current ? (
                          <Check className="size-3.5 text-foreground" aria-hidden />
                        ) : (
                          <StatusDot className={s.dot} pulse={s.label === "Running"} />
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <AnimatePresence initial={false}>
          {condensed && action && (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="shrink-0"
            >
              {action}
            </motion.div>
          )}
        </AnimatePresence>

        {order.length > 1 && (
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <span className="px-1.5 text-[12px] tabular-nums text-muted-foreground">
              {index + 1} of {order.length}
            </span>
            <StepButton
              label={prev ? `Previous: ${agentLabel(prev.name)}` : "First agent"}
              hint="K"
              disabled={!prev}
              onClick={() => prev && onSwitch(prev.name, -1)}
            >
              <ChevronUp className="size-4" aria-hidden />
            </StepButton>
            <StepButton
              label={next ? `Next: ${agentLabel(next.name)}` : "Last agent"}
              hint="J"
              disabled={!next}
              onClick={() => next && onSwitch(next.name, 1)}
            >
              <ChevronDown className="size-4" aria-hidden />
            </StepButton>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

function StepButton({
  label,
  hint,
  disabled,
  onClick,
  children,
}: {
  label: string
  hint: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="grid size-8 place-items-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label} <Kbd>{hint}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="ml-1.5 rounded border border-current/20 px-1 font-sans text-[10px] font-medium opacity-80">
      {children}
    </kbd>
  )
}

