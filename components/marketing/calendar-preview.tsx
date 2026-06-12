import { Sparkles } from "lucide-react"

import { GENERIC_DEFAULTS } from "@/lib/onboarding/industry-defaults"

const CATEGORY_COLORS = Object.fromEntries(
  GENERIC_DEFAULTS.categories.map((c) => [c.slug, c.color])
)

const WEEK: Array<{
  day: string
  posts: Array<{ slug: string; label: string; title: string }>
}> = [
  {
    day: "Mon",
    posts: [{ slug: "announcements", label: "Announcements", title: "Launch teaser" }],
  },
  {
    day: "Tue",
    posts: [{ slug: "tips-howto", label: "Tips & how-to", title: "3 hooks that work" }],
  },
  {
    day: "Wed",
    posts: [
      { slug: "behind-the-scenes", label: "Behind the scenes", title: "Studio tour reel" },
      { slug: "tips-howto", label: "Tips & how-to", title: "FAQ carousel" },
    ],
  },
  { day: "Thu", posts: [] },
  {
    day: "Fri",
    posts: [{ slug: "events", label: "Events", title: "Live Q&A" }],
  },
  {
    day: "Sat",
    posts: [{ slug: "behind-the-scenes", label: "Behind the scenes", title: "Team photo dump" }],
  },
  {
    day: "Sun",
    posts: [{ slug: "announcements", label: "Announcements", title: "Week recap" }],
  },
]

export function CalendarPreview() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      <div className="min-w-[680px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="text-sm font-semibold">This week</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" />
            Drafter agent: 2 drafts ready for review
          </span>
        </div>
        <div className="grid grid-cols-7 divide-x divide-border">
          {WEEK.map(({ day, posts }) => (
            <div key={day} className="min-h-36 p-2">
              <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">{day}</p>
              <div className="space-y-1.5">
                {posts.map((post) => {
                  const color = CATEGORY_COLORS[post.slug]
                  return (
                    <div
                      key={post.title}
                      className="rounded-md px-2 py-1.5"
                      style={{ backgroundColor: `${color}24` }}
                    >
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {post.label}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium">{post.title}</p>
                    </div>
                  )
                })}
                {day === "Thu" && (
                  <div className="rounded-md border border-dashed border-border px-2 py-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <Sparkles className="size-3" />
                      Agent drafting...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
