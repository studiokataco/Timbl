#!/usr/bin/env node
import { execSync } from "node:child_process"

const PORTS = [3000, 3001, 4000, 4400, 4500, 8080, 9099, 9199, 9150]

const pids = new Set()
for (const port of PORTS) {
  try {
    const out = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim()
    for (const pid of out.split("\n").filter(Boolean)) pids.add(pid)
  } catch {
    /* port free */
  }
}

if (pids.size === 0) {
  console.log("No dev/emulator processes found on known ports.")
  process.exit(0)
}

console.log(`Stopping PIDs: ${[...pids].join(", ")}`)
for (const pid of pids) {
  try {
    process.kill(Number(pid), "SIGTERM")
  } catch {
    /* already gone */
  }
}

process.exit(0)
