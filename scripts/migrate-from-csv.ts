#!/usr/bin/env tsx
/*
 * One-shot CSV migration: legacy 9-tab planner spreadsheet → Firestore.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-from-csv.ts --dry-run [--source migration/sample]
 *   pnpm tsx scripts/migrate-from-csv.ts --commit  [--source migration/source]
 *
 * Flags:
 *   --dry-run         Read + reconcile, write nothing. Default if no flag.
 *   --commit          Actually write to Firestore. Requires interactive
 *                     confirmation. Refuses to run if /organizations/timbl-demo
 *                     does not yet exist (run pnpm seed first).
 *   --source <dir>    Where the CSVs live. Default: migration/source.
 *   --year <YYYY>     Default year for ambiguous dates. Default: current year.
 *   --report <path>   Where to write the report CSV. Default:
 *                     migration/report.csv.
 *
 * Idempotency: every imported doc carries `migratedFrom = { sourceTab,
 * sourceRow, sourceHash }`. A second run skips writes whose hash matches.
 *
 * The script never assumes all 9 tabs exist — missing files are logged and
 * skipped. This makes partial re-runs safe after fixing one tab in isolation.
 */

import { createHash } from "node:crypto"
import { readFileSync, existsSync, writeFileSync, readdirSync } from "node:fs"
import path from "node:path"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { parse } from "csv-parse/sync"
import { getAdminDb } from "../lib/firebase/admin"
import {
  awarenessDaysPath,
  orgCampaignsPath,
  orgEventsPath,
  orgPostsPath,
  orgPath,
  orgUsersPath,
} from "../lib/firebase/paths"
import {
  TIMBL_DEMO_ORG_ID,
  TIMBL_DEV_EMAIL_DOMAIN,
} from "../lib/constants/timbl"
import {
  CANONICAL_STAFF,
  collapseStatus,
  mapCategory,
  mapCta,
  matchStaff,
  parseLooseDate,
  staffSlug,
  type CanonicalStaff,
} from "../migration/reconciliation"

const DEMO_ORG_ID = TIMBL_DEMO_ORG_ID

type Args = {
  dryRun: boolean
  commit: boolean
  sourceDir: string
  reportPath: string
  yearHint: number
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: !argv.includes("--commit"),
    commit: argv.includes("--commit"),
    sourceDir: "migration/source",
    reportPath: "migration/report.csv",
    yearHint: new Date().getFullYear(),
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--source" && argv[i + 1]) {
      args.sourceDir = argv[i + 1]!
      i++
    } else if (a === "--report" && argv[i + 1]) {
      args.reportPath = argv[i + 1]!
      i++
    } else if (a === "--year" && argv[i + 1]) {
      args.yearHint = Number(argv[i + 1])
      i++
    }
  }
  if (args.commit) args.dryRun = false
  return args
}

type CsvRow = Record<string, string>

function loadCsv(filepath: string): CsvRow[] {
  if (!existsSync(filepath)) return []
  const buf = readFileSync(filepath, "utf8")
  const records = parse(buf, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as CsvRow[]
  return records
}

function pick(row: CsvRow, ...candidates: string[]): string | undefined {
  for (const key of candidates) {
    const value = row[key]
    if (value && value.trim()) return value.trim()
    // case-insensitive fallback
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === key.toLowerCase()) {
        const v = row[k]
        if (v && v.trim()) return v.trim()
      }
    }
  }
  return undefined
}

function hashRow(tab: string, row: number, payload: unknown): string {
  return createHash("sha256")
    .update(`${tab}::${row}::${JSON.stringify(payload)}`)
    .digest("hex")
    .slice(0, 16)
}

type ReportRow = {
  sourceTab: string
  sourceRow: number
  targetCollection: string
  targetId: string
  status: "imported" | "skipped" | "manual_review"
  reason: string
}

class Reporter {
  rows: ReportRow[] = []
  add(r: ReportRow) {
    this.rows.push(r)
  }
  summary(): Record<ReportRow["status"], number> {
    return this.rows.reduce(
      (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
      { imported: 0, skipped: 0, manual_review: 0 } as Record<
        ReportRow["status"],
        number
      >,
    )
  }
  toCsv(): string {
    const head = [
      "source_tab",
      "source_row",
      "target_collection",
      "target_id",
      "status",
      "reason",
    ]
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines = [head.join(",")]
    for (const r of this.rows) {
      lines.push(
        [
          r.sourceTab,
          String(r.sourceRow),
          r.targetCollection,
          r.targetId,
          r.status,
          r.reason,
        ]
          .map(escape)
          .join(","),
      )
    }
    return lines.join("\n")
  }
}

async function ensureOrgExists(db: FirebaseFirestore.Firestore): Promise<void> {
  const snap = await db.doc(orgPath(DEMO_ORG_ID)).get()
  if (!snap.exists) {
    throw new Error(
      `Organization /organizations/${DEMO_ORG_ID} does not exist. Run pnpm seed against your target before migrating.`,
    )
  }
}

type ImportContext = {
  db: FirebaseFirestore.Firestore
  args: Args
  reporter: Reporter
  staffByRaw: Map<string, CanonicalStaff>
  manualStaff: Set<string>
  // sourceHashes already-imported, keyed by docId — used to skip duplicates
  // on re-run.
  existingHashesByPath: Map<string, Set<string>>
}

async function loadExistingHashes(
  db: FirebaseFirestore.Firestore,
  collectionPath: string,
): Promise<Set<string>> {
  const snap = await db.collection(collectionPath).select("migratedFrom").get()
  const out = new Set<string>()
  for (const d of snap.docs) {
    const m = d.get("migratedFrom") as { sourceHash?: string } | undefined
    if (m?.sourceHash) out.add(m.sourceHash)
  }
  return out
}

async function getExistingHashes(
  ctx: ImportContext,
  collectionPath: string,
): Promise<Set<string>> {
  let existing = ctx.existingHashesByPath.get(collectionPath)
  if (!existing) {
    existing = await loadExistingHashes(ctx.db, collectionPath)
    ctx.existingHashesByPath.set(collectionPath, existing)
  }
  return existing
}

/* ───────────────────────────── Step 1: Users ─────────────────────────── */

async function importUsers(ctx: ImportContext, allRows: CsvRow[]): Promise<void> {
  const seen = new Set<CanonicalStaff>()
  const ambiguous = new Set<string>()

  for (const row of allRows) {
    // Only scan staff-bearing columns. "Blurb" itself is caption text and
    // would otherwise leak whole sentences into the matcher.
    for (const key of [
      "Lead",
      "Assignee",
      "Blurb Author",
      "Designer",
      "Researcher",
    ]) {
      const raw = pick(row, key)
      if (!raw) continue
      // some cells contain "Ange/Phil" or "Ange + Phil" — split them.
      const parts = raw.split(/[\/+,&]| and /i)
      for (const part of parts) {
        const result = matchStaff(part)
        if (result.kind === "exact" || result.kind === "fuzzy") {
          seen.add(result.canonical)
          ctx.staffByRaw.set(part.trim().toLowerCase(), result.canonical)
        } else if (result.kind === "ambiguous") {
          ambiguous.add(result.raw)
        }
      }
    }
  }

  for (const raw of ambiguous) ctx.manualStaff.add(raw)

  const usersPath = orgUsersPath(DEMO_ORG_ID)
  for (const name of seen) {
    const id = staffSlug(name)
    const sourceHash = hashRow("users", 0, { name, id })
    const docPath = `${usersPath}/${id}`

    if (ctx.args.dryRun) {
      console.log(`  [dry] user ${id} (${name})`)
      ctx.reporter.add({
        sourceTab: "users",
        sourceRow: 0,
        targetCollection: usersPath,
        targetId: id,
        status: "imported",
        reason: `dry-run: would create user ${name}`,
      })
      continue
    }

    const ref = ctx.db.doc(docPath)
    const snap = await ref.get()
    const now = new Date().toISOString()

    if (snap.exists) {
      ctx.reporter.add({
        sourceTab: "users",
        sourceRow: 0,
        targetCollection: usersPath,
        targetId: id,
        status: "skipped",
        reason: "user already exists",
      })
      continue
    }

    await ref.set({
      id,
      organizationId: DEMO_ORG_ID,
      email: `${id}@${TIMBL_DEV_EMAIL_DOMAIN}`,
      name,
      role: "contributor",
      defaultCategories: [],
      migratedFrom: { sourceTab: "users", sourceRow: 0, sourceHash },
      createdAt: now,
      updatedAt: now,
    })
    ctx.reporter.add({
      sourceTab: "users",
      sourceRow: 0,
      targetCollection: usersPath,
      targetId: id,
      status: "imported",
      reason: `imported user ${name}`,
    })
  }

  for (const raw of ambiguous) {
    ctx.reporter.add({
      sourceTab: "users",
      sourceRow: 0,
      targetCollection: usersPath,
      targetId: "(unmatched)",
      status: "manual_review",
      reason: `Ambiguous staff name: ${raw}`,
    })
  }

  console.log(
    `  ✓ users: ${seen.size} canonical, ${ambiguous.size} ambiguous flagged`,
  )
}

/* ─────────────────────────── Step 2: Awareness ───────────────────────── */

async function importAwareness(
  ctx: ImportContext,
  rows: CsvRow[],
): Promise<void> {
  if (rows.length === 0) {
    console.log("  · awareness tab missing, skipping")
    return
  }
  const collection = awarenessDaysPath
  const existing = await getExistingHashes(ctx, collection)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const name = pick(row, "Name", "Awareness Day", "Day")
    const dateRaw = pick(row, "Date")
    const description = pick(row, "Description", "Notes")
    const importance = (pick(row, "Importance") ?? "medium").toLowerCase()
    const suggested = pick(row, "Suggested Category", "Category")

    if (!name || !dateRaw) {
      ctx.reporter.add({
        sourceTab: "awarenessDays",
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: "(skipped)",
        status: "manual_review",
        reason: "Missing name or date",
      })
      continue
    }

    const date = parseLooseDate(dateRaw, ctx.args.yearHint)
    if (!date) {
      ctx.reporter.add({
        sourceTab: "awarenessDays",
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: "(skipped)",
        status: "manual_review",
        reason: `Unparseable date: "${dateRaw}"`,
      })
      continue
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const id = `${slug}-${date.slice(0, 4)}`
    const sourceHash = hashRow("awarenessDays", i, { name, date })

    if (existing.has(sourceHash)) {
      ctx.reporter.add({
        sourceTab: "awarenessDays",
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: id,
        status: "skipped",
        reason: "already migrated",
      })
      continue
    }

    if (ctx.args.dryRun) {
      ctx.reporter.add({
        sourceTab: "awarenessDays",
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: id,
        status: "imported",
        reason: `dry-run: would create ${name}`,
      })
      continue
    }

    const now = new Date().toISOString()
    await ctx.db.doc(`${collection}/${id}`).set(
      {
        id,
        date,
        name,
        description,
        importance: ["low", "medium", "high"].includes(importance)
          ? importance
          : "medium",
        recurringPattern: "annual",
        suggestedCategorySlug: suggested
          ? mapCategory(suggested).slug
          : undefined,
        migratedFrom: { sourceTab: "awarenessDays", sourceRow: i + 2, sourceHash },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    )
    existing.add(sourceHash)
    ctx.reporter.add({
      sourceTab: "awarenessDays",
      sourceRow: i + 2,
      targetCollection: collection,
      targetId: id,
      status: "imported",
      reason: `imported ${name}`,
    })
  }
}

/* ─────────────────────── Step 3: Campaigns + Templates ──────────────── */

async function importCampaigns(
  ctx: ImportContext,
  rows: CsvRow[],
): Promise<void> {
  if (rows.length === 0) {
    console.log("  · campaigns tab missing, skipping")
    return
  }
  const collection = orgCampaignsPath(DEMO_ORG_ID)
  const existing = await getExistingHashes(ctx, collection)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const name = pick(row, "Name", "Campaign")
    if (!name) continue
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const sourceHash = hashRow("campaigns", i, { name })

    if (existing.has(sourceHash)) {
      ctx.reporter.add({
        sourceTab: "campaigns",
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: slug,
        status: "skipped",
        reason: "already migrated",
      })
      continue
    }

    if (ctx.args.dryRun) {
      ctx.reporter.add({
        sourceTab: "campaigns",
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: slug,
        status: "imported",
        reason: `dry-run: would create ${name}`,
      })
      continue
    }

    const now = new Date().toISOString()
    await ctx.db.doc(`${collection}/${slug}`).set(
      {
        id: slug,
        organizationId: DEMO_ORG_ID,
        slug,
        name,
        description: pick(row, "Description"),
        startDate: parseLooseDate(pick(row, "Start", "Start Date"), ctx.args.yearHint) ?? undefined,
        endDate: parseLooseDate(pick(row, "End", "End Date"), ctx.args.yearHint) ?? undefined,
        status: pick(row, "Status") ?? "active",
        color: pick(row, "Color"),
        migratedFrom: { sourceTab: "campaigns", sourceRow: i + 2, sourceHash },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    )
    existing.add(sourceHash)
    ctx.reporter.add({
      sourceTab: "campaigns",
      sourceRow: i + 2,
      targetCollection: collection,
      targetId: slug,
      status: "imported",
      reason: `imported ${name}`,
    })
  }
}

/* ───────────────────────────── Step 5: Posts ──────────────────────────
 *
 * The "main planner" tab — and its variants (copy of main, events,
 * 20-years, meet-the-team) — share roughly the same column shape. Each
 * variant overlays one extra link (eventId / campaignId / templateId).
 */

type PostVariant = {
  tab: string
  filename: string
  defaultCampaignId?: string
  defaultTemplateId?: string
  defaultEventLink?: boolean
  /** When dedupe-against-main, skip rows whose (date+brief) appear in mainHashes. */
  dedupeAgainstMain?: boolean
  noteFlag?: string
}

const POST_VARIANTS: PostVariant[] = [
  { tab: "main", filename: "main.csv" },
  {
    tab: "copy-of-main",
    filename: "copy-of-main.csv",
    dedupeAgainstMain: true,
    noteFlag: "Imported from 'Copy of Main Page' (potential duplicate).",
  },
  { tab: "events", filename: "events.csv", defaultEventLink: true },
  {
    tab: "20-years",
    filename: "20-years.csv",
    defaultCampaignId: "20th-anniversary-ball",
  },
  {
    tab: "meet-the-team",
    filename: "meet-the-team.csv",
    defaultTemplateId: "meet-the-team",
  },
]

function postKey(date: string | null, brief: string | undefined): string {
  return `${date ?? "?"}::${(brief ?? "").trim().toLowerCase()}`
}

async function importPosts(
  ctx: ImportContext,
  variants: { variant: PostVariant; rows: CsvRow[] }[],
): Promise<void> {
  const collection = orgPostsPath(DEMO_ORG_ID)
  const existing = await getExistingHashes(ctx, collection)
  const mainKeys = new Set<string>()

  for (const { variant, rows } of variants) {
    if (rows.length === 0) {
      console.log(`  · ${variant.tab} tab missing, skipping`)
      continue
    }

    let imported = 0
    let skipped = 0
    let flagged = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const dateRaw = pick(row, "Date", "Scheduled", "When")
      const brief = pick(row, "Brief", "Title", "Topic", "Post")
      if (!dateRaw && !brief) continue // empty row

      const date = parseLooseDate(dateRaw, ctx.args.yearHint)
      const reasons: string[] = []
      if (!date) reasons.push(`unparseable date "${dateRaw ?? ""}"`)
      if (!brief) reasons.push("missing brief")

      const key = postKey(date, brief)
      // Track main keys here (before any skip) so copy-of-main can dedupe
      // even on re-runs where main rows are skipped via hash.
      if (variant.tab === "main") mainKeys.add(key)
      if (variant.dedupeAgainstMain && mainKeys.has(key)) {
        ctx.reporter.add({
          sourceTab: variant.tab,
          sourceRow: i + 2,
          targetCollection: collection,
          targetId: "(dedupe)",
          status: "skipped",
          reason: "matches main planner row (date+brief)",
        })
        skipped++
        continue
      }

      const categoryRaw = pick(row, "Catagory", "Category")
      const cat = mapCategory(categoryRaw)
      if (categoryRaw && !cat.matched) {
        reasons.push(`unmapped category "${categoryRaw}" → general`)
      }

      const status = collapseStatus(
        pick(row, "Research Status", "Research"),
        pick(row, "Design Status", "Design"),
      )

      const ctaSlug = mapCta(pick(row, "CTA"))
      const leadResult = matchStaff(pick(row, "Lead"))
      const assignResult = matchStaff(pick(row, "Assignee", "Designer"))
      const blurbAuthorResult = matchStaff(pick(row, "Blurb Author"))

      const leadId =
        leadResult.kind === "exact" || leadResult.kind === "fuzzy"
          ? staffSlug(leadResult.canonical)
          : undefined
      const assigneeId =
        assignResult.kind === "exact" || assignResult.kind === "fuzzy"
          ? staffSlug(assignResult.canonical)
          : undefined
      const blurbAuthorId =
        blurbAuthorResult.kind === "exact" || blurbAuthorResult.kind === "fuzzy"
          ? staffSlug(blurbAuthorResult.canonical)
          : undefined

      let eventId: string | undefined
      if (variant.defaultEventLink) {
        const explicit = pick(row, "Event Slug", "Event Id")
        if (explicit) {
          eventId = explicit
        } else {
          const fromName = (pick(row, "Event Name") ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
          eventId = fromName || undefined
        }
      }

      const blurb = pick(row, "Blurb", "Caption", "Copy")
      const detailedBrief = pick(row, "Detailed Brief", "Notes")
      const hashtagsRaw = pick(row, "Hashtags")
      const hashtags = hashtagsRaw
        ? hashtagsRaw
            .split(/[,\s]+/)
            .map((h) => h.trim())
            .filter((h) => h.startsWith("#"))
        : []

      const sourceHash = hashRow(variant.tab, i, {
        date,
        brief,
        category: cat.slug,
      })
      if (existing.has(sourceHash)) {
        ctx.reporter.add({
          sourceTab: variant.tab,
          sourceRow: i + 2,
          targetCollection: collection,
          targetId: "(by hash)",
          status: "skipped",
          reason: "already migrated",
        })
        skipped++
        continue
      }

      const noteFromVariant = variant.noteFlag
      const reviewNote = reasons.length > 0 ? reasons.join("; ") : undefined

      if (!date) {
        // Without a date we can't write the post (scheduledDate is required).
        ctx.reporter.add({
          sourceTab: variant.tab,
          sourceRow: i + 2,
          targetCollection: collection,
          targetId: "(no date)",
          status: "manual_review",
          reason: reasons.join("; ") || "missing date",
        })
        flagged++
        continue
      }

      const ref = ctx.db.collection(collection).doc()

      if (ctx.args.dryRun) {
        ctx.reporter.add({
          sourceTab: variant.tab,
          sourceRow: i + 2,
          targetCollection: collection,
          targetId: ref.id,
          status: reviewNote ? "manual_review" : "imported",
          reason:
            (reviewNote ? `review: ${reviewNote}; ` : "") +
            `dry-run: would create "${brief}" on ${date}`,
        })
        if (reviewNote) flagged++
        else imported++
        continue
      }

      const now = new Date().toISOString()
      await ref.set({
        id: ref.id,
        organizationId: DEMO_ORG_ID,
        scheduledDate: date,
        status,
        categoryId: cat.slug,
        campaignId: variant.defaultCampaignId,
        templateId: variant.defaultTemplateId,
        eventId,
        postType: "grid",
        brief,
        detailedBrief,
        blurb,
        hashtags,
        ctaId: ctaSlug,
        leadUserId: leadId,
        assigneeId,
        blurbAuthorId,
        assetUrls: [],
        channelStatuses: {},
        notes: [reviewNote, noteFromVariant].filter(Boolean).join("\n\n") || undefined,
        migratedFrom: { sourceTab: variant.tab, sourceRow: i + 2, sourceHash },
        createdAt: now,
        updatedAt: now,
      })
      existing.add(sourceHash)
      ctx.reporter.add({
        sourceTab: variant.tab,
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: ref.id,
        status: reviewNote ? "manual_review" : "imported",
        reason: reviewNote
          ? `imported with review flag: ${reviewNote}`
          : `imported "${brief}" on ${date}`,
      })
      if (reviewNote) flagged++
      else imported++
    }

    console.log(
      `  ✓ ${variant.tab}: ${imported} imported, ${flagged} flagged, ${skipped} skipped`,
    )
  }
}

/* ──────────────────────────── Events tab ─────────────────────────────── */

async function importEvents(
  ctx: ImportContext,
  rows: CsvRow[],
): Promise<void> {
  if (rows.length === 0) return
  const collection = orgEventsPath(DEMO_ORG_ID)
  const existing = await getExistingHashes(ctx, collection)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const name = pick(row, "Event", "Event Name", "Name")
    const startRaw = pick(row, "Start", "Start Date", "Date")
    if (!name || !startRaw) continue
    const start = parseLooseDate(startRaw, ctx.args.yearHint)
    if (!start) continue
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const sourceHash = hashRow("events", i, { name, start })

    if (existing.has(sourceHash)) continue
    if (ctx.args.dryRun) {
      ctx.reporter.add({
        sourceTab: "events",
        sourceRow: i + 2,
        targetCollection: collection,
        targetId: slug,
        status: "imported",
        reason: `dry-run: would create event ${name}`,
      })
      continue
    }
    const now = new Date().toISOString()
    await ctx.db.doc(`${collection}/${slug}`).set(
      {
        id: slug,
        organizationId: DEMO_ORG_ID,
        name,
        startDate: start,
        endDate:
          parseLooseDate(pick(row, "End", "End Date"), ctx.args.yearHint) ?? undefined,
        location: pick(row, "Location"),
        organizer: pick(row, "Organizer", "Organiser"),
        organizerUrl: pick(row, "URL", "Link"),
        isSafeRun: (pick(row, "SAFE Run", "Run By SAFE") ?? "").toLowerCase() === "yes",
        migratedFrom: { sourceTab: "events", sourceRow: i + 2, sourceHash },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    )
    existing.add(sourceHash)
    ctx.reporter.add({
      sourceTab: "events",
      sourceRow: i + 2,
      targetCollection: collection,
      targetId: slug,
      status: "imported",
      reason: `imported event ${name}`,
    })
  }
}

/* ────────────────────────────── Driver ───────────────────────────────── */

async function confirmCommit(): Promise<boolean> {
  console.log(
    "\n⚠  --commit will write to Firestore for this org. Re-run with --dry-run first if you haven't",
  )
  console.log("   inspected the report.")
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(
    `Proceed with writes to /organizations/${DEMO_ORG_ID}? Type 'yes' to confirm: `,
  )
  rl.close()
  return answer.trim().toLowerCase() === "yes"
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const sourceDir = path.resolve(process.cwd(), args.sourceDir)
  console.log(
    `→ migration from ${sourceDir} (${args.dryRun ? "DRY RUN" : "COMMIT"}; year hint: ${args.yearHint})`,
  )
  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`)
  }
  console.log(`  source files: ${readdirSync(sourceDir).join(", ") || "(none)"}`)

  const db = getAdminDb()
  await ensureOrgExists(db)

  if (args.commit) {
    const ok = await confirmCommit()
    if (!ok) {
      console.log("✗ aborted by user, no writes")
      return
    }
  }

  const reporter = new Reporter()
  const ctx: ImportContext = {
    db,
    args,
    reporter,
    staffByRaw: new Map(),
    manualStaff: new Set(),
    existingHashesByPath: new Map(),
  }

  const allPostRows: CsvRow[] = []
  const variantRows: { variant: PostVariant; rows: CsvRow[] }[] = []
  for (const v of POST_VARIANTS) {
    const rows = loadCsv(path.join(sourceDir, v.filename))
    variantRows.push({ variant: v, rows })
    allPostRows.push(...rows)
  }
  const awarenessRows = loadCsv(path.join(sourceDir, "awareness.csv"))
  const campaignRows = loadCsv(path.join(sourceDir, "campaigns.csv"))
  const eventRows = loadCsv(path.join(sourceDir, "events-list.csv"))

  console.log("\n[1/5] Users")
  await importUsers(ctx, allPostRows)

  console.log("[2/5] Awareness days")
  await importAwareness(ctx, awarenessRows)

  console.log("[3/5] Campaigns")
  await importCampaigns(ctx, campaignRows)

  console.log("[4/5] Events")
  await importEvents(ctx, eventRows)

  console.log("[5/5] Posts")
  await importPosts(ctx, variantRows)

  // Persist canonical staff list for reference (canonical, not yet imported)
  if (ctx.manualStaff.size > 0) {
    console.log(
      `\n  ${ctx.manualStaff.size} ambiguous staff names flagged for manual review.`,
    )
  }

  // Always write the report.
  const reportPath = path.resolve(process.cwd(), args.reportPath)
  writeFileSync(reportPath, reporter.toCsv(), "utf8")
  console.log(`\n→ report written: ${reportPath}`)

  const summary = reporter.summary()
  console.log(
    `   imported=${summary.imported} review=${summary.manual_review} skipped=${summary.skipped}`,
  )

  // Sanity: report canonical staff that we mapped vs missed.
  const mapped = new Set(ctx.staffByRaw.values())
  const unmapped = CANONICAL_STAFF.filter((s) => !mapped.has(s))
  if (unmapped.length > 0) {
    console.log(
      `   canonical staff with no occurrences in source: ${unmapped.join(", ")}`,
    )
  }
}

main().catch((err) => {
  console.error("\n✗ migration failed:", err)
  process.exit(1)
})
