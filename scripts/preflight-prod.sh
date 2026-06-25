#!/usr/bin/env bash
# Read-only Phase 7 go-live pre-flight for timbl-prod.
# Verifies the things that silently brick a cutover: missing GSM secrets,
# disabled auth providers, unlisted authorized domains, unsafe email mode.
# Makes NO changes - every call is a GET / list / describe.
#
#   pnpm preflight:prod        # or: bash scripts/preflight-prod.sh
#   GCP_PROJECT=timbl-staging bash scripts/preflight-prod.sh
set -uo pipefail

PROJECT="${GCP_PROJECT:-timbl-prod}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPHOSTING="${ROOT}/apphosting.yaml"
HOSTS=("timbl.app" "www.timbl.app" "admin.timbl.app")

PASS=0; FAIL=0; WARN=0
ok()   { echo "  [ok]   $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
warn() { echo "  [warn] $1"; WARN=$((WARN+1)); }
manual(){ echo "  [todo] $1"; }

echo "==> Pre-flight for project: ${PROJECT}"
echo ""

# --- Tooling ---------------------------------------------------------------
command -v gcloud  >/dev/null 2>&1 || { echo "gcloud not found - install Cloud SDK and 'gcloud auth login'." >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "python3 not found." >&2; exit 2; }

TOKEN="$(gcloud auth print-access-token --project="${PROJECT}" 2>/dev/null || true)"
if [ -z "${TOKEN}" ]; then
  echo "Could not get an access token. Run: gcloud auth login --update-adc" >&2
  exit 2
fi

# --- 1. GSM secrets referenced by apphosting.yaml --------------------------
echo "1) Secrets in Google Secret Manager (referenced by apphosting.yaml)"
if [ ! -f "${APPHOSTING}" ]; then
  bad "apphosting.yaml not found at ${APPHOSTING}"
else
  # Strip commented-out lines first so disabled (#-prefixed) secret refs aren't checked.
  SECRETS="$(grep -vE '^[[:space:]]*#' "${APPHOSTING}" | grep -oE 'secret:[[:space:]]*[A-Za-z0-9_]+' | awk '{print $2}' | sort -u)"
  for name in ${SECRETS}; do
    enabled="$(gcloud secrets versions list "${name}" --project="${PROJECT}" \
      --filter='state:enabled' --format='value(name)' 2>/dev/null | head -n1)"
    if [ -n "${enabled}" ]; then ok "${name} (enabled version present)"; else bad "${name} (missing or no enabled version)"; fi
  done
fi
echo ""

# --- 2. Identity Platform config (auth providers + authorized domains) -----
echo "2) Firebase Auth (Identity Platform) config"
CONFIG_URL="https://identitytoolkit.googleapis.com/v2/projects/${PROJECT}/config"
GOOGLE_IDP_URL="https://identitytoolkit.googleapis.com/v2/projects/${PROJECT}/defaultSupportedIdpConfigs/google.com"
CFG="$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-goog-user-project: ${PROJECT}" "${CONFIG_URL}" 2>/dev/null)"

if echo "${CFG}" | grep -q '"error"'; then
  bad "could not read Identity Platform config (check IAM / API enabled)"
else
  email_enabled="$(echo "${CFG}" | python3 -c "import json,sys;d=json.load(sys.stdin);print(str((d.get('signIn',{}).get('email',{}) or {}).get('enabled', False)))" 2>/dev/null)"
  [ "${email_enabled}" = "True" ] && ok "Email/password provider enabled" || bad "Email/password provider disabled"

  google_enabled="$(curl -sS -H "Authorization: Bearer ${TOKEN}" -H "x-goog-user-project: ${PROJECT}" "${GOOGLE_IDP_URL}" 2>/dev/null \
    | python3 -c "import json,sys;d=json.load(sys.stdin);print(str(d.get('enabled', False)))" 2>/dev/null)"
  [ "${google_enabled}" = "True" ] && ok "Google provider enabled" || bad "Google provider disabled"

  DOMAINS="$(echo "${CFG}" | python3 -c "import json,sys;d=json.load(sys.stdin);[print(x) for x in (d.get('authorizedDomains') or [])]" 2>/dev/null)"
  for host in "${HOSTS[@]}"; do
    echo "${DOMAINS}" | grep -qx "${host}" && ok "Authorized domain: ${host}" || bad "Authorized domain missing: ${host}"
  done
fi
echo ""

# --- 3. Email safety -------------------------------------------------------
echo "3) Outbound email safety"
TESTMODE="$(grep -A1 'variable: RESEND_TEST_MODE' "${APPHOSTING}" 2>/dev/null | grep -oE 'value:[[:space:]]*\"?[A-Za-z0-9]+' | awk -F'[:[:space:]\"]+' '{print $NF}')"
if [ -z "${TESTMODE}" ]; then
  warn "RESEND_TEST_MODE not pinned in apphosting.yaml - confirm real sends are intended before GA"
elif [ "${TESTMODE}" = "true" ]; then
  warn "RESEND_TEST_MODE=true - invite/verification emails are sandboxed (fine for canary, flip for GA)"
else
  ok "RESEND_TEST_MODE=${TESTMODE}"
fi
echo ""

# --- 4. Manual / CLI follow-ups (not auto-verifiable) ----------------------
echo "4) Manual / deploy follow-ups"
manual "Rules deployed:   firebase deploy --only firestore:rules    --project ${PROJECT}"
manual "Indexes deployed: firebase deploy --only firestore:indexes  --project ${PROJECT}"
manual "OAuth redirect URIs registered on the Google web client (see scripts/configure-auth-domain.sh output)"
manual "At least one org + member seeded so first login resolves an organizationId claim"
echo ""

echo "==> Summary: ${PASS} ok, ${WARN} warn, ${FAIL} fail"
[ "${FAIL}" -eq 0 ] || { echo "Pre-flight FAILED - resolve the failures above before opening traffic." >&2; exit 1; }
echo "Pre-flight passed (review warnings + manual follow-ups before GA)."
