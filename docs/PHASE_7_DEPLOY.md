# Phase 7 — production deploy runbook

> **Status (2026-05-17):** Phase 7 is **complete**. The `sm-dashboard-e7641` project is live with Google SSO, Firestore, Functions (`asia-south1`), and App Hosting. This doc is now reference material — a runbook for bootstrapping a new prod project from scratch or rebuilding the deploy from a clean slate. No outstanding action items.

This is the live runbook for taking the planner from emulator-only to a real Firebase deployment on the `sm-dashboard-e7641` project. Do it in this order — every step has a verification check before the next one runs.

## 0. Local prerequisites

```bash
gcloud auth login
gcloud config set project sm-dashboard-e7641
gcloud auth application-default login   # for Admin SDK local fallback

firebase login
firebase use prod                       # switches the CLI to sm-dashboard-e7641
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
  --project sm-dashboard-e7641
```

## 2. Enable Google Sign-in

In **Firebase Console → Authentication → Sign-in method**:

1. Enable Google as a provider.
2. Set the support email.
3. In **Authentication → Settings → Authorized domains**, ensure the App Hosting domain and `localhost` are listed (default is fine).

The blocking trigger that restricts to `@safefoundation.org.uk` and `@kataco.in` lives in `functions/src/setUserClaims.ts` — it deploys with the rest of the functions in step 5.

## 3. Provision Firestore + Storage

```bash
# First time only. Pick a region close to users (eur3 for SAFE).
firebase firestore:databases:create '(default)' --location=eur3
gcloud storage buckets create gs://sm-dashboard-e7641.firebasestorage.app --location=eur3 --project sm-dashboard-e7641 || true
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

- `FIREBASE_ADMIN_SA_JSON` — service-account JSON (single line). Generate via **Console → Project settings → Service accounts → Generate new private key**.
- `AGENT_CRON_SECRET` — `openssl rand -hex 32`.
- `GEMINI_API_KEY` — https://aistudio.google.com/api-keys.
- `ANTHROPIC_API_KEY` — https://console.anthropic.com/settings/keys (optional fallback).
- `SENTRY_DSN` — https://sentry.io project DSN (optional, agents work without it).
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `_APP_ID`, `_MESSAGING_SENDER_ID` — **Console → Project settings → Web app config**.

Verify: `gcloud secrets list --project sm-dashboard-e7641` shows every secret with a version.

## 5. Deploy functions

```bash
pnpm functions:build
firebase deploy --only functions
```

`beforeUserSignedIn` must be live **before** the first real sign-in or the user's account will be created without claims and the app will reject them.

`agentSweep` is the Cloud Scheduler-backed sweep that replaces `scripts/agent-cron.mjs` in production. After deploy, set the `APP_BASE_URL` param to your App Hosting URL:

```bash
firebase functions:params:set APP_BASE_URL --value "https://<backend-id>--sm-dashboard-e7641.<region>.hosted.app"
firebase deploy --only functions:agentSweep
```

### 5a. Grant the function runtime SA Firestore read

The functions deploy onto the default compute SA (`{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`). Since 2024, Google strips Editor role from new default compute SAs — so `agentSweep` will spam `PERMISSION_DENIED: Missing or insufficient permissions` on every minute tick because its `db.collection("organizations").get()` lacks `datastore.entities.get`. Grant the minimal role explicitly:

```bash
PROJECT_NUMBER=$(gcloud projects describe sm-dashboard-e7641 --format='value(projectNumber)')
gcloud projects add-iam-policy-binding sm-dashboard-e7641 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.viewer" \
  --condition=None
```

Verify: within ~2 min, `firebase functions:log --only agentSweep --limit 5` shows `[agentSweep] tick` info lines instead of the PERMISSION_DENIED traceback.

## 6. Create the App Hosting backend

GitHub remote: `https://github.com/studiokataco/SAFE.git` (branch `main`).

Prereq — make sure the latest local work is pushed:

```bash
git status                                # confirm a clean tree (or commit phase 7 first)
git push origin main
```

In **Firebase Console → App Hosting**:

1. Create a backend named `safe-planner`.
2. Connect the GitHub repo (`studiokataco/SAFE`). Authorise the Firebase GitHub app on first connect.
3. Live branch: `main`. Root: `/`. The `apphosting.yaml` at the repo root is the manifest.
4. Build trigger: rollout on every push to `main`.
5. After the first build kicks off, copy the generated URL — update `APP_BASE_URL` (step 5) and Firebase Auth's authorized domains (Console → Authentication → Settings → Authorized domains).

Verify: `firebase apphosting:backends:list --project sm-dashboard-e7641` shows the backend as `ACTIVE`.

Manual rollouts (when needed):

```bash
firebase apphosting:rollouts:create safe-planner --git-branch main --project sm-dashboard-e7641
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

App Hosting keeps every prior build. To revert: **App Hosting → safe-planner → Builds → previous build → Promote to live**. Auth, Functions, and Rules are independent; revert each via `firebase functions:rollback` or the console.
