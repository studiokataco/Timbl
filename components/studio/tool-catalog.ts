/*
 * Static catalog of agent tools — keyed by the `name` declared on each
 * `FunctionTool` / `LongRunningFunctionTool` instance under
 * `lib/agents/tools/`. The agent runtime owns the source of truth; this
 * map is a UI-only mirror so the playground's Tools tab and the
 * AgentChat tool-call chiclets can show a humanized title + description
 * without dynamically importing the server-only tool modules.
 *
 * When adding a tool, mirror its `description` here so the UI matches
 * the agent's actual contract.
 */

export type ToolCatalogEntry = {
  key: string
  title: string
  description: string
  group: "calendar" | "brand" | "posts" | "kanban" | "research" | "human" | "admin" | "awareness"
}

export const TOOL_CATALOG: Record<string, ToolCatalogEntry> = {
  listUpcomingDays: {
    key: "listUpcomingDays",
    title: "List awareness days",
    description:
      "List awareness days in a date window — the ideation starting point.",
    group: "awareness",
  },
  listEvents: {
    key: "listEvents",
    title: "List events",
    description:
      "List off-calendar events (conferences, campaigns, awareness days) in a window.",
    group: "calendar",
  },
  findOpenSlots: {
    key: "findOpenSlots",
    title: "Find open slots",
    description:
      "Compute candidate posting slots that honour the brand cadence preferences.",
    group: "calendar",
  },
  scheduleDraft: {
    key: "scheduleDraft",
    title: "Schedule draft",
    description:
      "Set the scheduledDate / scheduledTime on an existing post to lock a slot.",
    group: "calendar",
  },
  readBrandConfig: {
    key: "readBrandConfig",
    title: "Read brand config",
    description:
      "Read the organisation's current brand configuration (returns null if not set up).",
    group: "brand",
  },
  writeBrandConfig: {
    key: "writeBrandConfig",
    title: "Write brand config",
    description:
      "Persist a partial brand configuration — existing fields are preserved.",
    group: "brand",
  },
  createDraftPost: {
    key: "createDraftPost",
    title: "Create draft post",
    description:
      "Create a new draft post in the org's calendar with brief + rationale.",
    group: "posts",
  },
  updateDraft: {
    key: "updateDraft",
    title: "Update draft",
    description:
      "Update an existing post the agent (or a teammate) already created.",
    group: "posts",
  },
  listPosts: {
    key: "listPosts",
    title: "List posts",
    description:
      "List posts in the org's calendar, optionally scoped to agent drafts.",
    group: "posts",
  },
  movePostToColumn: {
    key: "movePostToColumn",
    title: "Move post to column",
    description:
      "Change a post's status by moving it to a different kanban column.",
    group: "kanban",
  },
  listColumns: {
    key: "listColumns",
    title: "List kanban columns",
    description: "List the org's kanban columns in display order.",
    group: "kanban",
  },
  moveCard: {
    key: "moveCard",
    title: "Move card",
    description:
      "Alias of movePostToColumn for agents that think in kanban terms.",
    group: "kanban",
  },
  persistIdeation: {
    key: "persistIdeation",
    title: "Persist ideation item",
    description:
      "Save a single ideation item to the org's feed (with source URLs for verification).",
    group: "research",
  },
  requestHumanApproval: {
    key: "requestHumanApproval",
    title: "Request human approval",
    description:
      "Pause the run and ask a human to approve a draft. Resumes when the human acts.",
    group: "human",
  },
  readAgentConfig: {
    key: "readAgentConfig",
    title: "Read agent config",
    description:
      "Read another agent's configuration. Used by the meta-config agent.",
    group: "admin",
  },
  proposeAgentConfigChange: {
    key: "proposeAgentConfigChange",
    title: "Propose config change",
    description:
      "Queue a partial agent-config patch for human approval — never applied silently.",
    group: "admin",
  },
}

export function getTool(key: string): ToolCatalogEntry {
  return (
    TOOL_CATALOG[key] ?? {
      key,
      title: humanize(key),
      description: "Tool — no description available.",
      group: "admin",
    }
  )
}

export function listToolKeys(): string[] {
  return Object.keys(TOOL_CATALOG)
}

function humanize(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}
