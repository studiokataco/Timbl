import { getClientAuth } from "@/lib/firebase/client"

export async function activateWorkspaceClient(opts: {
  organizationId?: string
  create?: boolean
  name?: string
}): Promise<{ next: string }> {
  const auth = getClientAuth()
  const user = auth.currentUser
  if (!user) throw new Error("Sign in first.")

  const activate = async (forceRefresh: boolean) => {
    const idToken = await user.getIdToken(forceRefresh)
    const res = await fetch("/auth/activate-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, ...opts }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      refresh?: boolean
      error?: string
    }
    if (!res.ok) throw new Error(data.error || "Could not open workspace")
    return data
  }

  const first = await activate(true)
  if (first.refresh) await activate(true)

  const mintSession = async (forceRefresh: boolean) => {
    const idToken = await user.getIdToken(forceRefresh)
    const res = await fetch("/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      next?: string
      error?: string
    }
    if (!res.ok) throw new Error(data.error || "Session failed")
    return data
  }

  const session = await mintSession(true)
  return { next: session.next ?? "/calendar" }
}
