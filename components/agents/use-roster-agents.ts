"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { listAgentConfigs } from "@/lib/actions/agent-configs"
import {
  agentsForStudioRoster,
  defaultChatAgentId,
  rosterAgentNames,
} from "@/lib/onboarding/agent-catalog"
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"

export function useRosterAgents() {
  const orgId = useWorkspaceOrgId()
  const { data: agentConfigs = [] } = useQuery({
    queryKey: ["agent-configs", orgId],
    queryFn: listAgentConfigs,
    staleTime: 30_000,
  })

  const roster = useMemo(
    () => agentsForStudioRoster(agentConfigs),
    [agentConfigs],
  )
  const agentNames = useMemo(() => rosterAgentNames(agentConfigs), [agentConfigs])
  const defaultAgent = useMemo(
    () => defaultChatAgentId(agentConfigs),
    [agentConfigs],
  )

  return { agentConfigs, roster, agentNames, defaultAgent }
}
