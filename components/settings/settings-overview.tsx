import Link from "next/link"
import {
  Briefcase,
  Palette,
  Tags,
  Megaphone,
  Bot,
  ChevronRight,
} from "lucide-react"

/*
 * Settings landing page — a map of every settings surface in one place,
 * so "Settings" lands somewhere that looks like settings rather than
 * redirecting straight into one sub-page.
 *
 * To add a future settings area: add a route under app/(app)/settings/,
 * a tab in components/shared/settings-nav.tsx, and one entry in SECTIONS
 * below. The three stay in sync by convention.
 */

type Section = {
  href: string
  title: string
  description: string
  icon: typeof Briefcase
  /** Set when the section lives outside the /settings tab shell. */
  external?: boolean
}

const SECTIONS: Section[] = [
  {
    href: "/settings/workspace",
    title: "Workspace",
    description:
      "Re-run the setup wizard, switch between workspaces, and manage workspace-level options.",
    icon: Briefcase,
  },
  {
    href: "/settings/brand",
    title: "Brand",
    description:
      "Teach the AI your brand voice, audience, channels, and posting cadence.",
    icon: Palette,
  },
  {
    href: "/settings/categories",
    title: "Categories",
    description:
      "Categories drive post colours, default types, and how the calendar groups work.",
    icon: Tags,
  },
  {
    href: "/settings/campaigns",
    title: "Campaigns",
    description: "Create, edit, and archive campaigns. Admin only.",
    icon: Megaphone,
  },
  {
    href: "/studio",
    title: "AI agents",
    description:
      "Agent providers, models, schedules, budgets, and model-update alerts live in Studio.",
    icon: Bot,
    external: true,
  },
]

export function SettingsOverview() {
  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Everything you can configure for this workspace, in one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-3 rounded-lg border border-border bg-canvas px-4 py-3.5 transition-colors hover:bg-secondary/50"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                  {s.title}
                  {s.external && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      · Studio
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {s.description}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
