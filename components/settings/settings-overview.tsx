import Link from "next/link"
import {
  Bell,
  Briefcase,
  Gauge,
  Palette,
  Tags,
  Megaphone,
  Bot,
  Share2,
  Users,
  ChevronRight,
} from "lucide-react"

/*
 * Settings landing page - a map of every settings surface in one place,
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
  /** Short tag shown next to the title when the section lives outside the
   *  /settings tab shell (e.g. its own top-level page). */
  badge?: string
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
    href: "/settings/billing",
    title: "Plan & usage",
    description:
      "Consumption this month against your plan limits, and the plan this workspace runs on.",
    icon: Gauge,
  },
  {
    href: "/settings/categories",
    title: "Categories",
    description:
      "Calendar colors and filters shared across every campaign in this workspace.",
    icon: Tags,
  },
  {
    href: "/settings/channels",
    title: "Integrations & API",
    description:
      "Connect social accounts for publishing, and create API keys for external apps and agents.",
    icon: Share2,
  },
  {
    href: "/settings/notifications",
    title: "Notifications",
    description:
      "Choose which workspace reminders appear as toasts when you open the app.",
    icon: Bell,
  },
  {
    href: "/settings/team",
    title: "Team",
    description:
      "Invite teammates, approve access requests, and manage roles.",
    icon: Users,
  },
  {
    href: "/campaigns",
    title: "Campaigns",
    description:
      "Browse, create, edit, and archive campaigns - content series with a shared timeline.",
    icon: Megaphone,
  },
  {
    href: "/studio",
    title: "AI agents",
    description:
      "Agent providers, models, schedules, and budgets live in Studio.",
    icon: Bot,
    badge: "Studio",
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
                  {s.badge && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      · {s.badge}
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
