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

echo "[6] scan-router worker fills the scanner's state and 302s"
WRK="$(mktemp -d)/scan-router.mjs"; cp workers/scan-router/worker.js "$WRK"
node --input-type=module -e '
  const m = await import("file://" + process.argv[1]);
  const eq = (a, b, msg) => { if (a !== b) { console.error("FAIL: " + msg + " got " + JSON.stringify(a)); process.exit(1); } };
  // state fill: explicit override wins, then US edge region, then the colorado fallback
  eq(m.fillState(new URLSearchParams("state=texas"), null), "texas", "explicit ?state wins");
  eq(m.fillState(new URLSearchParams(""), { country: "US", regionCode: "CO" }), "colorado", "US CO -> colorado");
  eq(m.fillState(new URLSearchParams(""), { country: "US", regionCode: "TX" }), "texas", "US TX -> texas");
  eq(m.fillState(new URLSearchParams(""), { country: "CA", regionCode: "ON" }), "colorado", "non-US -> default");
  eq(m.fillState(new URLSearchParams(""), null), "colorado", "no edge geo -> default");
  eq(m.fillState(new URLSearchParams("state=../evil"), { country: "US", regionCode: "TX" }), "texas", "junk override ignored, falls to geo");
  eq(m.stem("my.atlas"), "my.atlas", "multi-label stem ok");
  eq(m.stem("bad label"), "", "non-DNS stem rejected");
  // end-to-end redirect (cf object faked; the worker only reads request.url + request.cf)
  const res = await m.default.fetch({ url: "https://atlas.anecdote.channel/?node=demo&state=texas", cf: null });
  eq(res.status, 302, "redirect status");
  eq(res.headers.get("location"), "https://demo.texas.anecdote.channel/", "redirect target");
' "$WRK" || fail "scan-router worker logic"
ok "override/edge-geo/fallback state fill; DNS-guarded stem; 302 to <stem>.<state>"

if command -v node >/dev/null 2>&1; then
  echo "[dump] the atlas dump: lease-listed, center-bounded, watershed-shipped, ledger-signed"
  node "$(cd "$(dirname "$0")/.." && pwd)/test/dump.test.mjs" || { echo "FAIL: dump test" >&2; exit 1; }
  echo "  ok: bin/dump composes + signs the boundary canon"
else
  echo "[dump] SKIPPED — node not available"
fi

if command -v node >/dev/null 2>&1; then
  echo "[tree] the heartbeat tree: signed above-edges hydrate into a timestamped org tree (text + JSON)"
  node "$(cd "$(dirname "$0")/.." && pwd)/test/tree.test.mjs" || { echo "FAIL: tree test" >&2; exit 1; }
  echo "  ok: bin/tree hydrates the above-marks with per-level heartbeat, off-map + stale shown in place"
else
  echo "[tree] SKIPPED — node not available"
fi

if command -v node >/dev/null 2>&1; then
  echo "[atlas-index] the atlas-of-atlases index: the peer directory hydrates into one signed, leased atlases.json"
  node "$(cd "$(dirname "$0")/.." && pwd)/test/atlas-index.test.mjs" || { echo "FAIL: atlas-index test" >&2; exit 1; }
  echo "  ok: bin/atlas-index relays peers verbatim, leases by renewed date, signs its own ledger"
else
  echo "[atlas-index] SKIPPED — node not available"
fi

if command -v node >/dev/null 2>&1; then
  echo "[drop] the ballot drop door: verify-from-anyone, content-id dedup, the three-rule table"
  node "$(cd "$(dirname "$0")/.." && pwd)/test/drop.test.mjs" || { echo "FAIL: drop test" >&2; exit 1; }
  echo "  ok: bin/drop verifies + dedups + routes (turn-in / quell-back / flood-onward), kept content-addressed"
else
  echo "[drop] SKIPPED — node not available"
fi

echo "ALL TESTS PASSED"

echo "[custody] the declared boundary holds (keys/custody.yml x bin/check-custody)"
bin/check-custody >/dev/null 2>&1 || fail "check-custody failed on the repo as-is"
BW="$(mktemp -d)"; printf 'env:\n  X: ${{ secrets.SNEAKY }}\n' > "$BW/x.yml"
WORKFLOWS_DIR="$BW" bin/check-custody >/dev/null 2>&1 && fail "checker passed an undeclared secret-read" || true
rm -rf "$BW"
ok "workflows read only declared secrets; an undeclared read fails the build"
