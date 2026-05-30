# CSV migration

One-shot import of the legacy 9-tab planner spreadsheet into Firestore under the SAFE org.

## Files

```
migration/
├── README.md            ← you are here
├── reconciliation.ts    ← canonical staff, category map, status collapse, date parser
├── sample/              ← committed fictional fixtures used to dry-run the script
└── source/              ← gitignored. Drop the real CSV exports here.
```

The script (`scripts/migrate-from-csv.ts`) expects these filenames:

| File | Tab in legacy sheet |
|---|---|
| `main.csv` | Main Planner |
| `copy-of-main.csv` | Copy of Main Page (deduped against main by date+brief) |
| `events.csv` | Events tab posts |
| `20-years.csv` | 20 Years of SAFE posts (auto-linked to the campaign) |
| `meet-the-team.csv` | Meet The Team posts (auto-linked to the template) |
| `awareness.csv` | Awareness days reference |
| `campaigns.csv` | Campaign reference |
| `events-list.csv` | Events reference (writes to `/organizations/.../events`) |

Any of these may be omitted - the script logs and skips. Column names are matched case-insensitively across a few common variants (e.g. `Date`/`Scheduled`, `Catagory`/`Category`).

## Run

The script targets whatever Firestore the running env points at - emulator by default during dev. Always boot the emulator and seed the org first:

```bash
pnpm dev    # or: pnpm emulators + pnpm seed
```

Then in another terminal:

```bash
# Dry-run against the committed fictional fixtures:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  pnpm tsx scripts/migrate-from-csv.ts --dry-run --source migration/sample

# Dry-run against your real exports (after dropping them in migration/source):
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  pnpm tsx scripts/migrate-from-csv.ts --dry-run

# Once the report looks right, commit:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  pnpm tsx scripts/migrate-from-csv.ts --commit
```

`--commit` prompts for `yes` before writing. The script refuses to run if `/organizations/safe-foundation` doesn't exist (run `pnpm seed` first).

## Output

- `migration/report.csv` - one row per source row, with status `imported | skipped | manual_review` and a reason. Use this to triage.
- Console summary - counts per tab + any canonical staff names with no occurrences.

## Idempotency

Every imported doc carries `migratedFrom = { sourceTab, sourceRow, sourceHash }`. Re-running the script skips writes whose hash matches an existing doc, so you can safely:

1. Run `--dry-run`, fix CSV issues, re-run.
2. Run `--commit`, notice a missed mapping, fix `reconciliation.ts`, re-run `--commit` - only new rows get written.

The hash is derived from `(tab, row index, key fields)`. Editing brief or date in the source CSV produces a new hash and therefore a duplicate doc; for those, delete the bad doc in the emulator UI first or rely on the `dedupeAgainstMain` heuristic.

## Reconciliation rules

`migration/reconciliation.ts` is data, not code - keep it shallow:

- **Staff fuzzy match**: `string-similarity` ≥ 0.85 auto-applied. Below threshold flagged as `manual_review`. Cells like `Ange/Phil` are split on `/`, `+`, `,`, `&`, `and`.
- **Category map**: hard-coded CSV → category slug. Misses fall back to `general` and emit a review flag.
- **CTA map**: trims whitespace, case-insensitive lookup.
- **Status collapse**: legacy two-column (Research, Design) → single `status`. Posted wins; Deadline MISSED → missed; Working on it → designing; Ready to Schedule → scheduled; default → idea.
- **Date parser**: handles `23-Feb`, `22 Mar`, `Feb 23`, `01/04`, ISO. Year is supplied via `--year YYYY` (defaults to current year).

To adjust any rule, edit `reconciliation.ts` and re-run with `--dry-run` to see the new mapping reflected in `report.csv`.
