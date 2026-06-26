"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { approveSignupRequest, denySignupRequest } from "@/lib/actions/platform/signups"
import type { SignupRequest } from "@/lib/platform/schema"

function formatRequestedAt(value: SignupRequest["requestedAt"]) {
  const t = Date.parse(String(value))
  if (Number.isNaN(t)) return "-"
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function SignupRequestsTable({
  requests,
  status,
}: {
  requests: SignupRequest[]
  status: "pending" | "approved" | "denied"
}) {
  const router = useRouter()
  const [pending, setPending] = useState<Set<string>>(new Set())

  async function handleApprove(id: string) {
    setPending((p) => new Set(p).add(id))
    const result = await approveSignupRequest({ id })
    setPending((p) => { const n = new Set(p); n.delete(id); return n })
    if (result.ok) {
      toast.success("Request approved - invite email sent.")
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to approve request.")
    }
  }

  async function handleDeny(id: string) {
    setPending((p) => new Set(p).add(id))
    const result = await denySignupRequest({ id })
    setPending((p) => { const n = new Set(p); n.delete(id); return n })
    if (result.ok) {
      toast.success("Request denied.")
      router.refresh()
    } else {
      toast.error(result.error ?? "Failed to deny request.")
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl bg-card py-16 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No {status} requests.
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {requests.map((req) => (
          <div key={req.id} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{req.name}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{req.email}</div>
                {req.company ? (
                  <div className="text-sm text-muted-foreground">{req.company}</div>
                ) : null}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatRequestedAt(req.requestedAt)}
              </div>
            </div>
            {req.useCase ? (
              <p className="mt-2 text-sm text-muted-foreground">{req.useCase}</p>
            ) : null}
            {status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending.has(req.id)}
                  onClick={() => void handleApprove(req.id)}
                  className="h-8 flex-1 gap-1 text-xs"
                >
                  <CheckCircle className="size-3.5 text-green-600" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending.has(req.id)}
                  onClick={() => void handleDeny(req.id)}
                  className="h-8 flex-1 gap-1 text-xs"
                >
                  <XCircle className="size-3.5 text-red-500" />
                  Deny
                </Button>
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                Decided by {req.decidedBy ?? "-"}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-foreground/10 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Company</th>
              <th className="px-3 py-3 font-medium">Use case</th>
              <th className="px-3 py-3 font-medium">Requested</th>
              {status === "pending" ? (
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              ) : (
                <th className="px-4 py-3 font-medium">Decided by</th>
              )}
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr
                key={req.id}
                className="border-b border-foreground/5 last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3 font-medium">{req.name}</td>
                <td className="px-3 py-3 text-muted-foreground">{req.email}</td>
                <td className="px-3 py-3 text-muted-foreground">{req.company ?? "-"}</td>
                <td className="max-w-[220px] truncate px-3 py-3 text-muted-foreground">
                  {req.useCase ?? "-"}
                </td>
                <td className="px-3 py-3 text-muted-foreground tabular-nums">
                  {formatRequestedAt(req.requestedAt)}
                </td>
                {status === "pending" ? (
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending.has(req.id)}
                        onClick={() => void handleApprove(req.id)}
                        className="h-7 gap-1 text-xs"
                      >
                        <CheckCircle className="size-3.5 text-green-600" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending.has(req.id)}
                        onClick={() => void handleDeny(req.id)}
                        className="h-7 gap-1 text-xs"
                      >
                        <XCircle className="size-3.5 text-red-500" />
                        Deny
                      </Button>
                    </div>
                  </td>
                ) : (
                  <td className="px-4 py-3 text-muted-foreground">
                    {req.decidedBy ?? "-"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
