// Unit: the archivist tee (bin/tee.mjs, civic-node#91 "flush = a presumed PR" / #94 "Atlas
// forwards dumb and fast"). Honest default fires nothing (empty registry); every registered
// antidote gets everything; the open ledger chains and remembers, so a re-run tees only what's
// new; bundles are loose mail in the intake door's shape. Run: node test/tee.test.mjs
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runTee } from "../bin/tee.mjs";
import { attest, generateIdentity, contentId } from "../bin/drop.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const NOW = "2026-07-07T22:00:00.000Z";

const voter = await generateIdentity();
async function scratch({ antidotes = "", ballots = [] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-tee-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: colorado\nscope: colorado\n`);
  writeFileSync(path.join(dir, "_data/antidotes.yml"), antidotes);
  const kept = [];
  for (const spec of ballots) {
    const b = await attest({ schema: "anecdote.ballot/v1", pile: "orphan", poll: "budget", scope: "colorado",
      answer: "Keep", ts: "2026-07-04T18:00:00Z", ...spec }, voter);
    const id = (await contentId(b)).replace(/^sha256:/, "");
    const d = path.join(dir, "_data/drop-archive", b.scope || "_", b.poll);
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, id + ".json"), JSON.stringify(b));
    kept.push(b);
  }
  return { dir, kept };
}
const TWO_ANTIDOTES = `- id: larimer\n  repo: acme/antidote.larimer\n- id: colorado-state\n  repo: acme/antidote.colorado\n`;

// 1. honest default fires nothing: an empty registry tees nothing and says so.
{
  const { dir } = await scratch({ ballots: [{ answer: "A" }] });
  const out = await runTee(dir, { now: NOW });
  ok(out.bundles.length === 0 && /no antidote servers registered/.test(out.note), "empty registry -> nothing teed, reason narrated");
  ok(!existsSync(path.join(dir, "_data/tee-ledger.json")), "no ledger is written when nothing is sent");
}

// 2. every registered antidote gets EVERYTHING — dumb, unsharded, loose-mail shaped.
{
  const { dir, kept } = await scratch({ antidotes: TWO_ANTIDOTES, ballots: [{ answer: "A" }, { answer: "B", scope: "wyoming" }] });
  const out = await runTee(dir, { now: NOW });
  ok(out.bundles.length === 2 && out.bundles.every((b) => b.count === 2),
    "both antidotes receive both ballots (no sharding — the out-of-scope ballot rides too)");
  const bundle = JSON.parse(readFileSync(path.join(dir, out.bundles[0].file), "utf8"));
  ok(bundle.from === "colorado" && Array.isArray(bundle.ballots) && bundle.ballots.length === 2 &&
     bundle.ballots.every((b) => b.schema === "anecdote.ballot/v1" && b.sig),
    "the bundle is loose mail in the intake door's shape ({from, ballots}), signatures riding whole");
  ok(/presumed PR/.test(out.deliver), "delivery is narrated as the presumed PR — never pushed by this script");
  const ledger = JSON.parse(readFileSync(path.join(dir, "_data/tee-ledger.json"), "utf8"));
  ok(ledger.entries.length === 2 && ledger.entries[1].prev_hash === ledger.entries[0].this_hash,
    "the open ledger chains one hash-linked entry per send");
  ok(ledger.entries.every((e) => e.sent.length === 2), "each entry names exactly the content-ids it sent");
  void kept;
}

// 3. the ledger is the memory: a re-run tees nothing; a new arrival tees only the delta.
{
  const { dir } = await scratch({ antidotes: TWO_ANTIDOTES, ballots: [{ answer: "A" }] });
  await runTee(dir, { now: NOW });
  const again = await runTee(dir, { now: NOW });
  ok(again.bundles.length === 0, "a re-run with nothing new sends nothing (no double-send, ever)");
  const b2 = await attest({ schema: "anecdote.ballot/v1", pile: "orphan", poll: "budget", scope: "colorado",
    answer: "C", ts: "2026-07-05T18:00:00Z" }, voter);
  const id2 = (await contentId(b2)).replace(/^sha256:/, "");
  const d = path.join(dir, "_data/drop-archive/colorado/budget");
  writeFileSync(path.join(d, id2 + ".json"), JSON.stringify(b2));
  const delta = await runTee(dir, { now: NOW });
  ok(delta.bundles.length === 2 && delta.bundles.every((b) => b.count === 1), "a new arrival tees exactly the delta to every antidote");
  const ledger = JSON.parse(readFileSync(path.join(dir, "_data/tee-ledger.json"), "utf8"));
  ok(ledger.entries.length === 4 && ledger.entries[3].prev_hash === ledger.entries[2].this_hash,
    "the chain keeps linking across runs");
}

// 4. a late-registered antidote catches up from zero (the loop is per-destination).
{
  const { dir } = await scratch({ antidotes: `- id: larimer\n  repo: acme/antidote.larimer\n`, ballots: [{ answer: "A" }] });
  await runTee(dir, { now: NOW });
  writeFileSync(path.join(dir, "_data/antidotes.yml"), TWO_ANTIDOTES);
  const out = await runTee(dir, { now: NOW });
  ok(out.bundles.length === 1 && out.bundles[0].antidote === "colorado-state" && out.bundles[0].count === 1,
    "a newly listed antidote receives the whole keep; the old one is not re-sent");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall tee tests passed");
