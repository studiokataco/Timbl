"use server"

import { z } from "zod"

import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { askAssistant } from "@/lib/platform/assistant/agent"

const input = z.object({ question: z.string().min(1).max(2000) })

export interface AssistantResponse {
  ok: boolean
  answer?: string
  tool?: string
  error?: string
}

export async function askPlatformAssistant(raw: unknown): Promise<AssistantResponse> {
  await requirePlatformAdmin()
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  try {
    const res = await askAssistant(parsed.data.question)
    return { ok: true, answer: res.answer, tool: res.tool }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "assistant_error" }
  }
}
