"use client"

import { useQuery } from "@tanstack/react-query"

import { CHANNEL_LABELS } from "@/lib/labels/enums"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchBrandConfig } from "@/lib/actions/brand-config"
import type { BrandConfig } from "@/lib/schemas/brandConfig"

/*
 * Live preview of the brandConfig doc. Wired to TanStack Query under the
 * key ['brand-config'] so any tool - or the wizard's own writeBrandConfig
 * tool - can invalidate it through queryClient.invalidateQueries.
 */


export function BrandPreviewPanel({ brandId }: { brandId?: string }) {
  const { data, isLoading } = useQuery<BrandConfig | null>({
    queryKey: ["brand-config", brandId ?? "default"],
    queryFn: () => fetchBrandConfig(brandId),
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
    <dl className="space-y-3">
      <Field label="Voice">{data.voice || "Not set yet"}</Field>
      <Field label="Audience">{data.audience || "Not set yet"}</Field>
      <Field label="Channels">
        {data.channels.length ? data.channels.map((c) => CHANNEL_LABELS[c]).join(", ") : "None yet"}
      </Field>
      <Field label="Cadence">
        {data.targetCadence.perWeek === 1 ? "1 post a week" : `${data.targetCadence.perWeek} posts a week`}
        {data.targetCadence.preferredDays.length
          ? ` · ${data.targetCadence.preferredDays.map((d) => d[0].toUpperCase() + d.slice(1)).join(", ")}`
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
      <dt className="text-[12px] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[13px] text-foreground leading-snug line-clamp-4">
        {children}
      </dd>
    </div>
  )
}
