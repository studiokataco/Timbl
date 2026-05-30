"use server"

import { addDays, format, subYears } from "date-fns"
import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import {
  orgCampaignsPath,
  orgPostsPath,
} from "@/lib/firebase/paths"

export type PalettePost = {
  id: string
  brief: string
  scheduledDate: string
  status: string
  categoryId?: string
}

export type PaletteCampaign = {
  id: string
  slug: string
  name: string
  status: string
}

export type PaletteData = {
  posts: PalettePost[]
  campaigns: PaletteCampaign[]
}

/*
 * Lightweight payload for the command palette. Trimmed to the fields the
 * palette needs to render and rank - no full post documents - so the round
 * trip is cheap. The palette caches the result for 60s on the client.
 */
export async function fetchPaletteData(): Promise<PaletteData> {
  const orgId = await getCurrentOrgId()
  const db = getDb()
  const today = new Date()
  const start = format(subYears(today, 1), "yyyy-MM-dd")
  const end = format(addDays(today, 365), "yyyy-MM-dd")

  const [postsSnap, campaignsSnap] = await Promise.all([
    db
      .collection(orgPostsPath(orgId))
      .where("scheduledDate", ">=", start)
      .where("scheduledDate", "<=", end)
      .select("brief", "scheduledDate", "status", "categoryId")
      .get(),
    db
      .collection(orgCampaignsPath(orgId))
      .select("slug", "name", "status")
      .get(),
  ])

  const posts: PalettePost[] = postsSnap.docs.map((d) => ({
    id: d.id,
    brief: (d.get("brief") as string | undefined) ?? "(untitled)",
    scheduledDate: d.get("scheduledDate") as string,
    status: d.get("status") as string,
    categoryId: d.get("categoryId") as string | undefined,
  }))
  const campaigns: PaletteCampaign[] = campaignsSnap.docs.map((d) => ({
    id: d.id,
    slug: (d.get("slug") as string | undefined) ?? d.id,
    name: d.get("name") as string,
    status: (d.get("status") as string | undefined) ?? "active",
  }))

  return { posts, campaigns }
}
