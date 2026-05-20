/*
 * Studio-wide status pill tones for agent runs.
 *
 * Per DESIGN.md the pill is light-pastel-fill with the saturated semantic
 * tone as text. Maps 1:1 to `agentRunStatus` from the schema.
 */
export const STATUS_TONE: Record<string, string> = {
  queued: "bg-secondary text-foreground",
  in_progress:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  awaiting_human:
    "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  succeeded:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  failed:
    "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
  cancelled: "bg-secondary text-muted-foreground",
}

export const PROVIDER_TONE: Record<string, string> = {
  gemini:
    "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
  anthropic:
    "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
  openrouter:
    "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  ollama:
    "bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-200",
  mock:
    "bg-secondary text-muted-foreground",
}
