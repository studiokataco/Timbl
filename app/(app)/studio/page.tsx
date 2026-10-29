import { listAgentConfigs } from "@/lib/actions/agent-configs"
import { listAgentRuns } from "@/lib/actions/agent-runs"
import { listApprovalsLog } from "@/lib/actions/approvals"
import { listIdeationFeed } from "@/lib/actions/ideation"
import { getStudioUsage } from "@/lib/actions/usage"

import { StudioWorkspace } from "@/components/studio/studio-workspace"

export const dynamic = "force-dynamic"

export default async function StudioPage() {
  const [agents, runs, ideation, approvals, usage] = await Promise.all([
    listAgentConfigs(),
    listAgentRuns({ limit: 200 }),
    listIdeationFeed({ status: "new" }),
    listApprovalsLog({ limit: 50 }),
    getStudioUsage(),
  ])

  return (
    <StudioWorkspace
      agents={agents}
      runs={runs.slice(0, 50)}
      history={runs}
      ideation={ideation}
      approvals={approvals}
      usage={usage}
    />
  )
}
