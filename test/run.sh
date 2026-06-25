#!/usr/bin/env bash
# Smoke-test the matchmaker. The "what's hanging" templates (needs.json, needs.md) are
# validated by the Jekyll build job; this covers bin/match's logic. Needs ruby (stdlib
# yaml/json) + jq, both present on the runner.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"; cd "$root"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok()   { echo "  ok: $*"; }
trap 'printf "[]\n" > "$root/matches.json"' EXIT   # never leave a test match committed

echo "[1] default matcher is honest — nothing auto-matches without a judge"
bin/match >/dev/null
[ "$(jq 'length' matches.json)" = 0 ] || fail "default matcher produced a match"
ok "no ATLAS_MATCH_CMD -> needs-judgment -> empty matches.json"

echo "[2] a fitting matcher yields a match with a full address + consent flag"
W="$(mktemp -d)"; printf '#!/usr/bin/env bash\njq -n %s\n' "'{verdict:\"accept\",reason:\"fits\"}'" > "$W/yes"; chmod +x "$W/yes"
ATLAS_MATCH_CMD="$W/yes" bin/match >/dev/null
[ "$(jq 'length' matches.json)" -ge 1 ] || fail "fitting matcher produced no match"
jq -e '.[0] | .need_id and .asker_repo and .candidate.atlas_url and .candidate.tell_url and .candidate.pile_id and (.verdict=="accept")' \
  matches.json >/dev/null || fail "match record missing fields"
# the example need has empty terms -> consent required
jq -e '.[0].consent_required == true' matches.json >/dev/null || fail "consent_required not derived from terms"
ok "match carries atlas+tell+pile address; consent_required follows the need's terms"

echo "[3] registry + manifest parse"
ruby -ryaml -e 'YAML.load_file("_data/needs.yml")' || fail "_data/needs.yml not valid YAML"
ok "_data/needs.yml parses"

echo "ALL TESTS PASSED"
