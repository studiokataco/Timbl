#!/usr/bin/env bash
set -euo pipefail

# Bootstraps Google Secret Manager for the SAFE social planner. Idempotent:
# safe to re-run. Reads the secret values from the existing local .env.local
# when present, or prompts interactively.
#
# Required gcloud auth:  gcloud auth login && gcloud config set project sm-dashboard-e7641

PROJECT="${GCP_PROJECT:-sm-dashboard-e7641}"
APPHOSTING_SA="firebase-app-hosting-compute@${PROJECT}.iam.gserviceaccount.com"

SECRETS=(
  "AGENT_CRON_SECRET"
  "GEMINI_API_KEY"
  "ANTHROPIC_API_KEY"
  "SENTRY_DSN"
  "NEXT_PUBLIC_FIREBASE_API_KEY"
  "NEXT_PUBLIC_FIREBASE_APP_ID"
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
)

echo "==> Bootstrapping secrets for project ${PROJECT}"
echo "==> Granting access to ${APPHOSTING_SA}"

ensure_secret() {
  local name="$1"
  if gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    echo "    [exists] $name"
  else
    echo "    [create] $name"
    gcloud secrets create "$name" \
      --project="$PROJECT" \
      --replication-policy="automatic"
  fi
}

prompt_and_add_version() {
  local name="$1"
  read -rsp "    value for ${name} (empty to skip): " value
  echo
  if [ -z "$value" ]; then
    echo "    [skip ] $name (no value entered)"
    return
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" \
    --project="$PROJECT" \
    --data-file=-
  echo "    [v++  ] $name"
}

grant_access() {
  local name="$1"
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${APPHOSTING_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

for secret in "${SECRETS[@]}"; do
  ensure_secret "$secret"
  grant_access "$secret"
done

echo
echo "All secrets exist and the App Hosting SA has access."
read -rp "Add new versions interactively now? [y/N] " add_now
if [[ "$add_now" =~ ^[Yy] ]]; then
  for secret in "${SECRETS[@]}"; do
    prompt_and_add_version "$secret"
  done
fi

echo
echo "Done. Verify with:  gcloud secrets list --project=${PROJECT}"
