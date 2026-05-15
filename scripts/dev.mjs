#!/usr/bin/env node
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import net from "node:net"

/*
 * One-command local dev orchestrator.
 *
 *   pnpm dev
 *
 * 1. Boots the Firebase Emulator Suite (firestore, auth, storage, ui).
 * 2. Waits for the firestore emulator to start accepting connections.
 * 3. Runs the seed script (idempotent — safe to re-run on every boot).
 * 4. Starts `next dev`.
 *
 * All four streams interleave in a single terminal. Ctrl-C tears everything
 * down cleanly.
 *
 * Project-id resolution: `.firebaserc` is the single source of truth. Its
 * `default` is propagated to every subprocess via NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * — which Next prefers over `.env.local` because process.env wins. This avoids
 * the trap where the seed and Next read different per-project Firestore stores
 * inside the same emulator (any drift in .env.local would silently route reads
 * to an empty project).
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function resolveDevProjectId() {
  const rcPath = path.join(REPO_ROOT, ".firebaserc")
  try {
    const rc = JSON.parse(readFileSync(rcPath, "utf8"))
    const id = rc?.projects?.default
    if (!id || typeof id !== "string") {
      throw new Error(".firebaserc has no projects.default")
    }
    return id
  } catch (err) {
    throw new Error(
      `Could not read project id from .firebaserc: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
}

const procs = []
let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const p of procs) {
    if (p && !p.killed) {
      try {
        p.kill("SIGTERM")
      } catch {
        /* swallow */
      }
    }
  }
  setTimeout(() => process.exit(code), 250)
}
process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

function spawnLogged(name, cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  })
  procs.push(child)
  const prefix = `[${name}] `
  const writeLine = (chunk, stream) => {
    const text = chunk.toString()
    for (const line of text.split("\n")) {
      if (line) stream.write(prefix + line + "\n")
    }
  }
  child.stdout.on("data", (c) => writeLine(c, process.stdout))
  child.stderr.on("data", (c) => writeLine(c, process.stderr))
  child.on("exit", (code) => {
    process.stdout.write(`${prefix}exited (code=${code})\n`)
    if (!shuttingDown && code !== 0 && code !== null) shutdown(code)
  })
  return child
}

function waitForPort(host, port, timeoutMs = 60_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const sock = net.createConnection({ host, port })
      sock.once("connect", () => {
        sock.end()
        resolve()
      })
      sock.once("error", () => {
        sock.destroy()
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timeout waiting for ${host}:${port}`))
        } else {
          setTimeout(tryOnce, 500)
        }
      })
    }
    tryOnce()
  })
}

const PROJECT_ID = resolveDevProjectId()

const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  NEXT_PUBLIC_USE_EMULATORS: "1",
  // Force every subprocess (seed, next) to agree on the project id —
  // process.env wins over .env.local in Next, so any stale value there is
  // overridden cleanly.
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
}

async function main() {
  console.log(`→ starting Firebase emulators (project=${PROJECT_ID})`)
  spawnLogged("emulators", "firebase", [
    "emulators:start",
    "--only",
    "firestore,auth,storage",
    "--project",
    PROJECT_ID,
  ])

  try {
    await waitForPort("127.0.0.1", 8080)
  } catch (err) {
    console.error("Emulator did not start:", err.message)
    shutdown(1)
    return
  }
  console.log("→ emulator up; running seed")

  await new Promise((resolve, reject) => {
    const seed = spawnLogged("seed", "pnpm", ["tsx", "firestore/seeds/run.ts"], EMULATOR_ENV)
    seed.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`seed exited ${code}`)),
    )
  }).catch((err) => {
    console.error(err.message)
    shutdown(1)
  })

  console.log("→ starting next dev")
  spawnLogged("next", "pnpm", ["exec", "next", "dev"], EMULATOR_ENV)

  if (process.env.AGENTS_CRON === "1") {
    /* The agent-cron script needs Next to be up before it can POST to
     * /api/agents/cron/tick — wait for the listener before spawning. */
    try {
      await waitForPort("127.0.0.1", 3000, 90_000)
      console.log("→ starting agent cron (AGENTS_CRON=1)")
      spawnLogged("agents", "node", ["scripts/agent-cron.mjs"], EMULATOR_ENV)
    } catch (err) {
      console.error("[agents] could not start cron — next dev did not bind to :3000")
      console.error(err.message)
    }
  }
}

main().catch((err) => {
  console.error(err)
  shutdown(1)
})
