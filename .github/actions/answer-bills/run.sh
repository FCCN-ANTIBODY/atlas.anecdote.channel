#!/usr/bin/env bash
# Core of the `answer-bills` composite action (SCAFFOLD). Answering a friend's bill is the EXISTING
# matcher: run bin/match with ATLAS_NEEDS=<the bill> and ATLAS_MATCH_CMD=<judge> over this Atlas's
# own piles/Tells. The honest default (no judge) accepts nothing. Reading the request/** branches
# and delivering the bulk answer PR back to the asking peer are deferred (see "D. Cross-Atlas
# peering" in civic-node's OPEN-QUESTIONS.md); this step performs no cross-repo write.
#
# Env (from action.yml): ATLAS_MATCH_CMD, BILL (optional bill path), ATLAS_PILES/TELLS/CONFIG.
set -euo pipefail

action_dir="$(cd "$(dirname "$0")" && pwd)"
MATCH="${ATLAS_BIN:-$action_dir/../../../bin}/match"
[ -x "$MATCH" ] || { echo "::error::match code not found at $MATCH"; exit 1; }

# In the live flow the bills arrive on request/<scope>/<id> branches filling _data/requests.yml;
# that queue is empty on main by design, so without an explicit BILL there is nothing to answer.
if [ -z "${BILL:-}" ]; then
  echo "::notice title=answer-bills deferred::No inbound bill to answer. In the live flow a peer files a bill on a request/<scope>/<id> branch (the on-main queue is empty by design); reading those branches and returning the bulk answer PR are not yet wired (see 'D. Cross-Atlas peering' in civic-node's OPEN-QUESTIONS.md). Pass the 'bill' input to exercise the matcher+judge seam over a sample."
  exit 0
fi
[ -f "$BILL" ] || { echo "::error::bill not found at '$BILL'"; exit 1; }

out="$(mktemp)"
# THE seam reuse: the bill is a needs-shaped list, fed to the existing matcher via ATLAS_NEEDS.
ATLAS_NEEDS="$BILL" ATLAS_OUT="$out" "$MATCH"
accepted="$(grep -c '"verdict": "accept"' "$out" 2>/dev/null || true)"

{
  echo "## answer-bills (scaffold)"
  echo
  echo "Ran the matcher over the bill \`${BILL}\` with judge \`${ATLAS_MATCH_CMD:-<honest default: needs-judgment>}\`."
  echo "Accepted matches: **${accepted:-0}**."
  echo
  echo '```json'
  cat "$out"
  echo '```'
} >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"

echo "::notice title=answer-bills deferred::Matcher produced ${accepted:-0} accepted match(es) over ${BILL}. Delivering them as a bulk signed PR back to the asking peer (modifying the line for the address it knows, one hop) is not yet wired (see 'D. Cross-Atlas peering' in civic-node's OPEN-QUESTIONS.md). No cross-repo write performed."
