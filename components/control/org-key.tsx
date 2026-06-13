"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"

export function OrgKey({ orgId, className }: { orgId: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(orgId)
      setCopied(true)
      toast.success("Workspace ID copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy")
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${orgId}`}
      className={cn(
        "group/key inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <span className="truncate">{orgId}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-40 transition-opacity group-hover/key:opacity-70" />
      )}
    </button>
  )
}
