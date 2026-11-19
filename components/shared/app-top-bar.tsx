"use client"

import { usePathname } from "next/navigation"
import { TopBar } from "@/components/shared/top-bar"
import { DEFAULT_APP_ROUTE } from "@/lib/constants/timbl"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import type { BrandSwitcherData } from "@/lib/queries/brands.server"

export function AppTopBar(props: {
  user: { name: string; email: string; avatarUrl?: string }
  workspaceName: string
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
}) {
  const pathname = usePathname()
  if (pathname === "/calendar" || pathname === DEFAULT_APP_ROUTE || pathname.startsWith(`${DEFAULT_APP_ROUTE}/`)) return null
  return <TopBar {...props} />
}
