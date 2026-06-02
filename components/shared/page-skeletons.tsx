import { Skeleton } from "@/components/ui/skeleton"

/*
 * Page-level skeleton loaders. Used as Next.js loading.tsx fallbacks while
 * server components fetch from Firestore. Shapes match the post-load layout
 * so the page doesn't reflow when the real content lands.
 */

export function CalendarSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-secondary/40 px-3 py-2 flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="grid grid-cols-7 border-t border-border">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square border-r border-b border-border p-1.5 last:border-r-0"
            >
              <Skeleton className="h-3 w-5 mb-1.5" />
              {i % 4 === 0 && <Skeleton className="h-4 w-full mb-1" />}
              {i % 5 === 0 && <Skeleton className="h-4 w-3/4" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ListSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-3">
        <Skeleton className="h-5 w-24 mb-1" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="bg-secondary/40 h-9 border-b border-border" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b last:border-b-0 border-border flex items-center gap-3 px-3"
          >
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function KanbanSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 flex-1 flex flex-col min-h-0">
      <div className="mb-3">
        <Skeleton className="h-5 w-20 mb-1" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="flex flex-col w-[220px] shrink-0">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-4" />
            </div>
            <div className="bg-secondary/40 rounded-lg p-2 flex flex-col gap-2 min-h-[200px]">
              {Array.from({ length: (col % 3) + 2 }).map((_, c) => (
                <Skeleton key={c} className="h-20 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TemplatesSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <Skeleton className="h-5 w-24 mb-1" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border overflow-hidden flex flex-col"
          >
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-3 flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-8 w-full mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AwarenessSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <Skeleton className="h-5 w-32 mb-1" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="rounded-md border border-border overflow-hidden">
        <div className="bg-secondary/40 h-9 border-b border-border" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 border-b last:border-b-0 border-border flex items-center gap-3 px-3"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-32 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CampaignsSkeleton() {
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Skeleton className="h-5 w-28 mb-1" />
          <Skeleton className="h-3 w-72" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start gap-2 mb-3">
              <Skeleton className="size-3 rounded-full mt-0.5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-4/5 mb-3" />
            <Skeleton className="h-3 w-32 mb-3" />
            <Skeleton className="h-1.5 w-full mb-3" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
