# Timbl design-sync notes

Timbl is a Next.js app, not a component library. There is no component `dist/`, so the
converter runs in a **barrel + synth** arrangement:

- `.design-sync/entry.tsx` is a hand-written barrel that `export *`s each curated
  component. It is passed as `--entry` so `PKG_DIR` resolves to the repo root (its
  `package.json` has `name: timbl`), which makes `srcDir`, `componentSrcMap`, and
  `cssEntry` resolve against the repo.
- Build: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry ./.design-sync/entry.tsx --out ./ds-bundle`
- All npm/network operations must run with the sandbox disabled (the default Bash
  sandbox blocks `registry.npmjs.org`).

## CSS strategy (Tailwind v4)
- Components style via Tailwind v4 utility classes; the source `app/globals.css` uses
  `@import "tailwindcss"` which is not a real stylesheet, so it can't ship directly.
- `cfg.buildCmd` compiles `app/globals.css` into `.design-sync/.cache/compiled.css`
  (real utilities + `:root`/`.dark`/`.auth-dark` token blocks) via the Tailwind v4 CLI
  installed under `.ds-sync/`. That compiled file is `cfg.cssEntry`.
- `.cache/` is gitignored, so `buildCmd` regenerates `compiled.css` on every fresh run.

## Component set
- 28 components, curated to mirror the prior (config-lost) project's groups:
  core / forms / navigation / overlay / feedback / brand / product.
- Groups are set via `cfg.docsMap` -> `.design-sync/docs/<Name>.md` category stubs
  (the source dirs don't match the DS groups).
- `sonner.tsx` exports `Toaster` (the prior project called it `Toast`); kept as
  `Toaster` to match the real export name.

## Dropped from the prior project (do not retry without fixing)
- **KanbanCard** (`components/kanban/card.tsx`): transitively imports `lib/actions/*`
  server actions (node:crypto, @fastify/busboy) -> 535 esbuild errors. App-coupled,
  cannot bundle for the browser. Would need a decoupled presentational variant.
- **Icon, PostPill, StatusDot**: existed in the prior project but no longer resolve to
  any repo source (renamed/removed or preview-only). Dropped.

## Preview conventions (calibrated)
- Previews `import { X } from "timbl"` (rewritten to `window.Timbl` by the story-imports plugin).
- Inline styles are fine for layout glue; `var(--muted-foreground)` etc. resolve in previews.
- Switch is controlled (`checked` prop) with no internal state; render fixed `checked` values.
- Avatar images won't load offline - use `AvatarFallback` initials.
- Overlays (Dialog/Sheet/Popover/Tooltip/Select/DropdownMenu) need `cfg.overrides.<Name>`
  with `cardMode: "single"` + a `viewport` + an open default state, or they render collapsed.

## Progress (mid-run, atomic path)
- 14/28 graded good: Button, Badge, Card, Checkbox, Input, Textarea, Switch, Toggle,
  ToggleGroup, InputGroup, Label, Separator, Skeleton, Avatar.
- 21/28 graded good. Remaining (overlays, need cfg.overrides + open state): DropdownMenu,
  Dialog, Popover, Sheet, Tooltip, Select, Toaster.
- GROUPING FIX pending: package-shape group = src dir unless in GENERIC_DIR; docsMap
  `category` only overrides a `general`/`misc` group (package-build.mjs ~777). So
  components/shared/* (ChannelGlyph, EmptyState, PageHeader) land in group "shared"
  instead of brand/product. Fix: declared fork of lib/source-kit.mjs adding 'shared' to
  GENERIC_DIR -> they fall to `general` -> docsMap category (brand/product) applies.
  TimblLogo (components/brand) stays brand via src; BrandGlowButton (ui) already category.

## Known render warns (triaged benign - do not chase on re-sync)
- `[RENDER_THIN] ChannelGlyph`: the preview renders 4 full-color SVG channel glyphs
  (confirmed in the review sheet) but they carry no text, so the thin heuristic flags them.
  Benign.

## Toaster ships the floor card (deliberate)
- `sonner`'s `Toaster` only paints when `toast()` is called at runtime. The bundled Toaster
  carries its OWN sonner store; a preview importing `toast` from node_modules `sonner` is a
  SEPARATE instance, so the call never reaches it, and timbl doesn't re-export `toast`.
  Cannot be previewed statically -> floor card. Its override was removed and
  `.design-sync/previews/Toaster.tsx` deleted.

## Preview status: COMPLETE
- 27/28 authored + graded good; Toaster on the floor card. validate exits 0, bad empty.
- Groups match the curated set: brand, core, feedback, forms, navigation, overlay, product.

## Upload outcome (this run) + preserve rule
- Uploaded to project 71785e10 (atomic path, no anchor existed). 28 components, nested
  layout. Old project used a FLAT layout - all old flat files were deleted (111), plus the
  8 orphaned tokens/*.css.
- PRESERVED deliberately (user choice "Preserve + prune tokens"): `guidelines/` (21
  hand-authored design cards), `assets/`, `uploads/`. These are NOT produced by this build.
  A future atomic re-sync's reconciliation MUST NOT delete guidelines/assets/uploads - scope
  deletes to `components/**` and `tokens/**` only, never a blanket "everything not in build".
- App-generated files (_ds_manifest.json, _adherence.oxlintrc.json, thumbnail.html,
  .thumbnail) were left in place; the self-check regenerates them on project open.

## Re-sync risks
- `compiled.css` is a build artifact regenerated from the LIVE `app/globals.css`; if the
  Cal tokens/utilities change, previews reflect the new design automatically (intended).
- The barrel is hand-maintained: adding a repo component means editing `entry.tsx` +
  `componentSrcMap` + `docsMap` + a docs stub together.
- Any curated component that grows a server-action/Next-server import will break the
  single-IIFE bundle wholesale (see KanbanCard). Watch esbuild "Could not resolve node:*".
- `guidelines/` picks up 11 repo `docs/*.md` by default — review before upload; set
  `cfg.guidelinesGlob: []` if any are unfit to ship.
