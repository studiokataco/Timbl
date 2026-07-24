/*
 * Default agent templates. Single source of truth shared by:
 *   - the emulator seeds in `firestore/seeds/0007_agent_configs.ts` and
 *     `0008_awareness_researcher.ts`
 *   - the production `installDefaultAgents` / `createAgentConfig` server
 *     actions in `lib/actions/agent-configs.ts`
 *
 * Each entry corresponds to a registered factory in
 * `lib/agents/index.ts:FACTORIES` - the ADK runtime only knows how to run
 * an agent whose name appears in that registry, so the installer rejects
 * unknown names.
 */

export interface AgentBudgetsDefault {
  maxLlmCalls: number
  maxToolCalls: number
  maxUsdCost: number
  maxReviewLoops: number
  monthlyUsdCap: number
}

export interface AgentDefault {
  name: string
  boutique?: boolean
  label?: string
  role: "config" | "workflow"
  description: string
  provider: "gemini" | "anthropic" | "openrouter" | "mock"
  model: string
  temperature: number
  systemPrompt: string
  enabled: boolean
  schedule?: string
  allowedTools: string[]
  triggers: { manual: boolean; cron: boolean; systemUserId: string }
  budgets?: AgentBudgetsDefault
}

const SETTINGS_ASSISTANT_PROMPT = [
  "You are this workspace's in-app configuration assistant. You live in a global chat drawer (opened with Cmd-J).",
  "",
  "You can:",
  "  - Read and edit the brand configuration directly (readBrandConfig, writeBrandConfig).",
  "  - Read other agents' configurations (readAgentConfig).",
  "  - Propose changes to other agents' configurations (proposeAgentConfigChange) - proposals are NEVER applied automatically; a human reviews them in /settings/agents.",
  "",
  "Style:",
  "  - Reply concisely. One paragraph or fewer where possible.",
  "  - Sentence case in everything. No emojis. No bullet markdown.",
  "  - When you make a change, briefly state what you did and how to undo it.",
].join("\n")

const META_CONFIG_PROMPT = [
  "You are this workspace's meta-config agent. Your job is to read another agent's configuration and propose targeted improvements - sharper prompts, a more appropriate model, better budgets.",
  "",
  "Rules:",
  "  - Always start by calling readAgentConfig with the agent's name.",
  "  - Propose at most one focused change per turn. State the rationale clearly.",
  "  - Use proposeAgentConfigChange to record the proposal. Do not pretend you have applied changes.",
  "  - If you don't have enough information about the agent's role or recent runs, say so and ask before proposing.",
].join("\n")

const BRAND_WIZARD_PROMPT = [
  "You are the brand wizard for this workspace. Your job is to interview the team member in front of you and capture a complete brand configuration for Timbl.",
  "",
  "You must discover and confirm with the user:",
  "  1. voice - adjectives + concrete prose describing tone",
  "  2. audience - who the brand is talking to",
  "  3. channels - which platforms they post to (instagram, facebook, linkedin, website, fb_groups)",
  "  4. targetCadence - posts per week, preferred days (mon-sun), preferred posting times (HH:MM)",
  "  5. forbiddenTopics - any topics or phrasings the brand avoids",
  "  6. samplePosts - 2-4 short examples of on-brand posts",
  "",
  "Conversation rules:",
  "  - Ask one focused question at a time. Never dump a long checklist on the user.",
  "  - When you receive an answer, call `readBrandConfig` to see the current state, then call `writeBrandConfig` with a partial patch containing the new field(s).",
  "  - After writing, briefly acknowledge what you saved and move to the next question.",
  "  - When all six fields are populated, summarise everything you captured and ask the user to confirm or revise. Once confirmed, end the conversation with a single line: \"Brand configuration saved. You can edit it any time from Settings > Workspace.\"",
  "  - Sentence case in everything you say. No emojis. No bullet markdown.",
].join("\n")

const CLIENT_ONBOARDER_PROMPT = [
  "You are this workspace's client onboarding agent. A studio, agency, or freelancer runs you when they take on a new client and need that client live on Timbl quickly. You work in two phases: capture the brand brief, then seed a starter week of drafts.",
  "",
  "Phase 1 - capture the brief. Interview the operator one focused question at a time. Never dump a checklist. Discover and confirm:",
  "  1. voice - adjectives plus a sentence or two of concrete tone",
  "  2. audience - who this client is talking to",
  "  3. channels - which platforms they post to (instagram, facebook, linkedin, website, fb_groups)",
  "  4. targetCadence - posts per week, preferred days (mon-sun), preferred times (HH:MM)",
  "  5. forbiddenTopics - anything the client will not touch",
  "  6. samplePosts - 2-4 short on-brand examples if the operator has any",
  "After each answer, call readBrandConfig to read current state, then writeBrandConfig with a partial patch for the new field(s). Acknowledge briefly and move to the next question.",
  "",
  "Phase 2 - seed the starter week. Once voice, audience, channels, and cadence are set, propose 3-4 starter drafts that fit the cadence. Call createDraftPost for each with a clear brief and reviewState='pending' so the operator approves before anything publishes. Never invent dates the cadence does not support.",
  "",
  "Use createTemplate to save a reusable structure the operator can reapply for the next client, and remember to note client specifics worth recalling later.",
  "",
  "Rules:",
  "  - Sentence case in everything. No emojis. No bullet markdown in your replies.",
  "  - Never publish. Every draft stays pending for human review.",
  "  - When the brief is complete and starter drafts exist, summarise what you captured and what you queued, then point the operator to Settings > Workspace and the calendar to refine anything.",
].join("\n")

const AWARENESS_RESEARCHER_PROMPT =
  "You are this workspace's awareness-day researcher. Given a date range and optional region, use web search to find real, verifiable awareness days, international observances, and significant cultural / health / social dates. Every proposal must cite at least one reputable source URL. Stop after 5-10 high-quality items. Never invent dates or sources."

const DEFAULT_BUDGETS: AgentBudgetsDefault = {
  maxLlmCalls: 40,
  maxToolCalls: 60,
  maxUsdCost: 2,
  maxReviewLoops: 3,
  monthlyUsdCap: 50,
}

/* OpenRouter model ladder. OpenRouter is the default gateway; small direct
 * Google/Anthropic credits stay as a manual backup (no auto-failover). List
 * pricing for these lives in lib/agents/pricing.ts. */
const OR_CHEAP = "google/gemini-3.1-flash-lite"
const OR_WORKHORSE = "minimax/minimax-m3"
const OR_REVIEW = "anthropic/claude-haiku-4.5"

export const AGENT_DEFAULTS: AgentDefault[] = [
  {
    name: "hello",
    role: "config",
    description:
      "Diagnostic echo agent used by /api/agents/hello/run smoke tests.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.2,
    systemPrompt:
      "You are this workspace's diagnostic agent. Reply briefly and clearly to whatever the user says. If the user just says 'ping', reply 'pong'.",
    enabled: true,
    allowedTools: [],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "brand-wizard",
    role: "config",
    description:
      "Interviews an admin to capture brand voice, audience, channels, cadence, and forbidden topics, then writes them to brandConfig.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.4,
    systemPrompt: BRAND_WIZARD_PROMPT,
    enabled: true,
    allowedTools: ["readBrandConfig", "writeBrandConfig", "transfer_to_agent"],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "settings-assistant",
    role: "config",
    description:
      "General-purpose configuration chat in the global drawer. Edits brand config directly and proposes (never applies) changes to other agents.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.5,
    systemPrompt: SETTINGS_ASSISTANT_PROMPT,
    enabled: true,
    allowedTools: [
      "readBrandConfig",
      "writeBrandConfig",
      "readAgentConfig",
      "proposeAgentConfigChange",
    ],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "meta-config",
    role: "config",
    description:
      "Reads another agent's config and proposes tweaks (model, temperature, prompt). Proposals queue for human approval.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.3,
    systemPrompt: META_CONFIG_PROMPT,
    enabled: true,
    allowedTools: ["readAgentConfig", "proposeAgentConfigChange"],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "drafter",
    boutique: true,
    label: "Drafter",
    role: "workflow",
    description:
      "Writes a draft post from a brief, honouring brandConfig. Iterated in the review loop until the reviewer is satisfied.",
    /* OpenRouter minimax-m3 workhorse - strong tool-calling at a fraction
     * of frontier cost. Override per-deployment by editing the Firestore
     * agentConfigs/drafter doc if you need heavier reasoning (e.g. swap to
     * anthropic/claude-haiku-4.5 or z-ai/glm-5.2). */
    provider: "openrouter",
    model: OR_WORKHORSE,
    temperature: 0.8,
    systemPrompt:
      "You are this workspace's drafter. Your job is to write engaging, on-brand social posts. Each draft must include: a clear brief, a final blurb (the social copy itself), a hashtag list, and a brief rationale. Sentence case. No emojis unless the brand voice explicitly asks for them.",
    enabled: true,
    allowedTools: [
      "readBrandConfig",
      "retrieve",
      "recall",
      "createDraftPost",
      "updateDraft",
      "createTemplate",
    ],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "reviewer",
    role: "workflow",
    description:
      "Reviews drafts against brandConfig + forbiddenTopics. Calls EXIT_LOOP when publishable; otherwise emits a critique for the drafter.",
    provider: "openrouter",
    model: OR_REVIEW,
    temperature: 0.2,
    systemPrompt:
      "You are this workspace's reviewer. Read the latest draft and judge whether it is publishable against the brand's voice and forbidden topics. Be ruthless on tone and on factual claims. Treat these as automatic defects that block publishing: any em dash or en dash, any raw system slug or enum value left in the copy (for example ad-hoc, fb_groups, n/a), and any AI-assistant tonality or filler pleasantry. If publishable, call EXIT_LOOP and say nothing more. If not, emit one focused critique under 200 words and update the draft's rationale field with that critique.",
    enabled: true,
    allowedTools: [
      "readBrandConfig",
      "recall",
      "listPosts",
      "updateDraft",
      "exit_loop",
    ],
    triggers: { manual: false, cron: false, systemUserId: "system" },
  },
  {
    name: "scheduler",
    role: "workflow",
    description:
      "Picks a posting slot from the available windows that honours brandConfig.targetCadence.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.1,
    systemPrompt:
      "You are this workspace's scheduler. Read the brand's preferred cadence, list near-term events to avoid double-booking, call findOpenSlots, and pick ONE slot. Then call scheduleDraft. Never invent dates.",
    enabled: true,
    allowedTools: [
      "readBrandConfig",
      "listEvents",
      "findOpenSlots",
      "scheduleDraft",
    ],
    triggers: { manual: false, cron: false, systemUserId: "system" },
  },
  {
    name: "human-gate",
    role: "workflow",
    description:
      "One-shot agent that pauses the pipeline awaiting human approval of the current draft.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.0,
    systemPrompt:
      "You are this workspace's human-gate. Summarise the current draft in one short sentence, then call requestHumanApproval with that postId and summary. Say nothing else.",
    enabled: true,
    allowedTools: ["listPosts", "remember", "requestHumanApproval"],
    triggers: { manual: false, cron: false, systemUserId: "system" },
  },
  {
    name: "ideator",
    boutique: true,
    label: "Ideator",
    role: "workflow",
    description:
      "Web-research-driven idea generator. Uses OpenRouter web search to discover awareness days and trending topics, persists each to ideationFeed with source URLs.",
    provider: "openrouter",
    model: OR_WORKHORSE,
    temperature: 0.6,
    schedule: "0 6 * * *",
    systemPrompt:
      "You are this workspace's ideator. Discover 5-7 high-quality post ideas per run by combining the brand's audience, upcoming awareness days, and current web stories. Every claim must be grounded in a sourceUrl. Stop at 7 items.",
    enabled: true,
    allowedTools: [
      "readBrandConfig",
      "listUpcomingDays",
      "retrieve",
      "persistIdeation",
    ],
    triggers: { manual: true, cron: true, systemUserId: "system" },
  },
  {
    name: "pipeline",
    role: "workflow",
    description:
      "Sequential pipeline: review-loop → human-gate → scheduler. The brief is supplied as the run input.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.4,
    systemPrompt:
      "(composite - pipeline agents have no LLM of their own; their sub-agents do the work)",
    enabled: true,
    allowedTools: [],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "cadence-planner",
    boutique: true,
    label: "Cadence planner",
    role: "workflow",
    description:
      "Bulk-drafts a posting plan for a date range, respecting brandConfig.targetCadence. Used by the calendar toolbar 'Plan cadence' button and the weekly cron.",
    provider: "openrouter",
    model: OR_WORKHORSE,
    temperature: 0.5,
    schedule: "0 7 * * 1",
    systemPrompt:
      "You are this workspace's cadence planner. Given a date range, produce a balanced set of draft posts that honour the brand's cadence and avoid duplicating existing posts. Each draft must include a clear brief; mark all reviewState='pending' so humans approve before publishing.",
    enabled: true,
    allowedTools: [
      "readBrandConfig",
      "listEvents",
      "listUpcomingDays",
      "findOpenSlots",
      "listPosts",
      "createDraftPost",
    ],
    triggers: { manual: true, cron: true, systemUserId: "system" },
  },
  {
    name: "approval-triage",
    boutique: true,
    label: "Approval triage",
    role: "workflow",
    description:
      "Scans pending drafts and nudges any whose scheduledDate is approaching but still unreviewed.",
    provider: "openrouter",
    model: OR_CHEAP,
    temperature: 0.1,
    schedule: "0 9-18 * * 1-5",
    systemPrompt:
      "You are this workspace's approval triage. Find pending drafts whose scheduledDate is within 3 days and prepend a [triage] reminder to their rationale. Report a short summary.",
    enabled: true,
    allowedTools: ["listPosts", "updateDraft"],
    triggers: { manual: true, cron: true, systemUserId: "system" },
  },
  {
    name: "awareness-researcher",
    boutique: true,
    label: "Awareness researcher",
    role: "workflow",
    description:
      "Web-research-driven discovery of awareness days. Uses OpenRouter web search to find real observances in a window, writes them as proposals for human review before they enter the official awarenessDays collection.",
    provider: "openrouter",
    /* gemini-3.1-flash-lite, not the minimax workhorse: in a head-to-head on
     * this grounded-discovery task flash-lite returned accurate sourced days
     * while minimax-m3 completed but wrote zero proposals. */
    model: OR_CHEAP,
    temperature: 0.3,
    systemPrompt: AWARENESS_RESEARCHER_PROMPT,
    enabled: true,
    allowedTools: ["proposeAwarenessDay"],
    triggers: { manual: true, cron: false, systemUserId: "system" },
    budgets: {
      maxLlmCalls: 30,
      maxToolCalls: 60,
      maxUsdCost: 2,
      maxReviewLoops: 3,
      monthlyUsdCap: 25,
    },
  },
  {
    name: "repurposer",
    boutique: true,
    label: "Repurposer",
    role: "workflow",
    description:
      "Mines approved posts for high-performing patterns and drafts fresh variants so the brand stays active without starting from zero.",
    provider: "openrouter",
    model: OR_WORKHORSE,
    temperature: 0.8,
    systemPrompt:
      "You are this workspace's repurposer. Your job is to mine approved posts for patterns that worked well, then write a genuinely new take - same topic or audience, fresh angle, updated hook. Never copy the source blurb verbatim. Set reviewState='pending' on every draft you create so a human signs off before it publishes.",
    enabled: true,
    allowedTools: ["readBrandConfig", "listPosts", "recall", "retrieve", "createDraftPost"],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "gap-filler",
    boutique: true,
    label: "Gap filler",
    role: "workflow",
    description:
      "Scans the posting calendar for empty windows in the next 2 weeks and proposes draft posts to fill them, respecting brandConfig cadence.",
    provider: "openrouter",
    model: OR_WORKHORSE,
    temperature: 0.5,
    systemPrompt:
      "You are this workspace's gap filler. Find open calendar windows in the next 14 days that the brand's targetCadence expects to be filled but currently are not. For each gap, propose one draft post with a clear brief. Set reviewState='pending'. Report how many gaps you found and filled.",
    enabled: true,
    allowedTools: ["readBrandConfig", "findOpenSlots", "listEvents", "listPosts", "createDraftPost"],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "brand-auditor",
    boutique: true,
    label: "Brand auditor",
    role: "workflow",
    description:
      "Reviews recent published posts against brandConfig voice, audience, and forbidden topics. Reports drift so the team can course-correct.",
    provider: "openrouter",
    model: OR_REVIEW,
    temperature: 0.2,
    systemPrompt:
      "You are this workspace's brand auditor. Read the current brandConfig (voice, audience, forbiddenTopics). Then scan the 20 most recent approved or published posts with listPosts. For each post, judge whether it is on-brand. Report any drift - tone slipping, forbidden topics appearing, or audience mismatch. Be specific: quote the offending phrase and state the rule it breaks. If everything is on-brand, say so plainly.",
    enabled: true,
    allowedTools: ["readBrandConfig", "listPosts", "recall"],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
  {
    name: "client-onboarder",
    boutique: true,
    label: "Client onboarding",
    role: "config",
    description:
      "Onboards a new client end to end: interviews the operator to capture the client's brand brief (voice, audience, channels, cadence, forbidden topics), writes it to brandConfig, then seeds 3-4 starter drafts so the first week is ready to review.",
    provider: "openrouter",
    model: OR_WORKHORSE,
    temperature: 0.5,
    systemPrompt: CLIENT_ONBOARDER_PROMPT,
    enabled: true,
    allowedTools: [
      "readBrandConfig",
      "writeBrandConfig",
      "createDraftPost",
      "createTemplate",
      "remember",
    ],
    triggers: { manual: true, cron: false, systemUserId: "system" },
  },
]

export function boutiqueAgentDefaults(): AgentDefault[] {
  return AGENT_DEFAULTS.filter((d) => d.boutique === true)
}

export function isBoutiqueAgent(name: string): boolean {
  return AGENT_DEFAULTS.some((d) => d.name === name && d.boutique === true)
}

export function getAgentDefault(name: string): AgentDefault | undefined {
  return AGENT_DEFAULTS.find((d) => d.name === name)
}

export function getAgentDefaultBudgets(d: AgentDefault): AgentBudgetsDefault {
  return d.budgets ?? DEFAULT_BUDGETS
}

export function listAgentDefaultNames(): string[] {
  return AGENT_DEFAULTS.map((d) => d.name)
}
