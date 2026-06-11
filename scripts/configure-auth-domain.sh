#!/usr/bin/env bash
set -euo pipefail

PROJECT="${GCP_PROJECT:-timbl-prod}"
APP_HOST="${APP_HOST:-timbl.app}"
WWW_HOST="${WWW_HOST:-www.timbl.app}"
ADMIN_HOST="${ADMIN_HOST:-admin.timbl.app}"
REDIRECT_URI="https://${APP_HOST}/__/auth/handler"
ORIGIN_URI="https://${APP_HOST}"
WWW_REDIRECT_URI="https://${WWW_HOST}/__/auth/handler"
WWW_ORIGIN_URI="https://${WWW_HOST}"
ADMIN_REDIRECT_URI="https://${ADMIN_HOST}/__/auth/handler"
ADMIN_ORIGIN_URI="https://${ADMIN_HOST}"

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

for host in "${APP_HOST}" "${WWW_HOST}" "${ADMIN_HOST}"; do
  if echo "${domains}" | grep -qx "${host}"; then
    echo "[ok] Authorized domain already present: ${host}"
  else
    echo "==> Adding authorized domain ${host}"
    payload="$(echo "${current}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
host = sys.argv[1]
domains = list(d.get('authorizedDomains') or [])
if host not in domains:
    domains.append(host)
print(json.dumps({'authorizedDomains': domains}))
" "${host}")"
    current="$(curl -sS -X PATCH "${CONFIG_URL}?updateMask=authorizedDomains" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "x-goog-user-project: ${PROJECT}" \
      -H "Content-Type: application/json" \
      -d "${payload}")"
    echo "${current}" | python3 -m json.tool
    domains="$(echo "${current}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for x in sorted(set(d.get('authorizedDomains') or [])):
    print(x)
")"
    echo "[done] Authorized domain updated: ${host}"
  fi
done

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
echo "    Add ALL of these on the OAuth client, then Save:"
echo "      Authorized JavaScript origins:"
echo "        ${ORIGIN_URI}"
echo "        ${WWW_ORIGIN_URI}"
echo "        ${ADMIN_ORIGIN_URI}"
echo "      Authorized redirect URIs:"
echo "        ${REDIRECT_URI}"
echo "        ${WWW_REDIRECT_URI}"
echo "        ${ADMIN_REDIRECT_URI}"
echo ""
echo "    Open: ${CONSOLE_URL}"

