# Firestore seeds

Two conceptually distinct seed paths exist in this app - keep them separate
in your head even though they live in the same folder today.

## demo-org (these `00xx_*.ts` files)

The 0001-0009 seeds load the Timbl demo workspace data into the emulator.
Only ever run in local dev (`pnpm seed`); never in production.

The demo org seed (`0001_demo_org.ts`) backfills:

- `plan: "agency_v1"` - so nothing the dev user clicks hits a quota gate.
- `onboarding.completedAt` - so the (app) layout doesn't redirect to
  `/onboarding` on every dev boot.

If you add a new demo-org seed, file it with the existing 0001-0009
numbering and import it from `run.ts`.

## defaults (wizard-driven, no seed file)

For real (non-demo) orgs, starter content comes from the **onboarding
wizard**, not from a seed file. The wizard reads
`lib/onboarding/industry-defaults.ts` and writes the user's chosen
categories / agent toggles / channel hints via `lib/actions/onboarding.ts`.

That means:

- Categories: `applyOnboardingSelections` upserts the picked subset from
  `INDUSTRY_DEFAULTS`.
- Agents: existing `agentConfig` docs are flipped on/off - the catalog
  itself is created when a new org signs up (TODO: hook into signup once
  Phase 7 ships).
- Templates: suggested template slugs are surfaced on step 4 but not yet
  materialized into the org's template collection (deferred).
- Channels: stored on `onboarding.profile.channels` - authoritative
  connection state lands in a separate collection in Phase 7+.

If you need to add a starter category for a new industry, edit
`lib/onboarding/industry-defaults.ts` - NOT a seed file. The wizard picks
it up automatically.
