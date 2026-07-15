#!/usr/bin/env bash
# Smoke-test bin/gate's PLUMBING against a STUB engine: it assembles {queue, items, resolutions, now, knobs}
# from the persisted queue + the inbox + the knobs, runs the tick engine, writes the new queue + published
# admissions, and clears the inbox. The real tick logic (quorum, decay, no-judge) is proven in
# anecdote.channel's gate / gate-queue / gate-tick suites; this covers the Atlas-side transport only. No
# judgement engine, no key — the gate summons no judge.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
ok()   { echo "  ok: $*"; }

# A stub engine standing in for anecdote.channel/composer/gate-tick.mjs: capture the assembled input, return
# a canned tick result (one still-pending, one admitted).
eng="$work/engine"; mkdir -p "$eng/composer"
cap="$work/capture.json"
cat > "$eng/composer/gate-tick.mjs" <<'EOF'
import { writeFileSync } from "node:fs";
const chunks = []; for await (const c of process.stdin) chunks.push(c);
writeFileSync(process.env.STUB_CAPTURE, Buffer.concat(chunks).toString());
process.stdout.write(JSON.stringify({
  queue: [{ id: "gate-item:pending", item: { target: "atlas:x", kind: "anecdote", text: "waiting", at: "2026-07-14T18:00:00.000Z" } }],
  admitted: [{ id: "gate-item:ok", item: { target: "atlas:x", kind: "anecdote", text: "admitted", at: "2026-07-14T18:00:00.000Z" } }],
  expired: [],
}));
EOF

# An Atlas working tree: an empty queue + one item + one resolution in the inbox.
a="$work/atlas"; mkdir -p "$a/_data/gate-inbox/items" "$a/_data/gate-inbox/resolutions"
echo '[]' > "$a/_data/gate-queue.json"
echo '{"schema":"anecdote.gate-item/v1","target":"atlas:x","kind":"anecdote","text":"hi","at":"2026-07-14T18:00:00.000Z"}' > "$a/_data/gate-inbox/items/i1.json"
echo '{"schema":"anecdote.gate-resolution/v1","item":"gate-item:ok","admit":true,"sig":{"by":"key:sha256:aaa"}}' > "$a/_data/gate-inbox/resolutions/r1.json"

runp() { STUB_CAPTURE="$cap" GATE_ENGINE="$eng" GATE_QUEUE="$a/_data/gate-queue.json" GATE_INBOX="$a/_data/gate-inbox" \
         GATE_ADMITTED="$a/admitted.json" ATLAS_CONSTITUENCY="boulder.watershed" GATE_QUORUM=2 GATE_NOW="2026-07-14T18:00:00.000Z" \
         "$root/bin/gate" >/dev/null; }

echo "[1] bin/gate assembles the tick input from queue + inbox + knobs"
runp
[ "$(jq -r '.items[0].text' "$cap")" = "hi" ] || fail "item from the inbox not passed to the engine"
[ "$(jq -r '.resolutions[0].item' "$cap")" = "gate-item:ok" ] || fail "resolution from the inbox not passed"
[ "$(jq -r '.now' "$cap")" = "2026-07-14T18:00:00.000Z" ] || fail "now not passed"
[ "$(jq -r '.knobs.atlasConstituency' "$cap")" = "boulder.watershed" ] || fail "atlasConstituency knob not passed"
[ "$(jq -r '.knobs.quorum' "$cap")" = "2" ] || fail "quorum knob not passed"
ok "queue+items+resolutions+now+knobs assembled and handed to the engine"

echo "[2] it persists the new pending queue and publishes admissions"
[ "$(jq -r '.[0].id' "$a/_data/gate-queue.json")" = "gate-item:pending" ] || fail "pending queue not written from the tick result"
[ "$(jq -r '.[0].id' "$a/admitted.json")" = "gate-item:ok" ] || fail "admission not published"
[ "$(jq -r '.[0].text' "$a/admitted.json")" = "admitted" ] || fail "admission record missing the item text"
ok "gate-queue.json holds the pending set; admitted.json publishes the admission"

echo "[3] the inbox is cleared after the pass"
[ -z "$(ls -A "$a/_data/gate-inbox/items" 2>/dev/null)" ] && [ -z "$(ls -A "$a/_data/gate-inbox/resolutions" 2>/dev/null)" ] \
  || fail "inbox not cleared after folding"
ok "consumed items + resolutions cleared from the inbox"

echo "[4] admissions dedupe on re-run (idempotent publish)"
runp
[ "$(jq 'length' "$a/admitted.json")" = "1" ] || fail "admission duplicated on a second pass"
ok "a re-published admission dedupes by item id"

echo "[5] a missing engine fails loudly, never silently"
if GATE_ENGINE="$work/nope" GATE_QUEUE="$a/_data/gate-queue.json" GATE_INBOX="$a/_data/gate-inbox" "$root/bin/gate" >/dev/null 2>&1; then
  fail "bin/gate should exit non-zero when the engine is absent"
fi
ok "absent engine -> non-zero exit"

echo "all gate transport tests passed"
