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

echo "[4] bin/widget bakes the node's geo-less locator stem"
W4="$(bin/widget --atlas demo --scope colorado --updated 2026-06-27)"
grep -q 'data-node="demo.colorado.anecdote.channel"' <<<"$W4" || fail "widget missing resolved host"
grep -q '?node=demo&amp;home=colorado' <<<"$W4" || fail "widget missing geo-less locator (node+home)"
grep -q 'class="anecdote-widget"' <<<"$W4" || fail "widget missing the shared fragment contract"
ok "widget renders <atlas>.<scope> host + hub locator + anecdote-widget contract"
# A moniker is a DNS label and nothing else — a bad one must be refused, never host-injected.
if bin/widget --atlas 'bad label' --scope colorado >/dev/null 2>&1; then
  fail "bin/widget accepted a non-DNS-label moniker"
fi
ok "bin/widget refuses a moniker that isn't a clean DNS label"

echo "[5] scan.js routes a scan by the scanner's state"
node -e '
  const s = require("./assets/scan.js");
  const A = "anecdote.channel";
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.error("FAIL: " + m + " got " + JSON.stringify(a)); process.exit(1); } };
  eq(s.deriveApex("atlas.anecdote.channel"), A, "deriveApex");
  eq(s.stateSlug(" Colorado "), "colorado", "stateSlug normalizes");
  eq(s.stateSlug("../evil"), "", "stateSlug rejects junk");
  eq(s.route({ node: "demo", home: "colorado", state: "colorado", apex: A }),
     { action: "redirect", url: "https://demo.colorado.anecdote.channel/" }, "in-state redirects");
  eq(s.route({ node: "demo", home: "colorado", state: "texas", apex: A }).action, "missing", "out-of-state is missing");
  eq(s.route({ node: "demo", home: "colorado", state: "", apex: A }).action, "missing", "unknown state is missing");
  eq(s.route({ node: "", home: "colorado", state: "colorado", apex: A }).action, "none", "no node -> directory");
  eq(s.buildTarget({ node: "my.atlas", state: "colorado", apex: A }), "https://my.atlas.colorado.anecdote.channel/", "multi-label stem");
' || fail "scan.js routing logic"
ok "in-state -> redirect; out-of-state/unknown -> missing-in-state; no node -> directory"

echo "ALL TESTS PASSED"
