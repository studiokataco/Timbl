#!/usr/bin/env bash
set -euo pipefail

PROJECT="${GCP_PROJECT:-timbl-prod}"
BACKEND="${APP_HOSTING_BACKEND:-timbl-backend}"
REGION="${APP_HOSTING_REGION:-asia-southeast1}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${CUTOVER_ENV_FILE:-${ROOT_DIR}/.env.local}"

if [ ! -f "${ROOT_DIR}/package.json" ]; then
  echo "No package.json in ${ROOT_DIR}"
  echo "Run: bash ${ROOT_DIR}/scripts/cutover-timbl-prod.sh"
  exit 1
fi

require_auth() {
  if ! firebase projects:list --project "$PROJECT" >/dev/null 2>&1; then
    echo "Firebase CLI auth expired. Run:"
    echo "  firebase login --reauth"
    echo "  gcloud auth login"
    exit 1
  fi
}

set_secret() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    echo "    [skip ] $name (empty)"
    return
  fi
  printf '%s' "$value" | firebase apphosting:secrets:set "$name" \
    --project "$PROJECT" --data-file - --force
  echo "    [set  ] $name"
}

read_env() {
  local key="$1"
  if [ ! -f "$ENV_FILE" ]; then
    return
  fi
  grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$/\1/"
}

sdk_value() {
  local field="$1"
  echo "$SDK_CONFIG" | python3 -c "
import sys, re
text = sys.stdin.read()
m = re.search(r'${field}:\\s*[\"\\']([^\"\\']+)[\"\\']', text)
print(m.group(1) if m else '')
"
}

echo "==> Timbl prod cutover (${PROJECT} / ${BACKEND})"
require_auth

echo "==> Ensuring Secret Manager shells + IAM (bootstrap-secrets.sh)"
GCP_PROJECT="$PROJECT" bash "${ROOT_DIR}/scripts/bootstrap-secrets.sh" <<< "n"

echo "==> Firebase web SDK config -> App Hosting secrets"
SDK_CONFIG="$(firebase apps:sdkconfig WEB --project "$PROJECT")"
set_secret NEXT_PUBLIC_FIREBASE_API_KEY "$(sdk_value apiKey)"
set_secret NEXT_PUBLIC_FIREBASE_APP_ID "$(sdk_value appId)"
set_secret NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID "$(sdk_value messagingSenderId)"

if [ -f "$ENV_FILE" ]; then
  echo "==> Optional secrets from ${ENV_FILE}"
  set_secret GEMINI_API_KEY "$(read_env GEMINI_API_KEY)"
  set_secret ANTHROPIC_API_KEY "$(read_env ANTHROPIC_API_KEY)"
  set_secret OPENROUTER_API_KEY "$(read_env OPENROUTER_API_KEY)"
  set_secret RESEND_API_KEY "$(read_env RESEND_API_KEY)"
  set_secret NEXT_PUBLIC_POSTHOG_KEY "$(read_env NEXT_PUBLIC_POSTHOG_KEY)"
  set_secret SOCIAL_TOKEN_KEY "$(read_env SOCIAL_TOKEN_KEY)"
  set_secret AGENT_CRON_SECRET "$(read_env AGENT_CRON_SECRET)"
  set_secret PUBLISH_SWEEP_SECRET "$(read_env PUBLISH_SWEEP_SECRET)"
else
  echo "==> No ${ENV_FILE} - set API keys manually:"
  echo "    printf '%s' \"\$KEY\" | firebase apphosting:secrets:set GEMINI_API_KEY --project ${PROJECT} --data-file - --force"
fi

echo "==> App Hosting backend"
if firebase apphosting:backends:get "$BACKEND" --project "$PROJECT" >/dev/null 2>&1; then
  echo "    [exists] ${BACKEND}"
else
  APP_ID="$(firebase apps:list WEB --project "$PROJECT" --json | python3 -c "
import json, sys
apps = json.load(sys.stdin).get('result', [])
print(apps[0]['appId'] if apps else '')
")"
  if [ -z "$APP_ID" ]; then
    echo "No WEB app on ${PROJECT}. Create one in Firebase Console first."
    exit 1
  fi
  firebase apphosting:backends:create \
    --project "$PROJECT" \
    --non-interactive \
    --backend "$BACKEND" \
    --primary-region "$REGION" \
    --app "$APP_ID" \
    --root-dir /
  echo "    [create] ${BACKEND}"
fi

echo "==> Deploy App Hosting"
cd "$ROOT_DIR"
firebase deploy --only apphosting --project "$PROJECT"

echo "==> Backend URL (smoke test before DNS)"
firebase apphosting:backends:get "$BACKEND" --project "$PROJECT"

echo "==> Auth authorized domains"
GCP_PROJECT="$PROJECT" bash "${ROOT_DIR}/scripts/configure-auth-domain.sh"

cat <<EOF

==> DNS cutover (manual, after smoke test passes)
1. Firebase Console -> App Hosting -> ${BACKEND} -> Domains
2. Add timbl.app and admin.timbl.app (remove from sm-dashboard backend first if attached)
3. Copy the A + TXT records Firebase shows for admin.timbl.app into your registrar
4. Apex timbl.app may already point correctly; confirm records match the new backend
5. When both hosts are ACTIVE, smoke test https://timbl.app and https://admin.timbl.app

EOF
