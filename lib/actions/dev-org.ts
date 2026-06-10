"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import {
  DEV_ORG_COOKIE,
  IS_DEV_SHIM,
  normalizeDevOrgMode,
  type DevOrgMode,
} from "@/lib/auth/dev-session"
import type { ServerActionResult } from "@/lib/schemas"

/*
 * Dev-only org switch. The Settings → Workspace demo-workspace toggle
 * calls `setDevOrg`; `server-helpers` reads the same cookie on every
 * request to decide which dev session the emulator shim returns -
 * Timbl demo org or your wizard-built tenant.
 *
 * No-ops outside emulator mode: production identity comes from the
 * verified Firebase session cookie, never from this switch.
 */

const setInput = z.object({ mode: z.enum(["demo", "tenant"]) })

export async function getDevOrgMode(): Promise<DevOrgMode> {
  const store = await cookies()
  return normalizeDevOrgMode(store.get(DEV_ORG_COOKIE)?.value)
}

export async function setDevOrg(input: unknown): Promise<ServerActionResult> {
  if (!IS_DEV_SHIM) {
    return {
      ok: false,
      error: "Org switching is only available in emulator dev mode.",
    }
  }
  const parsed = setInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid mode" }
  }
  const store = await cookies()
  store.set(DEV_ORG_COOKIE, parsed.data.mode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
  /* The active org just changed for the whole app - revalidate the root
   * layout so every cached segment re-resolves against the new tenant. */
  revalidatePath("/", "layout")
  return { ok: true, id: parsed.data.mode }
}
