import posthog from "posthog-js"

/*
 * Client-side PostHog bootstrap. Next.js runs this file once in the browser
 * before hydration (the `instrumentation-client` convention). We deliberately
 * skip init when:
 *   - no key is configured (a checkout without analytics env), or
 *   - the app is pointed at the Firebase Emulator Suite, so local dev never
 *     pollutes the production analytics project.
 *
 * Events are sent same-origin to /ingest, which next.config rewrites to the
 * PostHog US ingestion + asset hosts - keeping ad-blockers from silently
 * dropping them. `capture_pageview: "history_change"` handles App Router
 * client navigations (no full page loads), so no manual pageview wiring is
 * needed. `person_profiles: "identified_only"` keeps anonymous traffic from
 * creating person profiles until auth lands (Phase 7) and we call identify().
 *
 * Session replay records user sessions. Whether recording actually runs is
 * still gated by the project-level toggle in PostHog (Settings -> Replay); this
 * config only sets the privacy posture. `maskAllInputs: true` blanks every form
 * field (where post drafts, captions, and PII get typed) while leaving UI chrome
 * visible so replays stay useful. Tighten further with `maskTextSelector` on
 * specific containers if rendered draft content needs masking too.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
const usingEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"

if (key && !usingEmulators) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: "history_change",
    capture_pageleave: true,
    person_profiles: "identified_only",
    enable_heatmaps: true,
    session_recording: {
      maskAllInputs: true,
    },
  })
}
