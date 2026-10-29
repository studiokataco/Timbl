"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  ChevronRight,
  Gauge,
  Layers,
  Plug,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react"

import { IdentityAvatar } from "@/components/shared/identity-avatar"
import { cn } from "@/lib/utils"

export type SettingsNavData = {
  user: { name: string; email: string; avatarUrl?: string }
  workspace: { name: string; logoUrl?: string; color?: string; planLabel: string }
  brandCount: number
}

type Item = { href: string; label: string; short: string; icon: LucideIcon; count?: number }

const PROFILE_HREF = "/settings/profile"
const WORKSPACE_HREF = "/settings/workspace"

function workspaceItems(brandCount: number): Item[] {
  return [
    { href: "/settings/brands", label: "Brands", short: "Brands", icon: Layers, count: brandCount },
    { href: "/settings/team", label: "Members", short: "Members", icon: Users },
    { href: "/settings/categories", label: "Categories", short: "Categories", icon: Tags },
    { href: "/settings/notifications", label: "Reminders", short: "Reminders", icon: Bell },
    { href: "/settings/integrations", label: "Integrations & API", short: "Integrations", icon: Plug },
    { href: "/settings/billing", label: "Plan & billing", short: "Plan", icon: Gauge },
  ]
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function EntityLink({
  href,
  active,
  avatar,
  title,
  subtitle,
}: {
  href: string
  active: boolean
  avatar: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-secondary" : "hover:bg-secondary/60",
      )}
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium leading-tight text-foreground">{title}</span>
        <span className="block truncate text-[12px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight
        aria-hidden
        className={cn(
          "size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5",
          active && "text-foreground",
        )}
      />
    </Link>
  )
}

export function SettingsRail({ data }: { data: SettingsNavData }) {
  const pathname = usePathname()
  const items = workspaceItems(data.brandCount)

  return (
    <nav aria-label="Settings" className="flex flex-col px-3 py-6">
      <EntityLink
        href={PROFILE_HREF}
        active={isActive(pathname, PROFILE_HREF)}
        avatar={
          <IdentityAvatar
            name={data.user.name}
            src={data.user.avatarUrl}
            shape="circle"
            initials={2}
            className="size-9 text-xs"
          />
        }
        title={data.user.name}
        subtitle={data.user.email}
      />

      <div aria-hidden className="mx-2.5 my-4 h-px bg-border" />

      <EntityLink
        href={WORKSPACE_HREF}
        active={isActive(pathname, WORKSPACE_HREF)}
        avatar={
          <IdentityAvatar
            name={data.workspace.name}
            src={data.workspace.logoUrl}
            color={data.workspace.color}
            className="size-9"
          />
        }
        title={data.workspace.name}
        subtitle={data.workspace.planLabel}
      />

      <ul className="relative ml-[29px] mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[9px] top-1/2 h-4 w-px -translate-y-1/2 rounded-full transition-colors duration-150",
                  active ? "bg-foreground" : "bg-transparent",
                )}
              />
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.count ? (
                  <span className="text-[12px] tabular-nums text-muted-foreground">{item.count}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function SettingsTabs({ data }: { data: SettingsNavData }) {
  const pathname = usePathname()
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const current = listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [pathname])

  const tabs = [
    { href: PROFILE_HREF, short: "Profile" },
    { href: WORKSPACE_HREF, short: "Workspace" },
    ...workspaceItems(data.brandCount),
  ]
  return (
    <nav aria-label="Settings" className="border-b border-border">
      <ul ref={listRef} className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href)
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-lg px-3 text-[13px] transition-colors",
                  active
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.short}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
