// Unit: the ballot drop door (forward-first) — bin/drop.mjs. Verify-from-anyone + content-id dedup,
// the three-rule table (turn-in / quell-back shrug / flood-onward), and the content-addressed archive.
// Custody (a stand-in pile) is #86 Slice 3 and is deliberately not exercised here. Run: node test/drop.test.mjs
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runDrop, attest, generateIdentity, contentId } from "../bin/drop.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const NOW = "2026-07-06T22:00:00.000Z";

const me = await generateIdentity();
const author = await generateIdentity();
const ballot = (over = {}) => attest({ schema: "anecdote.ballot/v1", pile: "cd04-q1", poll: "budget",
  answer: "Keep", ts: "2026-07-04T18:00:00Z", scope: "colorado", ...over }, me);

async function scratch({ ballots = [], quells = [], authors = {} } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-drop-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: colorado\nscope: colorado\n`);
  // I list pile cd04-q1 (colorado), fronted by a Tell; I peer with the wyoming Atlas.
  writeFileSync(path.join(dir, "_data/piles.yml"), `- id: cd04-q1\n  scope: colorado\n  tell: cd04\n`);
  writeFileSync(path.join(dir, "_data/tells.yml"), `- id: cd04\n  scope: colorado\n  url: "https://cd04.example"\n`);
  writeFileSync(path.join(dir, "_data/atlases.yml"), `- id: wyoming\n  scope: wyoming\n  url: "https://wy.example"\n`);
  writeFileSync(path.join(dir, "_data/drop-inbox.json"), JSON.stringify({ ballots, quells }));
  if (Object.keys(authors).length) writeFileSync(path.join(dir, "_data/poll-authors.json"), JSON.stringify(authors));
  return dir;
}

// 1. verify-from-anyone: a good ballot is kept; a tampered one is rejected (never archived).
{
  const good = await ballot();
  const bad = { ...(await ballot({ answer: "Cut" })), answer: "Keepx" }; // mutate after signing -> sig fails
  const dir = await scratch({ ballots: [good, bad] });
  const { manifest, archived } = await runDrop(dir, { now: NOW });
  ok(manifest.received === 2 && manifest.rejected === 1 && manifest.kept === 1, "one good kept, one tampered rejected");
  ok(archived.length === 1, "only the verified ballot is archived");
}

// 2. content-id dedup: the same signed ballot twice -> one kept, one archive entry.
{
  const b = await ballot();
  const dir = await scratch({ ballots: [b, { ...b }] });
  const { manifest, archived } = await runDrop(dir, { now: NOW });
  ok(manifest.kept === 1 && archived.length === 1, "dedup by content-id: same ballot -> one entry (arrival behavior)");
}

// 3. turnIn: a listed pile, arrived in my scope, no quell.
{
  const b = await ballot();
  const dir = await scratch({ ballots: [b] });
  const { manifest } = await runDrop(dir, { now: NOW });
  const f = manifest.fates;
  ok(f.turnIn.length === 1 && !f.shrugQuellBack.length && !f.floodOnward.length, "listed pile + arrived -> turnIn");
  ok(f.turnIn[0].id === (await contentId(b)) && f.turnIn[0].pile === "cd04-q1", "the fate carries the ballot's content-id + coordinates");
}

// 4. floodOnward (unknown pile): not a pile I list -> forward one hop to peers, archived, never dropped.
{
  const b = await ballot({ pile: "elsewhere" });
  const dir = await scratch({ ballots: [b] });
  const { manifest, archived } = await runDrop(dir, { now: NOW });
  const f = manifest.fates;
  ok(!f.turnIn.length && f.floodOnward.length === 1, "unknown pile -> floodOnward");
  ok(JSON.stringify(f.floodOnward[0].forward_to) === JSON.stringify(["wyoming"]), "flood queues a one-hop forward to peer Atlases");
  ok(archived.length === 1, "an un-homed ballot is still archived (never dropped)");
}

// 5. floodOnward (out of scope): a listed pile but addressed to a scope I don't serve.
{
  const b = await ballot({ scope: "wyoming" });
  const dir = await scratch({ ballots: [b] });
  const { manifest } = await runDrop(dir, { now: NOW });
  ok(!manifest.fates.turnIn.length && manifest.fates.floodOnward.length === 1, "listed pile out of my scope -> floodOnward");
}

// 6. shrugQuellBack: a terminal author quell (no host, signed by the poll's author) -> hand it back.
{
  const b = await ballot();
  const q = await attest({ schema: "anecdote.quell/v1", pile: "cd04-q1", poll: "budget", ts: "2026-07-05T00:00:00Z", reason: "ended" }, author);
  const dir = await scratch({ ballots: [b], quells: [q], authors: { "cd04-q1/budget": author.fingerprint } });
  const { manifest } = await runDrop(dir, { now: NOW });
  const f = manifest.fates;
  ok(!f.turnIn.length && !f.floodOnward.length && f.shrugQuellBack.length === 1, "author quell -> shrugQuellBack");
  ok(f.shrugQuellBack[0].quells[0] === (await contentId(q)), "the operative quell's id rides back to the carrier");
}

// 7. the archive is content-addressed under <scope>/<poll>/<id>.json.
{
  const b = await ballot();
  const dir = await scratch({ ballots: [b] });
  await runDrop(dir, { now: NOW });
  const id = (await contentId(b)).replace(/^sha256:/, "");
  ok(existsSync(path.join(dir, "_data/drop-archive/colorado/budget", id + ".json")), "kept ballot lands at drop-archive/<scope>/<poll>/<id>.json");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall drop tests passed");
