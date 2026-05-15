"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"

import { getLlmStatus } from "@/lib/actions/llm-status"
import { cn } from "@/lib/utils"

/*
 * Thin banner that surfaces when the LLM registry is running on a
 * fallback (mock or Anthropic when Gemini was expected). Renders
 * nothing when keys are correctly configured.
 *
 * Mounted at the top of `AgentChat` and inside the cadence dialog.
 * Polled via TanStack Query (60s staleTime) — env doesn't change at
 * runtime but a stale-while-revalidate cache keeps it cheap.
 */

export function LlmStatusBanner({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["llm-status"],
    queryFn: getLlmStatus,
    staleTime: 60_000,
  })

  if (!data || !data.fallback) return null

  const message =
    data.effective === "mock"
      ? "No LLM API key configured — running on mock provider. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env.local to enable real responses."
      : "GEMINI_API_KEY not set — falling back to Anthropic. Set GEMINI_API_KEY in .env.local for Gemini-default agents."

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md bg-secondary px-3 py-2 text-[12px] text-muted-foreground",
        className,
      )}
    >
      <AlertTriangle
        className="size-3.5 text-foreground shrink-0 mt-0.5"
        aria-hidden
      />
      <span className="leading-snug">{message}</span>
    </div>
  )
}
