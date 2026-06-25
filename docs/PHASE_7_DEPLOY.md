# Phase 7 - production deploy runbook

> **Status:** Phase 7 shipped. Prod runs on `timbl-prod` - App Hosting backend `timbl-backend` in `asia-southeast1`, auto-deploying from `main` of github.com/studiokataco/Timbl, with Google SSO, Firestore, Functions, Storage, and Secret Manager. The earlier `sm-dashboard-e7641` project is cut over and pending decommission. This doc is reference material - a runbook for bootstrapping a prod project from a clean slate. Step commands use the `prod` alias (`.firebaserc` -> `timbl-prod`); substitute identifiers as needed.

This is the live runbook for taking the planner from emulator-only to a real Firebase deployment on the `timbl-prod` project. Do it in this order - every step has a verification check before the next one runs.

## 0. Local prerequisites

```bash
gcloud auth login
gcloud config set project timbl-prod
gcloud auth application-default login   # for Admin SDK local fallback

firebase login
firebase use prod                       # switches the CLI to timbl-prod
```

Verify: `firebase projects:list` shows the project as `(current)`.

## 1. Enable required APIs

```bash
gcloud services enable \
  identitytoolkit.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firebasestorage.googleapis.com \
  firestore.googleapis.com \
  firebaseapphosting.googleapis.com \
  --project timbl-prod
```

## 2. Enable Google Sign-in

In **Firebase Console → Authentication → Sign-in method**:

1. Enable Google as a provider.
2. Set the support email.
3. In **Authentication → Settings → Authorized domains**, ensure the App Hosting domain and `localhost` are listed (default is fine).

The blocking trigger that gates who may sign in lives in `functions/src/setUserClaims.ts` (signups are invite-only - gated by `NEW_ORG_SIGNUP` plus the admin approval queue) - it deploys with the rest of the functions in step 5.

## 3. Provision Firestore + Storage

```bash
# First time only. Pick a region close to users (asia-southeast1 for Timbl).
firebase firestore:databases:create '(default)' --location=asia-southeast1
gcloud storage buckets create gs://timbl-prod.firebasestorage.app --location=asia-southeast1 --project timbl-prod || true
```

Deploy the rules:

```bash
firebase deploy --only firestore:rules,storage:rules
```

## 4. Bootstrap secrets

Push every secret App Hosting references into Secret Manager and grant the App Hosting compute SA access:

```bash
pnpm secrets:bootstrap
```

The script is idempotent. You'll need values for:

- `FIREBASE_ADMIN_SA_JSON` - service-account JSON (single line). Generate via **Console → Project settings → Service accounts → Generate new private key**.
- `AGENT_CRON_SECRET` - `openssl rand -hex 32`.
- `GEMINI_API_KEY` - https://aistudio.google.com/api-keys.
- `ANTHROPIC_API_KEY` - https://console.anthropic.com/settings/keys (optional fallback).
- `SENTRY_DSN` - https://sentry.io project DSN (optional, agents work without it).
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `_APP_ID`, `_MESSAGING_SENDER_ID` - **Console → Project settings → Web app config**.

Verify: `gcloud secrets list --project timbl-prod` shows every secret with a version.

## 5. Deploy functions

```bash
pnpm functions:build
firebase deploy --only functions
```

`beforeUserSignedIn` must be live **before** the first real sign-in or the user's account will be created without claims and the app will reject them.

`agentSweep` is the Cloud Scheduler-backed sweep that replaces `scripts/agent-cron.mjs` in production. After deploy, set the `APP_BASE_URL` param to your App Hosting URL:

```bash
firebase functions:params:set APP_BASE_URL --value "https://<backend-id>--timbl-prod.<region>.hosted.app"
firebase deploy --only functions:agentSweep
```

### 5a. Grant the function runtime SA Firestore read

The functions deploy onto the default compute SA (`{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`). Since 2024, Google strips Editor role from new default compute SAs - so `agentSweep` will spam `PERMISSION_DENIED: Missing or insufficient permissions` on every minute tick because its `db.collection("organizations").get()` lacks `datastore.entities.get`. Grant the minimal role explicitly:

```bash
PROJECT_NUMBER=$(gcloud projects describe timbl-prod --format='value(projectNumber)')
gcloud projects add-iam-policy-binding timbl-prod \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.viewer" \
  --condition=None
```

Verify: within ~2 min, `firebase functions:log --only agentSweep --limit 5` shows `[agentSweep] tick` info lines instead of the PERMISSION_DENIED traceback.

## 6. Create the App Hosting backend

GitHub remote: `https://github.com/studiokataco/Timbl.git` (branch `main`).

Prereq - make sure the latest local work is pushed:

```bash
git status                                # confirm a clean tree (or commit phase 7 first)
git push origin main
```

In **Firebase Console → App Hosting**:

1. Create a backend named `timbl-backend`.
2. Connect the GitHub repo (`studiokataco/Timbl`). Authorise the Firebase GitHub app on first connect.
3. Live branch: `main`. Root: `/`. The `apphosting.yaml` at the repo root is the manifest.
4. Build trigger: rollout on every push to `main`.
5. After the first build kicks off, copy the generated URL - update `APP_BASE_URL` (step 5) and Firebase Auth's authorized domains (Console → Authentication → Settings → Authorized domains).

Verify: `firebase apphosting:backends:list --project timbl-prod` shows the backend as `ACTIVE`.

Manual rollouts (when needed):

```bash
firebase apphosting:rollouts:create timbl-backend --git-branch main --project timbl-prod
```

## 7. First sign-in smoke

1. Visit the App Hosting URL → redirected to `/login`.
2. Click **Continue with Google**.
3. Sign in with `@kataco.in`. Should land on `/calendar`.
4. Sign out via `/auth/logout`. Sign in with `@gmail.com` → blocked with "Your account isn't authorised…".

## 8. Verification matrix

```bash
# Rules tests against emulator (catch regressions locally before deploys)
pnpm test:rules

# Lighthouse against the deployed URL
npx -y lighthouse https://<your-backend-url> --view

# Functions logs
firebase functions:log --limit 20
```

Expectations:
- Rules tests: all green.
- Lighthouse: Performance ≥ 90, Accessibility ≥ 95.
- Logs: `beforeUserSignedIn` runs on every sign-in. `agentSweep` runs every minute and reports `evaluated > 0` once at least one agent is configured with a cron schedule.

## 9. Rollback

### App Hosting (frontend)

App Hosting keeps every prior build. To revert the web app:

1. **Firebase Console** → App Hosting → `timbl-backend` → Builds → select the previous good build → **Promote to live**.
2. Or CLI: `firebase apphosting:rollouts:create timbl-backend --git-branch main --project timbl-prod` (only when you want a fresh build from a known-good commit on `main`).

Auth, Functions, and Firestore are independent of App Hosting - reverting the frontend does not undo rules, indexes, or backend config.

### Realtime cutover (no redeploy)

Realtime is additive - surfaces always render from server-fetched data. To roll back live sync without a deploy:

1. **Per-org kill switch (fastest):** Control centre → tenant → flip `realtime_v1` **OFF** for the affected org. Takes effect on the next page load.
2. **Global default:** Control centre → Dashboard → **Global realtime default** → **Turn OFF**. New orgs and orgs without an explicit `realtime_v1` override stop engaging the client listener.
3. **Env fallback (requires App Hosting rollout):** Set `NEXT_PUBLIC_REALTIME_DEFAULT=0` in `apphosting.yaml` and promote a new build. Use only when the platform doc toggle is unavailable.

After rollback, the app continues on 60s polling fallback. Users may see the **Live sync paused** badge in the top bar until the listener stops retrying.

Verify rollback:

- Two browser tabs on the affected org: edits still converge within ~60s (polling), not instantly.
- Control centre → Live ops → **Realtime health** shows degrade pings if listeners were active when you flipped the flag.
- `pnpm test:rules` locally still passes (rules are unchanged).

### Firestore rules / indexes

```bash
# Restore a prior rules revision from git, then:
firebase deploy --only firestore:rules --project timbl-prod

# Indexes are forward-only; deleting an index in-console does not roll back code.
firebase deploy --only firestore:indexes --project timbl-prod
```

Keep the last known-good `firestore/firestore.rules` commit hash in your deploy notes before any rules change.

### Cloud Functions

```bash
firebase functions:rollback --project timbl-prod
```

Or pick a prior revision in **Firebase Console → Functions**.

### Platform admin repairs (auth claims)

If login breaks after a rules or claims change:

1. Control centre → **Users** → look up the operator email.
2. **Re-mint claims** (owner only). Audit row should appear under Recent audit.
3. User signs out and back in.

### Canary soak before GA (T39-T40)

- Run canary with `realtime_v1` ON for one internal org only (T33).
- Complete T34-T38 checklist on timbl.app (live update, failure injection, auth dead-ends, admin repair drill, flag OFF rollback).
- Wait 24-48h, then expand to friendly orgs (T39) before flipping global default ON (T40).

### Realtime cutover rollback (no redeploy)

Realtime is additive - surfaces always render from server-fetched data. If live sync misbehaves after enabling `realtime_v1`:

1. **Per-org kill switch (fastest):** In admin.timbl → tenant → Feature flags → disable **Realtime v1** for the affected org. No App Hosting redeploy.
2. **Global default OFF:** Control centre → Overview → Global realtime default → Turn OFF. New orgs and orgs without an explicit override stop engaging the client listener.
3. **Verify degrade path:** Affected users should see the **Live sync paused** badge and 60s polling fallback; Live ops → Realtime health shows recent degrade events.
4. **Rules rollback (only if rules changed):** `firebase deploy --only firestore:rules --project timbl-prod` from the last known-good commit.
5. **Full app rollback:** Promote the previous App Hosting build (step above). Polling-only mode remains safe even on an older build.

Soak 24-48h after re-enabling before expanding to more orgs.
