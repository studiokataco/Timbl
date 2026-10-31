"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { listOrgRows } from "@/lib/platform/queries"
import { tenantFinancials } from "@/lib/platform/revenue"
import { platformBillingDocPath } from "@/lib/platform/schema"
import { billingProfileSchema } from "@/lib/schemas/billing"

/* Company financials report - one CSV row per tenant. Combines the rollup
 * snapshot, derived plan financials, and the manual billing profile. Used by
 * the Revenue tab's export button. */

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function tenantsReportCsv(): Promise<{ ok: boolean; csv?: string; error?: string }> {
  await requirePlatformAdmin()
  try {
    const rows = await listOrgRows()
    const header = [
      "org_id", "name", "tier", "plan", "status", "seats",
      "mrr_inr", "arr_inr", "infra_mtd_inr", "margin_inr",
      "failure_rate", "last_run_at", "billing_status", "billing_email", "company",
    ]
    const lines = [header.join(",")]

    for (const row of rows) {
      const fin = tenantFinancials(row.plan, row.mtdUsdCost, row.billingStatus)
      const billSnap = await getAdminDb().doc(platformBillingDocPath(row.orgId)).get()
      const bill = billSnap.exists
        ? billingProfileSchema.safeParse(billSnap.data())
        : null
      const b = bill?.success ? bill.data : null
      lines.push(
        [
          row.orgId, row.name, fin.tier, row.plan, row.status, row.seats,
          fin.mrrInr ?? "", fin.arrInr ?? "", fin.infraMtdInr.toFixed(2),
          fin.marginInr ?? "", row.failureRate.toFixed(3), row.lastRunAt ?? "",
          b?.status ?? "", b?.billingEmail ?? "", b?.companyName ?? "",
        ]
          .map(csvCell)
          .join(","),
      )
    }
    return { ok: true, csv: lines.join("\n") }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "report_failed" }
  }
}
