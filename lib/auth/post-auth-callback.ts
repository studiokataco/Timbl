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

const RETRY_DELAYS_MS = [500, 1000, 2000]

function isTransientStatus(status: number) {
  return status >= 500 || status === 408 || status === 429
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
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

async function postCallbackWithRetry(
  idToken: string,
  intent: AuthIntent,
  onRetry?: (attempt: number) => void,
) {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) onRetry?.(attempt)
    try {
      const { res, data } = await postCallback(idToken, intent)
      if (data.accessPending || res.ok || !isTransientStatus(res.status)) {
        return { res, data }
      }
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]!)
    }
  }
  throw new Error("Session creation failed")
}

export async function completeAuthCallback(opts: {
  user: User
  intent: AuthIntent
  nextParam?: string | null
  onRetry?: (attempt: number) => void
}): Promise<{ next: string } | { accessPending: true }> {
  const auth = getClientAuth()

  const run = async (forceRefresh: boolean) => {
    const idToken = await opts.user.getIdToken(forceRefresh)
    const { res, data } = await postCallbackWithRetry(
      idToken,
      opts.intent,
      opts.onRetry,
    )
    if (data.accessPending) {
      await auth.signOut()
      return { done: true as const, accessPending: true as const }
    }
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        await auth.signOut()
      }
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
