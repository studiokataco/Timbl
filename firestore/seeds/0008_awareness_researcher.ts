import { db, ensureEmulator, SAFE_ORG_ID, withAudit } from "./_helpers"

/*
 * Seeds the awareness-researcher agent. Idempotent — `set({ merge: true })`
 * preserves user edits made through /settings/agents. The agent is gemini-
 * only because GOOGLE_SEARCH grounding has no equivalent in other
 * providers; the persistence tool short-circuits if pointed at Anthropic
 * or Mock.
 */

const AWARENESS_RESEARCHER_PROMPT =
  "You are the SAFE planner's awareness-day researcher. Given a date range and optional region, use Google Search and URL_CONTEXT to find real, verifiable awareness days, international observances, and significant cultural / health / social dates. Every proposal must cite at least one reputable source URL. Stop after 5–10 high-quality items. Never invent dates or sources."

export async function seed0008AwarenessResearcher() {
  ensureEmulator()
  const ref = db()
    .collection("organizations")
    .doc(SAFE_ORG_ID)
    .collection("agentConfigs")
    .doc("awareness-researcher")

  await ref.set(
    withAudit({
      id: "awareness-researcher",
      organizationId: SAFE_ORG_ID,
      name: "awareness-researcher",
      role: "workflow",
      description:
        "Web-research-driven discovery of awareness days. Uses Gemini GOOGLE_SEARCH grounding to find real observances in a window, writes them as proposals for human review before they enter the official awarenessDays collection.",
      provider: "gemini",
      model: "gemini-2.5-flash",
      temperature: 0.3,
      systemPrompt: AWARENESS_RESEARCHER_PROMPT,
      enabled: true,
      schedule: null,
      allowedTools: [
        "google_search",
        "url_context",
        "proposeAwarenessDay",
      ],
      triggers: { manual: true, cron: false, systemUserId: "system" },
      budgets: {
        maxLlmCalls: 30,
        maxToolCalls: 60,
        maxUsdCost: 2,
        maxReviewLoops: 3,
        monthlyUsdCap: 25,
      },
    }),
    { merge: true },
  )
  console.log("✓ agentConfig: awareness-researcher")
}
