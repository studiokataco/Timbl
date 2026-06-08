import "server-only"

import { compareTwoStrings } from "string-similarity"

import { usd, compact, pct } from "@/lib/platform/format"
import {
  getGlobalRollup,
  getOrgPeriod,
  listOrgRows,
  listRunsByStatus,
  type OrgRow,
} from "@/lib/platform/queries"
import { getRevenueSummary } from "@/lib/platform/revenue"

/*
 * The assistant's tool catalog. Each tool runs a real, bounded query against
 * the platform rollups and returns BOTH structured data and a plain-language
 * summary. The model never emits a query - it only picks a tool + args, so
 * every figure the assistant states comes from a tool result here (grounded,
 * no hallucinated numbers).
 */

export interface ToolResult {
  tool: string
  summary: string
  data: unknown
}

export const TOOL_NAMES = [
  "platform_summary",
  "cost_leaderboard",
  "cost_by_model",
  "failing_runs",
  "revenue_summary",
  "org_health",
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

export const TOOL_SPECS: { name: ToolName; description: string; args: string }[] = [
  { name: "platform_summary", description: "Headline platform totals: spend, runs, active orgs, failure rate.", args: "{}" },
  { name: "cost_leaderboard", description: "Top organisations by month-to-date AI spend.", args: '{ "topN"?: number }' },
  { name: "cost_by_model", description: "AI cost broken down by model and provider.", args: "{}" },
  { name: "failing_runs", description: "Most recent failed agent runs across all orgs.", args: '{ "limit"?: number }' },
  { name: "revenue_summary", description: "Estimated MRR, plan distribution, infra cost, margin.", args: "{}" },
  { name: "org_health", description: "Health of one organisation by name or id.", args: '{ "org": string }' },
]

async function resolveOrg(query: string, orgs: OrgRow[]): Promise<OrgRow | null> {
  const q = query.toLowerCase().trim()
  const exact = orgs.find((o) => o.orgId.toLowerCase() === q || o.name.toLowerCase() === q)
  if (exact) return exact
  let best: { org: OrgRow; score: number } | null = null
  for (const o of orgs) {
    const score = Math.max(
      compareTwoStrings(q, o.name.toLowerCase()),
      compareTwoStrings(q, o.orgId.toLowerCase()),
    )
    if (!best || score > best.score) best = { org: o, score }
  }
  return best && best.score >= 0.3 ? best.org : null
}

export async function runTool(
  name: ToolName,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  switch (name) {
    case "platform_summary": {
      const r = await getGlobalRollup()
      const total = r.succeeded + r.failed
      const failRate = total > 0 ? r.failed / total : 0
      return {
        tool: name,
        summary: `For ${r.period}: ${usd(r.usdCost)} spent across ${compact(r.agentRuns)} runs in ${r.activeOrgs} active orgs. Failure rate ${pct(failRate)}.`,
        data: r,
      }
    }
    case "cost_leaderboard": {
      const topN = Math.min(Math.max(Number(args.topN) || 5, 1), 20)
      const orgs = (await listOrgRows()).slice(0, topN)
      const lines = orgs
        .map((o, i) => `${i + 1}. ${o.name} - ${usd(o.mtdUsdCost)} (${compact(o.mtdAgentRuns)} runs)`)
        .join("\n")
      return {
        tool: name,
        summary: orgs.length ? `Top ${orgs.length} orgs by spend (MTD):\n${lines}` : "No org spend recorded yet.",
        data: orgs,
      }
    }
    case "cost_by_model": {
      const r = await getGlobalRollup()
      const models = Object.entries(r.byModel)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${r.modelNames[k] ?? k}: ${usd(v)}`)
      const providers = Object.entries(r.byProvider)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${usd(v)}`)
      return {
        tool: name,
        summary: `Cost by model (${r.period}):\n${models.join("\n") || "none"}\n\nBy provider:\n${providers.join("\n") || "none"}`,
        data: { byModel: r.byModel, modelNames: r.modelNames, byProvider: r.byProvider },
      }
    }
    case "failing_runs": {
      const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 25)
      const runs = await listRunsByStatus(["failed"], limit)
      const lines = runs
        .map((run) => `- ${run.agentName} @ ${run.orgId}: ${run.error ?? "no message"}`)
        .join("\n")
      return {
        tool: name,
        summary: runs.length ? `${runs.length} recent failures:\n${lines}` : "No recent failures.",
        data: runs,
      }
    }
    case "revenue_summary": {
      const rev = await getRevenueSummary()
      return {
        tool: name,
        summary: `Est. MRR ${usd(rev.estMrrUsd)} from ${rev.payingOrgs} paying orgs; infra cost ${usd(rev.infraCostMtdUsd)} (MTD); est. margin ${usd(rev.marginUsd)}.`,
        data: rev,
      }
    }
    case "org_health": {
      const orgs = await listOrgRows()
      const target = await resolveOrg(String(args.org ?? ""), orgs)
      if (!target) {
        return { tool: name, summary: `No organisation matched "${String(args.org ?? "")}".`, data: null }
      }
      const period = await getOrgPeriod(target.orgId)
      return {
        tool: name,
        summary: `${target.name} (${target.plan}, ${target.status}): ${usd(target.mtdUsdCost)} MTD across ${compact(target.mtdAgentRuns)} runs, ${target.seats} seats, failure rate ${pct(target.failureRate)}.`,
        data: { org: target, period },
      }
    }
  }
}
