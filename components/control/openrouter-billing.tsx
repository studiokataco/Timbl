"use client"

import { useState, useTransition } from "react"
import { Loader2, RefreshCw, Wallet } from "lucide-react"
import { toast } from "sonner"

import { StatCard } from "@/components/control/widgets"
import { usd } from "@/lib/platform/format"
import { Button } from "@/components/ui/button"
import {
  reconcileRunCosts,
  type ReconcileResult,
} from "@/lib/actions/platform/openrouter-billing"
import type { OpenRouterAccount } from "@/lib/platform/openrouter"

/*
 * OpenRouter account + reconciliation panel. The account snapshot is fetched
 * server-side and passed in; the reconcile button backfills exact per-run
 * cost from generation ids (authoritative spend) on demand.
 */
export function OpenRouterBilling({
  account,
}: {
  account: OpenRouterAccount | null
}) {
  const [pending, startTransition] = useTransition()
  const [last, setLast] = useState<ReconcileResult | null>(null)

  const reconcile = () => {
    startTransition(async () => {
      const res = await reconcileRunCosts()
      setLast(res)
      if (res.ok) {
        toast.success(
          `Reconciled ${res.reconciled} of ${res.scanned} pending run${res.scanned === 1 ? "" : "s"}`,
        )
      } else {
        toast.error("Reconcile failed", { description: res.error })
      }
    })
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight">
          <Wallet className="size-4" aria-hidden /> OpenRouter account
        </h2>
        <Button size="sm" variant="outline" onClick={reconcile} disabled={pending}>
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden />
          )}
          Reconcile run costs
        </Button>
      </div>

      {account ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Wallet}
            label="Credits remaining"
            value={usd(account.remaining)}
            sub={account.isFreeTier ? "free tier" : `${usd(account.totalCredits)} purchased`}
          />
          <StatCard
            label="Lifetime usage"
            value={usd(account.totalUsage)}
            sub="account to date"
          />
          <StatCard
            label="Key spend"
            value={usd(account.usage)}
            sub={account.limit != null ? `of ${usd(account.limit)} limit` : "no limit"}
          />
          <StatCard
            label="Key headroom"
            value={
              account.limitRemaining != null
                ? usd(account.limitRemaining)
                : "unlimited"
            }
            sub="before key cap"
          />
        </div>
      ) : (
        <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          OpenRouter is not configured (no OPENROUTER_API_KEY). Live credit and
          spend figures appear here once the key is set.
        </p>
      )}

      {last?.ok && last.reconciled === 0 && last.scanned > 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {last.scanned} run{last.scanned === 1 ? "" : "s"} still settling at
          OpenRouter - costs resolve shortly after a run ends. Try again in a
          moment.
        </p>
      ) : null}
    </section>
  )
}
