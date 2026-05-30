"use server"

import { detectLlmStatus } from "@/lib/agents/runtime/llm-registry"

/**
 * Lightweight status probe so the UI can render a "running on fallback
 * provider" banner. Reads env at call time - cheap, no network. Cached
 * by TanStack Query on the client (60s staleTime).
 */
export async function getLlmStatus() {
  return detectLlmStatus()
}
