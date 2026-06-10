import type { User } from "firebase/auth"

import type { AuthIntent } from "@/lib/auth/intent"
import { getClientAuth } from "@/lib/firebase/client"

export function defaultNext(intent: AuthIntent) {
  return intent === "signup" ? "/workspaces?new=1" : "/calendar"
}

type CallbackResult = {
  refresh?: boolean
  accessPending?: boolean
  next?: string
  error?: string
}

async function postCallback(idToken: string, intent: AuthIntent) {
  const res = await fetch("/auth/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, intent }),
  })
  const data = (await res.json().catch(() => ({}))) as CallbackResult
  return { res, data }
}

export async function completeAuthCallback(opts: {
  user: User
  intent: AuthIntent
  nextParam?: string | null
}): Promise<{ next: string } | { accessPending: true }> {
  const auth = getClientAuth()

  const run = async (forceRefresh: boolean) => {
    const idToken = await opts.user.getIdToken(forceRefresh)
    const { res, data } = await postCallback(idToken, opts.intent)
    if (data.accessPending) {
      await auth.signOut()
      return { done: true as const, accessPending: true as const }
    }
    if (!res.ok) {
      await auth.signOut()
      throw new Error(data.error || "Session creation failed")
    }
    return {
      done: false as const,
      refresh: data.refresh,
      next: data.next,
    }
  }

  const first = await run(true)
  if (first.done) return { accessPending: true }

  if (first.refresh) {
    const second = await run(true)
    if (second.done) return { accessPending: true }
    if (second.refresh) throw new Error("Session not minted after claim refresh")
    const next = second.next ?? opts.nextParam ?? defaultNext(opts.intent)
    return { next }
  }

  const next = first.next ?? opts.nextParam ?? defaultNext(opts.intent)
  return { next }
}
