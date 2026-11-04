#!/usr/bin/env bash
set -euo pipefail

# Rotate one Secret Manager value (e.g. after revoking a Resend API key).
# Does NOT print the secret. Updates GSM "latest" and optionally .env.local.
#
# Usage:
#   ./scripts/rotate-secret.sh RESEND_API_KEY
#   ./scripts/rotate-secret.sh RESEND_API_KEY --env-local

PROJECT="${GCP_PROJECT:-timbl-prod}"
SECRET_NAME="${1:-}"
UPDATE_ENV_LOCAL="${2:-}"

if [[ -z "$SECRET_NAME" ]]; then
  echo "Usage: $0 SECRET_NAME [--env-local]"
  echo "Example: $0 RESEND_API_KEY --env-local"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Secret ${SECRET_NAME} does not exist in ${PROJECT}. Run: pnpm secrets:bootstrap"
  exit 1
fi

echo "Paste the NEW value for ${SECRET_NAME} (from Resend dashboard, etc.)."
echo "Create the new key in Resend FIRST, then paste here. Old Resend keys stop working when deleted."
read -rsp "New value: " NEW_VALUE
echo
if [[ -z "$NEW_VALUE" ]]; then
  echo "Aborted (empty value)."
  exit 1
fi

NEW_VERSION="$(printf '%s' "$NEW_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
  --project="$PROJECT" \
  --data-file=- \
  --format='value(name)')"
NEW_VERSION="${NEW_VERSION##*/}"
echo "GSM: added version ${NEW_VERSION} (latest) for ${SECRET_NAME}"

if [[ "$UPDATE_ENV_LOCAL" == "--env-local" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "No .env.local found at ${ENV_FILE} - add ${SECRET_NAME}=... yourself for local dev."
  else
    if grep -q "^${SECRET_NAME}=" "$ENV_FILE"; then
      # macOS/BSD sed: use a temp file
      sed "s|^${SECRET_NAME}=.*|${SECRET_NAME}=${NEW_VALUE}|" "$ENV_FILE" > "${ENV_FILE}.tmp"
      mv "${ENV_FILE}.tmp" "$ENV_FILE"
      echo "Updated ${ENV_FILE}"
    else
      echo "${SECRET_NAME}=${NEW_VALUE}" >> "$ENV_FILE"
      echo "Appended ${SECRET_NAME} to ${ENV_FILE}"
    fi
    echo "Restart pnpm dev if it is running."
  fi
fi

"${ROOT}/scripts/sync-secret-consumers.sh" "$SECRET_NAME"

echo ""
echo "Rotation complete: GSM version added, consumers moved to v${NEW_VERSION}."
