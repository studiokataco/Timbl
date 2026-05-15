"use client"

import { useQuery } from "@tanstack/react-query"

import { Skeleton } from "@/components/ui/skeleton"
import { fetchBrandConfig } from "@/lib/actions/brand-config"
import type { BrandConfig } from "@/lib/schemas/brandConfig"

/*
 * Live preview of the brandConfig doc. Wired to TanStack Query under the
 * key ['brand-config'] so any tool — or the wizard's own writeBrandConfig
 * tool — can invalidate it through queryClient.invalidateQueries.
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
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground">
        Nothing saved yet. Chat with the wizard on the left — fields will
        appear here as they&apos;re captured.
      </div>
    )
  }

  return (
    <dl className="space-y-3 text-xs">
      <Field label="Voice">{data.voice}</Field>
      <Field label="Audience">{data.audience}</Field>
      <Field label="Channels">
        {data.channels.length ? data.channels.join(", ") : "—"}
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
          <ul className="space-y-1.5">
            {data.samplePosts.slice(0, 4).map((p, i) => (
              <li
                key={i}
                className="border border-border/60 rounded-md px-2 py-1.5 leading-relaxed"
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
    <div className="space-y-1">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground leading-relaxed">{children}</dd>
    </div>
  )
}
