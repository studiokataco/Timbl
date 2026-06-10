# Timbl - conventions for Claude Code

## Read first
- For ANY UI work, read `/DESIGN.md` before making styling decisions. The Airtable design system (canvas-white background, near-black `ink` primary CTA, signature coral / forest / peach / mint / yellow palette for category pills) is the source of truth - `components/ui/` shadcn primitives are owned and skinned through tokens in `app/globals.css` that map back to `DESIGN.md`.
- For data model and product questions, read `docs/PRD-Social-Media-Planner.md`. (Will be copied into the repo during a future commit; until then the source PRD lives at `~/Downloads/files/PRD-BecksUp-Social-Planner.md` - note the upstream filename, the in-repo copy gets the neutral name.)
- The phased build plan lives at `~/.claude/plans/users-kataco-downloads-files-prd-becksu-snug-adleman.md`. We are mid-build - check git log to see which phase last shipped.

## Stack rules
- Next.js 16 App Router + TypeScript strict mode + Tailwind CSS v4.
- All forms use `react-hook-form` + `zod`. Zod schemas live in `lib/schemas/` and are reused on client and server.
- All server mutations use Next.js server actions (NOT API routes).
- All client data fetching uses TanStack Query.
- shadcn/ui components live in `components/ui/` and are owned - modify freely to align with `DESIGN.md`.
- Feature components live in `components/{feature}/` (e.g. `components/calendar/`, `components/composer/`).
- Server actions live in `lib/actions/`.
- Toasts via `sonner`, never the shadcn Toast.
- Sentence case in all user-facing copy.
- Icons: `lucide-react`, single style.

## Tenancy (multi-tenant from day 1)
- Every domain doc lives under `/organizations/{orgId}/...` in Firestore. `safe-foundation` is the demo org for v1.
- Every server action MUST call `getCurrentOrgId()` from `lib/auth/server-helpers.ts` before reading or writing.
- Never trust implicit scoping. The Admin SDK bypasses Security Rules during dev; app-layer filtering is our only protection until Phase 7.
- When auth is added in Phase 7, the user-scoped client engages Security Rules as a second defense layer. Defense in depth - keep the explicit `organizationId` filtering even after rules go live.

## Auth state (until Phase 7)
- `lib/auth/dev-session.ts` is the source of "who is logged in" - a neutral Timbl admin user. Do not hardcode personal names anywhere; the dev-shim user is "Timbl Admin" with email `admin@safefoundation.dev`.
- The dev banner at the top of the app reminds us auth isn't real yet. It auto-hides in production.
- Don't add `/login` or `/auth/callback` routes until Phase 7.

## Local-first execution
- Phases 0-6 + 8 run entirely against the Firebase Emulator Suite. Do not deploy. Do not create a production Firebase project. Do not point the app at any cloud Firebase backend until the user explicitly approves Phase 7.
- Seed scripts in `firestore/seeds/` target the emulator. The CSV migration runs locally first.

### Local dev workflow

**One-liner:** `pnpm dev` - orchestrated by `scripts/dev.mjs`. It:
1. Spawns `firebase emulators:start --only firestore,auth,storage`.
2. Waits for port 8080 to accept connections.
3. (Confirm if `firestore/seeds/run.ts` is still needed for seeding in the current app; skip or update this step if not required.)
4. Spawns `next dev` with `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` / `FIREBASE_STORAGE_EMULATOR_HOST` / `NEXT_PUBLIC_USE_EMULATORS=1` set.

All four streams interleave in one terminal, prefixed by `[emulators]`, `[seed]`, `[next]`. Ctrl-C tears everything down cleanly.

Other scripts:
- `pnpm emulators` - bare emulator boot, no seed, no Next. Useful for ad-hoc data inspection at http://127.0.0.1:4000.
- `pnpm seed` - re-seed against an already-running emulator.
- `pnpm dev:next` - Next dev only, assumes the emulator is already up.
- `pnpm dev:cloud` - no-emulator escape hatch for Phase 7+ (real Firebase project). Don't use it before then.

## Typography
- Use ASCII `-` (hyphen-minus) only. Never use en dash `–`, em dash `—`, or other Unicode dashes in code, copy, comments, or docs unless an external spec requires the exact character.

## What NOT to do
- Don't add Storybook. This isn't a design-system project.
- Don't write speculative tests. Type safety + zod runtime validation is the first test layer; one /agent-browser skilled test for smoke test per phase is the second.
- Don't hallucinate new features. Always reference to the current codebase and its capabilities to stabillise or scale. 

## Commit hygiene
- One phase per session. Don't pile two phase prompts on top of each other. You can use agent orchestration to break down the work into smaller chunks.
- Always start a session with `git status` so we see the current state before proposing changes.
- Migrations / seeds are append-only. Never edit a committed seed; write a new one to alter.

## Memory & Rules
File-based memory lives in the Obsidian vault. Read the relevant note only when you need it (don't load preemptively):
- /Users/kataco/Documents/Development/claude-obsidian/ClaudeMemory/Decisions/  — durable architectural & product decisions
- /Users/kataco/Documents/Development/claude-obsidian/ClaudeMemory/Mistakes/   — gotchas worth not repeating
- /Users/kataco/Documents/Development/claude-obsidian/ClaudeMemory/Context/    — infra/setup facts (where things live, how to run them)
This project: /Users/kataco/Documents/Development/claude-obsidian/ClaudeMemory/Decisions/safe.md
