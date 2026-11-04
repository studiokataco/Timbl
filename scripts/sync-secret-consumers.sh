#!/usr/bin/env bash
set -euo pipefail

# Point every consumer of a Secret Manager secret at its latest version.
# Cloud Functions pin the version that was latest at deploy, and App Hosting
# resolves bindings at rollout, so adding a version alone strands both.
#
# Usage:
#   ./scripts/sync-secret-consumers.sh SECRET [SECRET...]   patch + roll out
#   ./scripts/sync-secret-consumers.sh --check              report drift, exit 1 if any

PROJECT="${GCP_PROJECT:-timbl-prod}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 SECRET [SECRET...] | --check"
  exit 1
fi

TOKEN="$(gcloud auth print-access-token)" PROJECT="$PROJECT" \
  BRANCH="${APP_BRANCH:-main}" APPHOSTING_YAML="${ROOT}/apphosting.yaml" \
  python3 - "$@" <<'PYEOF'
import json, os, re, sys, time, urllib.request

project = os.environ["PROJECT"]
args = sys.argv[1:]
check_only = args == ["--check"]
headers = {
    "Authorization": f"Bearer {os.environ['TOKEN']}",
    "Content-Type": "application/json",
}

def call(url, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as res:
        return json.load(res)

def latest_version(secret):
    url = (f"https://secretmanager.googleapis.com/v1/projects/{project}/secrets/{secret}/versions"
           "?filter=state:ENABLED&pageSize=100")
    versions = call(url).get("versions", [])
    if not versions:
        raise SystemExit(f"{secret} has no enabled versions.")
    newest = max(versions, key=lambda v: v["createTime"])
    return newest["name"].split("/")[-1]

fn_base = "https://cloudfunctions.googleapis.com/v2"
fns = call(f"{fn_base}/projects/{project}/locations/-/functions").get("functions", [])
consumed = {s["secret"] for fn in fns
            for s in fn.get("serviceConfig", {}).get("secretEnvironmentVariables", [])}
secrets = sorted(consumed) if check_only else args
latest = {s: latest_version(s) for s in secrets}

stale = []
for fn in fns:
    envs = fn.get("serviceConfig", {}).get("secretEnvironmentVariables", [])
    if any(s["secret"] in latest and s["version"] != latest[s["secret"]] for s in envs):
        stale.append((fn, envs))

if check_only:
    for fn, envs in stale:
        for s in envs:
            if s["version"] != latest[s["secret"]]:
                print(f"STALE {fn['name'].split('/')[-1]}: {s['secret']} v{s['version']} (latest v{latest[s['secret']]})")
    if stale:
        raise SystemExit(f"{len(stale)} function(s) pinned to an old secret. Run: {sys.argv[0]} <SECRET>")
    print("All Cloud Functions are on the latest version of every secret they use.")
    raise SystemExit(0)

for fn, envs in stale:
    for s in envs:
        if s["secret"] in latest:
            s["version"] = latest[s["secret"]]
    call(f"{fn_base}/{fn['name']}?updateMask=serviceConfig.secretEnvironmentVariables",
         method="PATCH", body={"serviceConfig": {"secretEnvironmentVariables": envs}})
    print(f"Patching {fn['name'].split('/')[-1]} -> latest")
if not stale:
    print("Cloud Functions already on the latest versions.")

deadline = time.time() + 300
pending = {fn["name"] for fn, _ in stale}
while pending and time.time() < deadline:
    time.sleep(10)
    for name in list(pending):
        state = call(f"{fn_base}/{name}").get("state")
        if state == "ACTIVE":
            print(f"{name.split('/')[-1]}: ACTIVE")
            pending.discard(name)
        elif state not in ("DEPLOYING", None):
            print(f"{name.split('/')[-1]}: {state} - check the Cloud Console")
            pending.discard(name)
if pending:
    raise SystemExit("Still deploying after 5m: " + ", ".join(n.split("/")[-1] for n in pending))

yaml = open(os.environ["APPHOSTING_YAML"]).read()
bound = [s for s in secrets if re.search(rf"^\s*secret:\s*{re.escape(s)}\s*$", yaml, re.M)]
if not bound:
    print("apphosting.yaml binds none of these secrets - no App Hosting rollout needed.")
    raise SystemExit(0)

ah_base = "https://firebaseapphosting.googleapis.com/v1"
backends = call(f"{ah_base}/projects/{project}/locations/-/backends").get("backends", [])
stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
rollouts = []
for be in backends:
    rid = f"secret-sync-{stamp}"
    call(f"{ah_base}/{be['name']}/builds?buildId={rid}",
         method="POST", body={"source": {"codebase": {"branch": os.environ["BRANCH"]}}})
    call(f"{ah_base}/{be['name']}/rollouts?rolloutId={rid}",
         method="POST", body={"build": f"{be['name']}/builds/{rid}"})
    rollouts.append(f"{be['name']}/rollouts/{rid}")
    print(f"Rollout started: {be['name'].split('/')[-1]} ({rid}) for {', '.join(bound)}")

deadline = time.time() + 1200
pending = set(rollouts)
while pending and time.time() < deadline:
    time.sleep(30)
    for name in list(pending):
        state = call(f"{ah_base}/{name}").get("state")
        backend = name.split("/backends/")[1].split("/")[0]
        if state == "SUCCEEDED":
            print(f"{backend}: rollout SUCCEEDED")
            pending.discard(name)
        elif state in ("FAILED", "CANCELLED", "SKIPPED"):
            print(f"{backend}: rollout {state} - check the App Hosting console")
            pending.discard(name)
if pending:
    raise SystemExit("Still rolling out after 20m: verify in the App Hosting console.")
PYEOF
