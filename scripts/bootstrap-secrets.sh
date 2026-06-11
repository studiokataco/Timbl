#!/usr/bin/env bash
set -euo pipefail

PROJECT="${GCP_PROJECT:-timbl-prod}"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
COMPUTE_SA="firebase-app-hosting-compute@${PROJECT}.iam.gserviceaccount.com"
COMPUTE_DEV_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
HOSTING_AGENT_SA="service-${PROJECT_NUMBER}@gcp-sa-firebaseapphosting.iam.gserviceaccount.com"

SECRETS=(
  "AGENT_CRON_SECRET"
  "PUBLISH_SWEEP_SECRET"
  "GEMINI_API_KEY"
  "ANTHROPIC_API_KEY"
  "OPENROUTER_API_KEY"
  "RESEND_API_KEY"
  "SOCIAL_TOKEN_KEY"
  "NEXT_PUBLIC_POSTHOG_KEY"
  "NEXT_PUBLIC_FIREBASE_API_KEY"
  "NEXT_PUBLIC_FIREBASE_APP_ID"
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
)

echo "==> Bootstrapping secrets for project ${PROJECT}"
echo "==> Granting access to ${COMPUTE_SA}, ${COMPUTE_DEV_SA}, and ${HOSTING_AGENT_SA}"

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
  local member="$2"
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${member}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

grant_apphosting_secret() {
  local name="$1"
  grant_access "$name" "$COMPUTE_SA"
  grant_access "$name" "$COMPUTE_DEV_SA"
  grant_access "$name" "$HOSTING_AGENT_SA"
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/secretmanager.viewer" \
    --quiet >/dev/null
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null 2>&1 || true
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${HOSTING_AGENT_SA}" \
    --role="roles/secretmanager.secretVersionManager" \
    --quiet >/dev/null 2>&1 || true
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/secretmanager.viewer" \
    --quiet >/dev/null 2>&1 || true
}

for secret in "${SECRETS[@]}"; do
  ensure_secret "$secret"
  grant_apphosting_secret "$secret"
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
