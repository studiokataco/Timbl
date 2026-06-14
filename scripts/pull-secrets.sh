#!/usr/bin/env bash
# Pull all GSM secrets into .env.local for local dev.
# Run after rotating keys or on a fresh clone: pnpm secrets:pull
set -euo pipefail

PROJECT="${GCP_PROJECT:-timbl-prod}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/.env.local"

SECRETS=(
  GEMINI_API_KEY
  ANTHROPIC_API_KEY
  OPENROUTER_API_KEY
  RESEND_API_KEY
  NEXT_PUBLIC_POSTHOG_KEY
  SOCIAL_TOKEN_KEY
  AGENT_CRON_SECRET
  PUBLISH_SWEEP_SECRET
)

echo "# Auto-generated from GSM (timbl-prod) - do not commit" > "$OUT"
echo "# Source of truth: Google Secret Manager. Regenerate with: pnpm secrets:pull" >> "$OUT"
echo "" >> "$OUT"

echo "# --- Local dev (emulator) defaults ---" >> "$OUT"
echo "NEXT_PUBLIC_FIREBASE_PROJECT_ID=timbl-dev" >> "$OUT"
echo "NEXT_PUBLIC_ADMIN_HOST=admin.localhost:3000" >> "$OUT"
echo "PLATFORM_ADMIN_DEV=1" >> "$OUT"
echo "APP_BASE_URL=http://localhost:3000" >> "$OUT"
echo "RESEND_TEST_MODE=1" >> "$OUT"
echo "" >> "$OUT"

echo "# --- Server keys (pulled from GSM) ---" >> "$OUT"

for secret in "${SECRETS[@]}"; do
  value="$(gcloud secrets versions access latest \
    --secret="$secret" \
    --project="$PROJECT" 2>/dev/null || echo "")"
  if [[ -z "$value" ]]; then
    echo "[warn] $secret not found in GSM - skipping"
    continue
  fi
  echo "${secret}=${value}" >> "$OUT"
  echo "[ok  ] $secret"
done

echo ""
echo "Written to ${OUT}"
echo "Restart pnpm dev if it is running."
