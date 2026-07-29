import { z } from "zod"
import { audit, isoTimestamp } from "./_shared"
import { agentProvider } from "./agentConfig"

export const agentRunTrigger = z.enum(["manual", "cron", "pipeline"])
export type AgentRunTrigger = z.infer<typeof agentRunTrigger>

export const agentRunStatus = z.enum([
  "queued",
  "in_progress",
  "awaiting_human",
  "succeeded",
  "failed",
  "cancelled",
])
export type AgentRunStatus = z.infer<typeof agentRunStatus>

export const agentRunMetricsSchema = z.object({
  llmCalls: z.number().int().nonnegative().default(0),
  toolCalls: z.number().int().nonnegative().default(0),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  /** Slice of promptTokens served from the prompt cache (read hits). Lets the
   * UI show cache effectiveness and feeds the cache discount in usdCost. */
  cachedTokens: z.number().int().nonnegative().default(0),
  /** Estimated cost from the static price table, written at run end. */
  usdCost: z.number().nonnegative().default(0),
  /** Exact cost reconciled from OpenRouter's GET /generation per generation
   * id. Authoritative for spend reporting; absent until reconciled. */
  actualUsdCost: z.number().nonnegative().optional(),
})
export type AgentRunMetrics = z.infer<typeof agentRunMetricsSchema>

/* `message` alone cannot answer "which layer raised this". An AbortError
 * from a provider SDK, from our own request signal, and from a Firestore
 * retry all read identically in a run doc, so a post-mortem stalls on the
 * one field that was recorded. Everything past `message` is optional: it is
 * forensic detail, and a run that fails without it must still be storable. */
export const agentRunErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  /** Error constructor name - AbortError, APIUserAbortError, TypeError. */
  name: z.string().optional(),
  stack: z.string().max(4_000).optional(),
  /** Provider and model in flight when it failed. Copied from the run doc so
   * the error survives independently of later edits to those fields. */
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  /** Last upstream call handle issued before the failure - the join key to
   * the provider's own logs. */
  lastGenerationId: z.string().optional(),
  /** Whether the client had already disconnected. Separates "the user walked
   * away" from "the request died under us". */
  clientDisconnected: z.boolean().optional(),
  /** Completed LLM/tool calls at the point of failure - distinguishes a run
   * that never started from one that died deep in a loop. */
  llmCalls: z.number().int().nonnegative().optional(),
  toolCalls: z.number().int().nonnegative().optional(),
  failedAt: z.string().optional(),
})
export type AgentRunError = z.infer<typeof agentRunErrorSchema>

export const agentRunSchema = audit.extend({
  id: z.string(),
  organizationId: z.string(),
  brandId: z.string().default("default"),
  agentName: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  trigger: agentRunTrigger,
  status: agentRunStatus.default("queued"),
  /* The provider + exact model the run actually used - captured at run
   * start so a prod-swap A/B (§6.6 of the pluggable-providers plan) can
   * compare a swapped model against the prior model's runs. Optional +
   * nullable: runs written before this field existed have neither. */
  provider: agentProvider.nullable().optional(),
  model: z.string().nullable().optional(),
  startedAt: isoTimestamp,
  finishedAt: isoTimestamp.optional(),
  durationMs: z.number().int().nonnegative().optional(),
  inputSummary: z.string().max(2_000).optional(),
  outputs: z
    .object({
      postIds: z.array(z.string()).default([]),
      ideationItemIds: z.array(z.string()).default([]),
    })
    .default({ postIds: [], ideationItemIds: [] }),
  error: agentRunErrorSchema.optional(),
  metrics: agentRunMetricsSchema.default({
    llmCalls: 0,
    toolCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    usdCost: 0,
  }),
  /* Stored as `null` by triggers/manual.ts when absent (Firestore can't
   * persist `undefined`). Zod v4's .optional() rejects null, so allow both
   * - otherwise every agentRun fails safeParse silently in listAgentRuns
   * and /studio renders "No agent runs yet" despite real runs existing. */
  parentRunId: z.string().nullable().optional(),
  dedupKey: z.string().nullable().optional(),
  /* OpenRouter generation handles for every LLM call in the run. Used to
   * reconcile estimated cost against exact cost via GET /generation. */
  generationIds: z.array(z.string()).optional(),
  /* Source URLs returned by web-search citations across the run, so an
   * ideator/researcher's grounding survives even if the model doesn't echo
   * each URL in prose. */
  sourceUrls: z.array(z.string()).optional(),
})
export type AgentRunDoc = z.infer<typeof agentRunSchema>
