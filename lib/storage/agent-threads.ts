/*
 * Tiny IndexedDB wrapper for persistent agent conversation threads.
 *
 * We don't pull in `idb` / `idb-keyval` - the surface here is small
 * enough that a hand-rolled wrapper is cheaper than a new dep.
 * Single DB `safe-agent-threads`, single object store `threads`,
 * keyed by `id`. All functions are SSR-safe (no-op on the server)
 * and swallow errors so a flaky IDB never crashes the drawer.
 */

const DB_NAME = "safe-agent-threads"
const STORE = "threads"
const DB_VERSION = 1

export type ThreadMessage = {
  id: string
  role: "user" | "assistant" | "system"
  text?: string
  toolCalls?: {
    id: string
    name: string
    args: unknown
    result?: unknown
    error?: string
  }[]
  createdAt: number
}

export type Thread = {
  id: string
  agentName: string
  title?: string
  createdAt: number
  lastMessageAt: number
  transcript: ThreadMessage[]
}

let dbPromise: Promise<IDBDatabase> | null = null

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined"
}

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser()) return Promise.reject(new Error("not-browser"))
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("idb open failed"))
  })
  return dbPromise
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        const result = run(store)
        if (result instanceof IDBRequest) {
          result.onsuccess = () => resolve(result.result as T)
          result.onerror = () =>
            reject(result.error ?? new Error("idb request failed"))
        } else {
          // promise path
          result.then(resolve, reject)
        }
      }),
  )
}

export async function listThreads(): Promise<Thread[]> {
  if (!isBrowser()) return []
  try {
    const all = await tx<Thread[]>("readonly", (store) => store.getAll() as IDBRequest<Thread[]>)
    return (all ?? [])
      .slice()
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  } catch (err) {
    console.warn("[agent-threads] listThreads failed", err)
    return []
  }
}

export async function getThread(id: string): Promise<Thread | null> {
  if (!isBrowser()) return null
  try {
    const got = await tx<Thread | undefined>("readonly", (store) =>
      store.get(id) as IDBRequest<Thread | undefined>,
    )
    return got ?? null
  } catch (err) {
    console.warn("[agent-threads] getThread failed", err)
    return null
  }
}

export async function createThread(agentName: string): Promise<Thread> {
  const now = Date.now()
  const thread: Thread = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t_${now}_${Math.random().toString(36).slice(2, 8)}`,
    agentName,
    createdAt: now,
    lastMessageAt: now,
    transcript: [],
  }
  if (!isBrowser()) return thread
  try {
    await tx<IDBValidKey>("readwrite", (store) =>
      store.put(thread) as IDBRequest<IDBValidKey>,
    )
  } catch (err) {
    console.warn("[agent-threads] createThread failed", err)
  }
  return thread
}

function deriveTitle(transcript: ThreadMessage[]): string | undefined {
  const firstUser = transcript.find((m) => m.role === "user" && m.text)
  if (!firstUser?.text) return undefined
  const cleaned = firstUser.text.trim().replace(/\s+/g, " ")
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}…` : cleaned
}

export async function appendMessage(
  threadId: string,
  msg: ThreadMessage,
): Promise<void> {
  if (!isBrowser()) return
  try {
    const existing = await getThread(threadId)
    if (!existing) return
    const transcript = upsertMessage(existing.transcript, msg)
    const next: Thread = {
      ...existing,
      transcript,
      lastMessageAt: Date.now(),
      title: existing.title ?? deriveTitle(transcript),
    }
    await tx<IDBValidKey>("readwrite", (store) =>
      store.put(next) as IDBRequest<IDBValidKey>,
    )
  } catch (err) {
    console.warn("[agent-threads] appendMessage failed", err)
  }
}

function upsertMessage(
  transcript: ThreadMessage[],
  msg: ThreadMessage,
): ThreadMessage[] {
  const idx = transcript.findIndex((m) => m.id === msg.id)
  if (idx === -1) return [...transcript, msg]
  const next = transcript.slice()
  next[idx] = msg
  return next
}

export async function renameThread(id: string, title: string): Promise<void> {
  if (!isBrowser()) return
  try {
    const existing = await getThread(id)
    if (!existing) return
    const next: Thread = { ...existing, title }
    await tx<IDBValidKey>("readwrite", (store) =>
      store.put(next) as IDBRequest<IDBValidKey>,
    )
  } catch (err) {
    console.warn("[agent-threads] renameThread failed", err)
  }
}

export async function importThread(
  agentName: string,
  transcript: ThreadMessage[],
): Promise<Thread> {
  const now = Date.now()
  const filtered = transcript.filter((m) => {
    if (m.role === "system" && !m.text && (!m.toolCalls || m.toolCalls.length === 0)) {
      return false
    }
    return Boolean(m.text || (m.toolCalls && m.toolCalls.length > 0))
  })
  const lastAt = filtered.length
    ? filtered.reduce((acc, m) => (m.createdAt > acc ? m.createdAt : acc), 0)
    : now
  const thread: Thread = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `t_${now}_${Math.random().toString(36).slice(2, 8)}`,
    agentName,
    title: deriveTitle(filtered),
    createdAt: now,
    lastMessageAt: lastAt || now,
    transcript: filtered,
  }
  if (!isBrowser()) return thread
  try {
    await tx<IDBValidKey>("readwrite", (store) =>
      store.put(thread) as IDBRequest<IDBValidKey>,
    )
  } catch (err) {
    console.warn("[agent-threads] importThread failed", err)
  }
  return thread
}

export async function updateThreadAgent(
  id: string,
  agentName: string,
): Promise<void> {
  if (!isBrowser()) return
  try {
    const existing = await getThread(id)
    if (!existing) return
    const next: Thread = {
      ...existing,
      agentName,
      lastMessageAt: Date.now(),
    }
    await tx<IDBValidKey>("readwrite", (store) =>
      store.put(next) as IDBRequest<IDBValidKey>,
    )
  } catch (err) {
    console.warn("[agent-threads] updateThreadAgent failed", err)
  }
}

export async function deleteThread(id: string): Promise<void> {
  if (!isBrowser()) return
  try {
    await tx<undefined>("readwrite", (store) =>
      store.delete(id) as IDBRequest<undefined>,
    )
  } catch (err) {
    console.warn("[agent-threads] deleteThread failed", err)
  }
}
