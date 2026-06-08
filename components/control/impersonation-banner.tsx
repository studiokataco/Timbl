"use client"

import { useTransition } from "react"
import { Eye } from "lucide-react"

import { endImpersonation } from "@/lib/actions/platform/impersonation"

/*
 * Persistent banner shown in the tenant app while a platform admin is
 * impersonating an org. Read-only impersonation, time-boxed - this is the
 * always-visible reminder + exit. On exit we bounce back to the control
 * centre on the admin host.
 */
export function ImpersonationBanner({ orgName }: { orgName: string }) {
  const [pending, start] = useTransition()

  const exit = () =>
    start(async () => {
      await endImpersonation()
      const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST
      if (adminHost) {
        window.location.href = `${window.location.protocol}//${adminHost}/tenants`
      } else {
        window.location.reload()
      }
    })

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-sm font-medium text-black">
      <Eye className="size-4" />
      <span>
        Impersonating <strong>{orgName}</strong> - expires in 30 min
      </span>
      <button
        onClick={exit}
        disabled={pending}
        className="rounded bg-black/15 px-2 py-0.5 text-xs font-semibold hover:bg-black/25 disabled:opacity-50"
      >
        {pending ? "Exiting..." : "Exit"}
      </button>
    </div>
  )
}
