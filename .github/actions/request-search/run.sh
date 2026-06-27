#!/usr/bin/env bash
# Core of the `request-search` composite action (SCAFFOLD). Runs in the calling Atlas's checkout:
# assembles this Atlas's bill from its own needs (bin/bill, the offline-pure half) and reports the
# examine-not-merge request it WOULD file with the peer. The live cross-repo emit — clone the peer,
# push a `request/<scope>/<id>` branch filling the peer's _data/requests.yml, sign it, open the PR —
# is deferred (OPEN-QUESTIONS.md #6); this step performs no cross-repo write.
#
# Env (from action.yml): PEER_REPO, BILL_MAX, ATLAS_NEEDS, ATLAS_YML, ATLAS_FPR_FILE.
set -euo pipefail

action_dir="$(cd "$(dirname "$0")" && pwd)"
BILL="${ATLAS_BIN:-$action_dir/../../../bin}/bill"
[ -x "$BILL" ] || { echo "::error::bill code not found at $BILL"; exit 1; }

: "${ATLAS_YML:=atlas.yml}"; : "${ATLAS_FPR_FILE:=keys/atlas.fpr}"; : "${ATLAS_NEEDS:=_data/needs.yml}"
[ -f "$ATLAS_YML" ]   || { echo "::error::no Atlas identity at '$ATLAS_YML' in the calling repo"; exit 1; }
[ -n "${PEER_REPO:-}" ] || { echo "::error::peer input required — you bill a different Atlas, never self"; exit 1; }
export ATLAS_YML ATLAS_NEEDS

branch="$("$BILL" branch)"
bill="$("$BILL" bill --max "${BILL_MAX:-25}")"
n="$(printf '%s\n' "$bill" | grep -c '^- id:' || true)"

{
  echo "## request-search (scaffold)"
  echo
  echo "Would file a bill of **${n}** need(s) with \`${PEER_REPO}\` on branch \`${branch}\`"
  echo "(examine-not-merge, over its empty-on-main \`_data/requests.yml\`)."
  echo
  echo '```yaml'
  printf '%s\n' "$bill"
  echo '```'
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"

echo "::notice title=request-search deferred::Bill of ${n} need(s) assembled for ${PEER_REPO} (branch ${branch}). The live emit (push the request branch + open the examine-not-merge PR) is not yet wired — it needs FCCN-ANTIBODY/judge and a second live Atlas (OPEN-QUESTIONS.md #6). No cross-repo write performed."
