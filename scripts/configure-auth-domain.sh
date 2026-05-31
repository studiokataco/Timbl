#!/usr/bin/env bash
set -euo pipefail

PROJECT="${GCP_PROJECT:-sm-dashboard-e7641}"
APP_HOST="${APP_HOST:-safe-planner--sm-dashboard-e7641.asia-east1.hosted.app}"
REDIRECT_URI="https://${APP_HOST}/__/auth/handler"
ORIGIN_URI="https://${APP_HOST}"

echo "==> Project: ${PROJECT}"
echo "==> App host (authDomain): ${APP_HOST}"
echo "==> OAuth redirect URI: ${REDIRECT_URI}"
echo ""

TOKEN="$(gcloud auth print-access-token --project="${PROJECT}")"
CONFIG_URL="https://identitytoolkit.googleapis.com/v2/projects/${PROJECT}/config"
IDP_URL="https://identitytoolkit.googleapis.com/v2/projects/${PROJECT}/defaultSupportedIdpConfigs/google.com"

current="$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-goog-user-project: ${PROJECT}" "${CONFIG_URL}")"
if echo "${current}" | grep -q '"code":'; then
  echo "${current}" | python3 -m json.tool
  echo "Failed to read Identity Toolkit config. Run: gcloud auth login" >&2
  exit 1
fi

domains="$(echo "${current}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for x in sorted(set(d.get('authorizedDomains') or [])):
    print(x)
")"

if echo "${domains}" | grep -qx "${APP_HOST}"; then
  echo "[ok] Authorized domain already present: ${APP_HOST}"
else
  echo "==> Adding authorized domain ${APP_HOST}"
  payload="$(echo "${current}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
host = sys.argv[1]
domains = list(d.get('authorizedDomains') or [])
if host not in domains:
    domains.append(host)
print(json.dumps({'authorizedDomains': domains}))
" "${APP_HOST}")"
  curl -sS -X PATCH "${CONFIG_URL}?updateMask=authorizedDomains" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "x-goog-user-project: ${PROJECT}" \
    -H "Content-Type: application/json" \
    -d "${payload}" | python3 -m json.tool
  echo "[done] Authorized domain updated"
fi

OAUTH_CLIENT_ID="$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-goog-user-project: ${PROJECT}" "${IDP_URL}" \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('clientId',''))")"

if [ -z "${OAUTH_CLIENT_ID}" ]; then
  echo "Could not read Google OAuth client id from Identity Toolkit." >&2
  exit 1
fi

echo ""
echo "[info] Google OAuth web client: ${OAUTH_CLIENT_ID}"
CONSOLE_URL="https://console.cloud.google.com/auth/clients/${OAUTH_CLIENT_ID}?project=${PROJECT}"

echo ""
echo "==> GCP Console (redirect_uri_mismatch fix)"
echo "    Add BOTH of these on the OAuth client, then Save:"
echo "      Authorized JavaScript origins: ${ORIGIN_URI}"
echo "      Authorized redirect URIs:       ${REDIRECT_URI}"
echo ""
echo "    Open: ${CONSOLE_URL}"

