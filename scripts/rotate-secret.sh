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

# Cloud Functions pin the secret version that was "latest" at deploy time -
# rotating GSM alone strands them on the old value and they fail auth until
# redeployed. Patch every function that consumes this secret to the new
# version (a secret-only patch rolls a new revision without rebuilding).
echo "Checking Cloud Functions for ${SECRET_NAME} consumers..."
TOKEN="$(gcloud auth print-access-token)" \
  SECRET_NAME="$SECRET_NAME" NEW_VERSION="$NEW_VERSION" PROJECT="$PROJECT" \
  python3 - <<'PYEOF'
import json, os, time, urllib.request

project = os.environ["PROJECT"]
secret = os.environ["SECRET_NAME"]
version = os.environ["NEW_VERSION"]
headers = {
    "Authorization": f"Bearer {os.environ['TOKEN']}",
    "Content-Type": "application/json",
}
base = "https://cloudfunctions.googleapis.com/v2"

def call(url, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as res:
        return json.load(res)

fns = call(f"{base}/projects/{project}/locations/-/functions").get("functions", [])
targets = [
    fn for fn in fns
    if any(s.get("secret") == secret
           for s in fn.get("serviceConfig", {}).get("secretEnvironmentVariables", []))
]
if not targets:
    print(f"No Cloud Functions consume {secret} - nothing to patch.")
    raise SystemExit(0)

for fn in targets:
    name = fn["name"]
    envs = fn["serviceConfig"]["secretEnvironmentVariables"]
    for s in envs:
        if s.get("secret") == secret:
            s["version"] = version
    call(f"{base}/{name}?updateMask=serviceConfig.secretEnvironmentVariables",
         method="PATCH", body={"serviceConfig": {"secretEnvironmentVariables": envs}})
    print(f"Patching {name.split('/')[-1]} -> {secret} v{version}")

deadline = time.time() + 300
pending = {fn["name"] for fn in targets}
while pending and time.time() < deadline:
    time.sleep(10)
    for name in list(pending):
        state = call(f"{base}/{name}").get("state")
        if state == "ACTIVE":
            print(f"{name.split('/')[-1]}: ACTIVE on v{version}")
            pending.discard(name)
        elif state not in ("DEPLOYING", None):
            print(f"{name.split('/')[-1]}: {state} - check the Cloud Console")
            pending.discard(name)
if pending:
    short = ", ".join(n.split("/")[-1] for n in pending)
    print(f"Still deploying after 5m: {short} - verify before trusting the rotation.")
    raise SystemExit(1)
PYEOF

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

# App Hosting resolves secret bindings at rollout time, so a backend keeps
# serving the old value until a new rollout. If apphosting.yaml binds this
# secret, roll out every backend now (build from the deploy branch's HEAD -
# same thing a push to main would do).
if grep -q "secret: *${SECRET_NAME}\$" "${ROOT}/apphosting.yaml" 2>/dev/null; then
  echo "apphosting.yaml binds ${SECRET_NAME} - rolling out App Hosting backends..."
  TOKEN="$(gcloud auth print-access-token)" \
    PROJECT="$PROJECT" BRANCH="${APP_BRANCH:-main}" SECRET_NAME="$SECRET_NAME" \
    python3 - <<'PYEOF'
import json, os, time, urllib.request

project = os.environ["PROJECT"]
branch = os.environ["BRANCH"]
slug = os.environ["SECRET_NAME"].lower().replace("_", "-")
headers = {
    "Authorization": f"Bearer {os.environ['TOKEN']}",
    "Content-Type": "application/json",
}
base = "https://firebaseapphosting.googleapis.com/v1"

def call(url, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as res:
        return json.load(res)

backends = call(f"{base}/projects/{project}/locations/-/backends").get("backends", [])
if not backends:
    print("No App Hosting backends found - nothing to roll out.")
    raise SystemExit(0)

stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
rollouts = []
for be in backends:
    rid = f"rotate-{slug}-{stamp}"
    call(f"{base}/{be['name']}/builds?buildId={rid}",
         method="POST", body={"source": {"codebase": {"branch": branch}}})
    call(f"{base}/{be['name']}/rollouts?rolloutId={rid}",
         method="POST", body={"build": f"{be['name']}/builds/{rid}"})
    rollouts.append(f"{be['name']}/rollouts/{rid}")
    print(f"Rollout started: {be['name'].split('/')[-1]} ({rid})")

deadline = time.time() + 1200
pending = set(rollouts)
while pending and time.time() < deadline:
    time.sleep(30)
    for name in list(pending):
        state = call(f"{base}/{name}").get("state")
        backend = name.split("/backends/")[1].split("/")[0]
        if state == "SUCCEEDED":
            print(f"{backend}: rollout SUCCEEDED")
            pending.discard(name)
        elif state in ("FAILED", "CANCELLED", "SKIPPED"):
            print(f"{backend}: rollout {state} - check the App Hosting console")
            pending.discard(name)
if pending:
    short = ", ".join(n.split("/backends/")[1].split("/")[0] for n in pending)
    print(f"Still rolling out after 20m: {short} - verify in the App Hosting console.")
    raise SystemExit(1)
PYEOF
else
  echo "apphosting.yaml does not bind ${SECRET_NAME} - no App Hosting rollout needed."
fi

echo ""
echo "Rotation complete: GSM version added, consumer Cloud Functions patched, App Hosting rolled out where bound."
