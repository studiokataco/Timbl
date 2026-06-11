import type { BaseAgent } from "@google/adk"
import { Runner } from "@google/adk"

import { TIMBL_AGENT_APP_NAME } from "@/lib/constants/timbl"
import { FirestoreSessionService } from "./session-service"

/*
 * One Runner per (orgId, agent, sessionId). The Runner itself is light
 * (mostly a coordinator around a SessionService + an agent tree) so there's
 * no benefit to a shared singleton across requests, and per-request makes
 * org isolation a property of the type system rather than an honor system.
 */

export interface BuildRunnerInput {
  orgId: string
  agent: BaseAgent
  appName?: string
}

export const AGENT_APP_NAME = TIMBL_AGENT_APP_NAME

export function buildRunner({ orgId, agent, appName }: BuildRunnerInput): Runner {
  return new Runner({
    appName: appName ?? AGENT_APP_NAME,
    agent,
    sessionService: new FirestoreSessionService(orgId),
  })
}
