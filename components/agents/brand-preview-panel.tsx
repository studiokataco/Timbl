"use client"

import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@/components/ui/skeleton"
import { fetchBrandConfig } from "@/lib/actions/brand-config"
import type { BrandConfig } from "@/lib/schemas/brandConfig"

/*
 * Live preview of the brandConfig doc. Wired to TanStack Query under the
 * key ['brand-config'] so any tool - or the wizard's own writeBrandConfig
 * tool - can invalidate it through queryClient.invalidateQueries.
 */

const QUERY_KEY = ["brand-config"] as const

export function BrandPreviewPanel() {
  const { data, isLoading } = useQuery<BrandConfig | null>({
    queryKey: QUERY_KEY,
    queryFn: () => fetchBrandConfig(),
    refetchInterval: 4_000, // poll while the wizard is editing
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-md border border-dashed border-border bg-secondary/20 p-3 text-xs text-muted-foreground leading-snug">
        Nothing saved yet. Fields appear here as the wizard captures them.
      </div>
    )
  }

  return (
    <dl className="space-y-2.5">
      <Field label="Voice">{data.voice}</Field>
      <Field label="Audience">{data.audience}</Field>
      <Field label="Channels">
        {data.channels.length ? data.channels.join(", ") : "-"}
      </Field>
      <Field label="Cadence">
        {data.targetCadence.perWeek}× / week
        {data.targetCadence.preferredDays.length
          ? ` · ${data.targetCadence.preferredDays.join(", ")}`
          : ""}
        {data.targetCadence.preferredTimes.length
          ? ` · ${data.targetCadence.preferredTimes.join(", ")}`
          : ""}
      </Field>
      {data.forbiddenTopics.length > 0 && (
        <Field label="Forbidden topics">
          {data.forbiddenTopics.join(" · ")}
        </Field>
      )}
      {data.samplePosts.length > 0 && (
        <Field label="Sample posts">
          <ul className="space-y-1 max-h-32 overflow-y-auto">
            {data.samplePosts.slice(0, 4).map((p, i) => (
              <li
                key={i}
                className="border border-border/60 rounded-md px-2 py-1 text-xs leading-snug"
              >
                {p.text}
                {p.tag && (
                  <span className="ml-2 text-muted-foreground">· {p.tag}</span>
                )}
              </li>
            ))}
          </ul>
        </Field>
      )}
      {data.notes && <Field label="Notes">{data.notes}</Field>}
    </dl>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-xs text-foreground leading-snug line-clamp-4">
        {children}
      </dd>
    </div>
  )
}
