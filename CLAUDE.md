# BecksUp Planner — conventions for Claude Code

## Read first
- For ANY UI work, read `/DESIGN.md` before making styling decisions. The Airtable design system (canvas-white background, near-black `ink` primary CTA, signature coral / forest / peach / mint / yellow palette for category pills) is the source of truth — `components/ui/` shadcn primitives are owned and skinned through tokens in `app/globals.css` that map back to `DESIGN.md`.
- For data model and product questions, read `docs/PRD-BecksUp-Social-Planner.md`. (Will be copied into the repo during a future commit; until then it lives at `~/Downloads/files/PRD-BecksUp-Social-Planner.md`.)
- The phased build plan lives at `~/.claude/plans/users-kataco-downloads-files-prd-becksu-snug-adleman.md`. We are mid-build — check git log to see which phase last shipped.

## Stack rules
- Next.js 16 App Router + TypeScript strict mode + Tailwind CSS v4.
- All forms use `react-hook-form` + `zod`. Zod schemas live in `lib/schemas/` and are reused on client and server.
- All server mutations use Next.js server actions (NOT API routes).
- All client data fetching uses TanStack Query.
- shadcn/ui components live in `components/ui/` and are owned — modify freely to align with `DESIGN.md`.
- Feature components live in `components/{feature}/` (e.g. `components/calendar/`, `components/composer/`).
- Server actions live in `lib/actions/`.
- Toasts via `sonner`, never the shadcn Toast.
- Sentence case in all user-facing copy.
- Icons: `lucide-react`, single style.

## Tenancy (multi-tenant from day 1)
- Every domain doc lives under `/organizations/{orgId}/...` in Firestore. SAFE is the only org for v1.
- Every server action MUST call `getCurrentOrgId()` from `lib/auth/server-helpers.ts` before reading or writing.
- Never trust implicit scoping. The Admin SDK bypasses Security Rules during dev; app-layer filtering is our only protection until Phase 7.
- When auth is added in Phase 7, the user-scoped client engages Security Rules as a second defense layer. Defense in depth — keep the explicit `organizationId` filtering even after rules go live.

## Auth state (until Phase 7)
- `lib/auth/dev-session.ts` is the source of "who is logged in" — a neutral SAFE admin user. Do not hardcode personal names anywhere; the dev-shim user is "SAFE Admin" with email `admin@safefoundation.dev`.
- The dev banner at the top of the app reminds us auth isn't real yet. It auto-hides in production.
- Don't add `/login` or `/auth/callback` routes until Phase 7.

## Local-first execution
- Phases 0–6 + 8 run entirely against the Firebase Emulator Suite. Do not deploy. Do not create a production Firebase project. Do not point the app at any cloud Firebase backend until the user explicitly approves Phase 7.
- Seed scripts in `firestore/seeds/` target the emulator. The CSV migration runs locally first.

## What NOT to do
- Don't add a state-management library (Zustand etc.). TanStack Query + URL params + small `useState` cover everything here.
- Don't add tRPC, GraphQL, or a custom API layer.
- Don't add Storybook. This isn't a design-system project.
- Don't add Docker. Local + Firebase Emulator Suite is enough.
- Don't write speculative tests. Type safety + zod runtime validation is the first test layer; one Playwright smoke test per phase is the second.
- Don't auto-publish to Instagram in v1. Status tracking is the v1 job.

## Commit hygiene
- One phase per session. Don't pile two phase prompts on top of each other.
- Always start a session with `git status` so we see the current state before proposing changes.
- Migrations / seeds are append-only. Never edit a committed seed; write a new one to alter.
