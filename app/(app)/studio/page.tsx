import { listAgentConfigs } from "@/lib/actions/agent-configs"
import { listAgentRuns } from "@/lib/actions/agent-runs"
import { listIdeationFeed } from "@/lib/actions/ideation"
import { countPublishablePosts } from "@/lib/actions/posts"

import { StudioWorkspace } from "@/components/studio/studio-workspace"

export const dynamic = "force-dynamic"

/*
 * Studio — AI Command Center (Phase A: read-only).
 *
 * Server component: hydrates agents, recent runs, and the "new" ideation
 * feed in parallel from existing list actions, then hands them to the
 * client-side workspace which owns the three-column shell + URL-driven
 * selection. No mutations yet — purely a visual surface.
 */
export default async function StudioPage() {
  const [agents, runs, ideation, publishCounts] = await Promise.all([
    listAgentConfigs(),
    listAgentRuns({ limit: 50 }),
    listIdeationFeed({ status: "new" }),
    countPublishablePosts(),
  ])

  return (
    <StudioWorkspace
      agents={agents}
      runs={runs}
      ideation={ideation}
      publishCounts={publishCounts}
    />
  )
}
