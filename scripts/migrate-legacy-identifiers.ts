#!/usr/bin/env tsx
/*
 * One-shot Firestore migration: SAFE-era identifiers -> Timbl.
 *
 * Run against the legacy GCP project before cutover to timbl-prod:
 *   GCP_PROJECT=sm-dashboard-e7641 pnpm migrate:legacy-identifiers --dry-run
 *   GCP_PROJECT=sm-dashboard-e7641 pnpm migrate:legacy-identifiers --commit
 *
 * What it does:
 *   1. Copies /organizations/safe-foundation -> /organizations/timbl-demo
 *   2. Rewrites organizationId on nested docs
 *   3. Renames agentSessions appName safe-social-planner -> timbl-social-planner
 *   4. Updates @safefoundation.dev emails -> @timbl.dev in demo org users
 *   5. Rewrites Firebase Auth custom claims organizationId for affected users
 *
 * With --delete-legacy, removes the old org tree after a successful copy.
 */

import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import type { DocumentReference, Firestore } from "firebase-admin/firestore"
import { getFirestore } from "firebase-admin/firestore"
import { getAuth } from "firebase-admin/auth"

import { getAdminApp } from "../lib/firebase/admin"
import {
  LEGACY_AGENT_APP_NAME,
  LEGACY_DEMO_ORG_ID,
  TIMBL_AGENT_APP_NAME,
  TIMBL_DEMO_ORG_ID,
  TIMBL_DEV_EMAIL_DOMAIN,
} from "../lib/constants/timbl"

const LEGACY_EMAIL_DOMAIN = "safefoundation.dev"

type Args = { dryRun: boolean; commit: boolean; deleteLegacy: boolean }

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const commit = argv.includes("--commit")
  const deleteLegacy = argv.includes("--delete-legacy")
  return { dryRun: !commit, commit, deleteLegacy }
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(`${message} Type 'yes' to continue: `)
  rl.close()
  return answer.trim().toLowerCase() === "yes"
}

function patchDoc(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data }
  if (out.id === LEGACY_DEMO_ORG_ID) out.id = TIMBL_DEMO_ORG_ID
  if (out.slug === LEGACY_DEMO_ORG_ID) out.slug = TIMBL_DEMO_ORG_ID
  if (out.organizationId === LEGACY_DEMO_ORG_ID) {
    out.organizationId = TIMBL_DEMO_ORG_ID
  }
  if (typeof out.email === "string" && out.email.endsWith(`@${LEGACY_EMAIL_DOMAIN}`)) {
    out.email = out.email.replace(
      `@${LEGACY_EMAIL_DOMAIN}`,
      `@${TIMBL_DEV_EMAIL_DOMAIN}`,
    )
  }
  if (out.appName === LEGACY_AGENT_APP_NAME) {
    out.appName = TIMBL_AGENT_APP_NAME
  }
  return out
}

async function copyDocTree(
  fromRef: DocumentReference,
  toRef: DocumentReference,
  dryRun: boolean,
  stats: { docs: number },
): Promise<void> {
  const snap = await fromRef.get()
  if (!snap.exists) return

  const data = patchDoc(snap.data() as Record<string, unknown>)
  if (!dryRun) {
    await toRef.set(data, { merge: true })
  }
  stats.docs++

  const subcols = await fromRef.listCollections()
  for (const sub of subcols) {
    const docs = await sub.listDocuments()
    for (const doc of docs) {
      const relId = doc.id
      await copyDocTree(doc, toRef.collection(sub.id).doc(relId), dryRun, stats)
    }
  }
}

async function updateAgentAppNames(db: Firestore, dryRun: boolean): Promise<number> {
  let total = 0
  for (const orgId of [LEGACY_DEMO_ORG_ID, TIMBL_DEMO_ORG_ID]) {
    const snap = await db
      .collection(`organizations/${orgId}/agentSessions`)
      .where("appName", "==", LEGACY_AGENT_APP_NAME)
      .get()
    if (!dryRun && !snap.empty) {
      const batch = db.batch()
      for (const doc of snap.docs) {
        batch.update(doc.ref, { appName: TIMBL_AGENT_APP_NAME })
      }
      await batch.commit()
    }
    total += snap.size
  }
  return total
}

async function updateAuthClaims(dryRun: boolean): Promise<number> {
  const auth = getAuth()
  let updated = 0
  let pageToken: string | undefined
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) {
      if (user.customClaims?.organizationId !== LEGACY_DEMO_ORG_ID) continue
      if (!dryRun) {
        await auth.setCustomUserClaims(user.uid, {
          ...user.customClaims,
          organizationId: TIMBL_DEMO_ORG_ID,
        })
      }
      updated++
    }
    pageToken = page.pageToken
  } while (pageToken)
  return updated
}

async function deleteOrgTree(
  db: Firestore,
  orgRef: DocumentReference,
  dryRun: boolean,
): Promise<void> {
  const subs = await orgRef.listCollections()
  for (const sub of subs) {
    for (const doc of await sub.listDocuments()) {
      await deleteOrgTree(db, doc, dryRun)
    }
  }
  if (!dryRun) await orgRef.delete()
}

async function main() {
  const args = parseArgs()
  getAdminApp()
  const db = getFirestore()

  const projectId = process.env.GCP_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT
  console.log(`Project: ${projectId ?? "(from ADC)"}`)
  console.log(`Mode: ${args.dryRun ? "DRY RUN" : "COMMIT"}`)
  console.log(
    `Org: ${LEGACY_DEMO_ORG_ID} -> ${TIMBL_DEMO_ORG_ID}, app: ${LEGACY_AGENT_APP_NAME} -> ${TIMBL_AGENT_APP_NAME}`,
  )

  const fromRef = db.doc(`organizations/${LEGACY_DEMO_ORG_ID}`)
  const toRef = db.doc(`organizations/${TIMBL_DEMO_ORG_ID}`)
  const fromSnap = await fromRef.get()
  if (!fromSnap.exists) {
    console.log(`No legacy org at ${fromRef.path} - nothing to migrate.`)
    return
  }

  if (args.commit) {
    const ok = await confirm(
      `This will write to Firestore on project ${projectId ?? "default"}.`,
    )
    if (!ok) {
      console.log("Aborted.")
      process.exit(1)
    }
  }

  const stats = { docs: 0 }
  await copyDocTree(fromRef, toRef, args.dryRun, stats)
  console.log(`Org tree: ${stats.docs} docs ${args.dryRun ? "would be" : ""} copied`)

  const sessions = await updateAgentAppNames(db, args.dryRun)
  console.log(
    `Agent sessions: ${sessions} ${args.dryRun ? "would be" : ""} updated`,
  )

  const claims = await updateAuthClaims(args.dryRun)
  console.log(`Auth claims: ${claims} users ${args.dryRun ? "would be" : ""} updated`)

  if (args.deleteLegacy && args.commit) {
    await deleteOrgTree(db, fromRef, false)
    console.log(`Deleted legacy org ${fromRef.path}`)
  }

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
