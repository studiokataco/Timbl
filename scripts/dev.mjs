#!/usr/bin/env node
import { spawn } from "node:child_process"
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
 */

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

const EMULATOR_ENV = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  NEXT_PUBLIC_USE_EMULATORS: "1",
}

async function main() {
  console.log("→ starting Firebase emulators")
  spawnLogged(
    "emulators",
    "firebase",
    [
      "emulators:start",
      "--only",
      "firestore,auth,storage",
      "--project",
      "becksup-planner-dev",
    ],
  )

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
}

main().catch((err) => {
  console.error(err)
  shutdown(1)
})
