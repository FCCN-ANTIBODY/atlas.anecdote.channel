// Unit: the retirement of a keep (bin/retire.mjs, civic-node#91 lifecycle). Quiet is read from
// the OPEN TEE LEDGER (arrival dates), never from ballot timestamps; honest defaults read
// nothing as quiet; the default-hold guard (#94) refuses to evict into a hole; deflate is
// lossless (files MOVE, whole, to archived/) and the report speaks only log bands; the keyring
// walks live -> deflated -> torn-down, in order, and a retired question can rise again into a
// NEW tank (the stone skips). Run: node test/retire.test.mjs
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runRetirePlan, runDeflate, runTeardown, runFlush, runRelease, band } from "../bin/retire.mjs";
import { runTee } from "../bin/tee.mjs";
import { recordHearsayPile, runHearsayPlan, readKeyring } from "../bin/hearsay.mjs";
import { attest, generateIdentity, contentId } from "../bin/drop.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const RECIPIENT = "age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg";
const T0 = "2026-06-01T00:00:00.000Z"; // ballots arrive (the tee dates them)
const T1 = "2026-07-08T00:00:00.000Z"; // the plan is read 37 days later

const voter = await generateIdentity();
async function scratch({ antidotes = `- id: larimer\n  repo: acme/antidote.larimer\n`, ballots = [] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-retire-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: colorado\nscope: colorado\n`);
  writeFileSync(path.join(dir, "_data/antidotes.yml"), antidotes);
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  for (const spec of ballots) {
    const b = await attest({ schema: "anecdote.ballot/v1", pile: "orphan", poll: "budget", scope: "colorado",
      answer: "Keep", ts: "2026-05-30T18:00:00Z", ...spec }, voter);
    const d = path.join(dir, "_data/drop-archive", b.scope || "_", b.poll);
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, (await contentId(b)).replace(/^sha256:/, "") + ".json"), JSON.stringify(b));
  }
  return dir;
}
const keep = (dir, over = {}) => recordHearsayPile(dir, { id: "orphan-hearsay", pile: "orphan", poll: "budget",
  scope: "colorado", repoUrl: "https://github.com/acme/orphan-hearsay", recipient: RECIPIENT, now: T0, ...over });

// 1. honest defaults read nothing as quiet: no ATLAS_QUIET_DAYS -> nothing rises, reason narrated.
{
  const dir = await scratch({ ballots: [{ answer: "A" }] });
  keep(dir);
  await runTee(dir, { now: T0 });
  const out = await runRetirePlan(dir, { now: T1 });
  ok(out.plan.length === 0 && out.holding.length === 1 && /not quiet/.test(out.holding[0].why),
    "no quiet window set -> nothing is ever quiet -> the tank holds");
  ok(out.policy.quiet_days === null, "the honest default is visible in the plan's policy");
}

// 2. quiet is read from the tee ledger; a quiet, fully-placed tank rises — still needing a judge.
{
  const dir = await scratch({ ballots: [{ answer: "A" }, { answer: "B" }] });
  keep(dir);
  await runTee(dir, { now: T0 }); // arrivals dated T0 by the open ledger
  const out = await runRetirePlan(dir, { now: T1, quietDays: 30 });
  ok(out.plan.length === 1 && out.plan[0].needs === "judge", "37 days silent > 30-day window -> rises, needs a judge");
  ok(out.plan[0].doors[0].last_arrival && out.plan[0].doors[0].quiet === true,
    "the door reads its last arrival from the ledger and calls itself quiet");
  ok(/deflate --id orphan-hearsay/.test(out.plan[0].gesture.deflate), "the gesture is spelled out");
}

// 3. fresh activity resets quiet: a new ballot teed inside the window holds the tank.
{
  const dir = await scratch({ ballots: [{ answer: "A" }] });
  keep(dir);
  await runTee(dir, { now: T0 });
  const late = await attest({ schema: "anecdote.ballot/v1", pile: "orphan", poll: "budget", scope: "colorado",
    answer: "LateButAlive", ts: "2026-01-01T00:00:00Z" }, voter); // OLD signed ts — lateness does not exist
  const d = path.join(dir, "_data/drop-archive/colorado/budget");
  writeFileSync(path.join(d, (await contentId(late)).replace(/^sha256:/, "") + ".json"), JSON.stringify(late));
  await runTee(dir, { now: "2026-07-01T00:00:00.000Z" }); // it ARRIVES a week before the reading
  const out = await runRetirePlan(dir, { now: T1, quietDays: 30 });
  ok(out.plan.length === 0 && out.holding.length === 1 && /not quiet/.test(out.holding[0].why),
    "an old-ts ballot arriving recently is ACTIVITY (arrival clock, not ballot ts) -> holds");
}

// 4. default-hold: no archivist, or an untee'd record, and nothing retires — plan and deflate both.
{
  const dir = await scratch({ antidotes: "", ballots: [{ answer: "A" }] });
  keep(dir);
  const out = await runRetirePlan(dir, { now: T1, quietDays: 30 });
  ok(out.plan.length === 0 && /no archivist/.test(out.holding[0]?.why || ""), "no archivist registered -> default-hold");
  let threw = false;
  try { await runDeflate(dir, { id: "orphan-hearsay", now: T1 }); } catch { threw = true; }
  ok(threw, "deflate refuses with no archivist — never evict into a hole");
}
{
  const dir = await scratch({ ballots: [{ answer: "A" }] });
  keep(dir); // held but never teed
  const out = await runRetirePlan(dir, { now: T1, quietDays: 30 });
  ok(out.plan.length === 0 && /not yet teed/.test(out.holding[0].why), "an unplaced record holds the tank (and is not even datable as quiet)");
  let threw = false;
  try { await runDeflate(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = /not yet teed/.test(e.message); }
  ok(threw, "deflate re-verifies the hold itself — a judge cannot consent past a hole");
}

// 5. deflate is LOSSLESS and the report speaks only bands; the keyring walks to deflated.
{
  const dir = await scratch({ ballots: [{ answer: "Keep" }, { answer: "Keep", ts: "2026-05-30T19:00:00Z" }, { answer: "Cut" }] });
  keep(dir);
  await runTee(dir, { now: T0 });
  const before = readdirSync(path.join(dir, "_data/drop-archive/colorado/budget")).length;
  const r = await runDeflate(dir, { id: "orphan-hearsay", now: T1 });
  ok(before === 3 && r.moved.length === 3, "every held record moved");
  const after = readdirSync(path.join(dir, "archived/colorado/budget")).filter((f) => f.endsWith(".json")).length;
  ok(after === 3 && !existsSync(path.join(dir, "_data/drop-archive/colorado/budget/" + r.moved[0].split(path.sep).pop())),
    "moved WHOLE to archived/<scope>/<poll>/ — same content-addressed layout, nothing left behind, nothing dropped");
  ok(r.report.questions[0].answers["Keep"] === "1-9" && r.report.questions[0].answers["Cut"] === "1-9" &&
     r.report.records === "1-9" && !JSON.stringify(r.report).match(/"held":\s*[0-9]/),
    "the report speaks log bands only — coarse standing, never raw counts");
  const kept = readKeyring(path.join(dir, "_data/hearsay-piles.yml"));
  ok(kept.every((k) => k.status === "deflated" && k.deflated_at), "the keyring walked live -> deflated, stamped");
  // and the question can rise AGAIN: a fresh drop for the same question is no longer 'kept live'.
  writeFileSync(path.join(dir, "custody-plan.json"), JSON.stringify({ archiveOnly: [{ pile: "orphan", poll: "budget",
    scope: "colorado", mass: 1, reason: "mass", why: "no verifiable fronted poll — cannot verify or seal" }] }));
  const again = runHearsayPlan(dir, { now: T1 });
  ok(again.plan.length === 1, "after deflate the same question can rise into a NEW tank — the stone skips");
}

// 6. teardown requires deflated first, walks to torn-down, and only narrates the remote gesture.
{
  const dir = await scratch({ ballots: [{ answer: "A" }] });
  keep(dir);
  await runTee(dir, { now: T0 });
  let threw = false;
  try { await runTeardown(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = /not deflated/.test(e.message); }
  ok(threw, "teardown before deflate is refused — lossless, always, before any mailbox comes down");
  await runDeflate(dir, { id: "orphan-hearsay", now: T1 });
  const r = await runTeardown(dir, { id: "orphan-hearsay", now: T1 });
  const kept = readKeyring(path.join(dir, "_data/hearsay-piles.yml"));
  ok(kept.every((k) => k.status === "torn-down" && k.torn_down_at), "the keyring walked deflated -> torn-down, stamped");
  ok(r.gesture.length === 2 && /prune-pile-history/.test(r.gesture[0]) && /archive the repository/.test(r.gesture[1]),
    "the remote mailbox gesture is narrated, never performed");
}

// 7. band mirrors the constellation's coarse-standing idiom.
{
  ok(band(0) === "0" && band(3) === "1-9" && band(42) === "10-99" && band(500) === "100-999",
    "band(): 0, then log-ten bands — the antidote heartbeat idiom");
}

// ── the flush-elsewhere: raw leaves only against verified receipts ────────────
const COMMON = "sha256:" + "b".repeat(64);
async function retiredScratch() { // a tank walked to torn-down, with a chartered archivist listed
  const dir = await scratch({ ballots: [{ answer: "Keep" }, { answer: "Cut" }],
    antidotes: `- id: larimer\n  repo: acme/antidote.larimer\n  constitution: "${COMMON}"\n` });
  keep(dir);
  await runTee(dir, { now: T0 });
  await runDeflate(dir, { id: "orphan-hearsay", now: T1 });
  await runTeardown(dir, { id: "orphan-hearsay", now: T1 });
  return dir;
}
// forge a receipt in the archivist's exact ledger grammar (antidote bin/punch): a custody-IN
// entry bound by the teleport digest, admitted ids sorted, head attesting contentId(entries).
async function receiptFor(dir, { digest, admitted, signer, queued = 0, refused = 0 }) {
  const entry = { seq: 0, at: T1, from: "colorado", teleport: { pile: "orphan-hearsay", seq: 0, digest },
    admitted: [...admitted].sort(), queued, refused, prev_hash: null };
  entry.this_hash = await contentId(entry);
  const entries = [entry];
  const head = await attest({ seq: 0, digest: await contentId(entries) }, signer);
  mkdirSync(path.join(dir, "_data/receipts"), { recursive: true });
  writeFileSync(path.join(dir, "_data/receipts/larimer.json"), JSON.stringify({ schema: "antidote.ledger/v1", entries, head }));
}
const pinSigner = (dir, fpr) => writeFileSync(path.join(dir, "_data/antidotes.yml"),
  `- id: larimer\n  repo: acme/antidote.larimer\n  constitution: "${COMMON}"\n  signer: "${fpr}"\n`);

// 8. flush composes the digest-bound teleport per archivist; the COMMON is the bottle's offer.
{
  const dir = await retiredScratch();
  const r = await runFlush(dir, { id: "orphan-hearsay", now: T1 });
  ok(r.bundles.length === 1 && r.bundles[0].count === 2, "one teleport per archivist, carrying the tank's whole archived raw");
  const bundle = JSON.parse(readFileSync(path.join(dir, r.bundles[0].file), "utf8"));
  ok(bundle.schema === "antidote.teleport/v1" && bundle.common_constitution === COMMON && bundle.pile === "orphan-hearsay",
    "the bundle rides under the archivist's DECLARED offer — never a COMMON computed here");
  ok(bundle.digest === await contentId({ seq: bundle.seq, prev_digest: bundle.prev_digest, commitments: bundle.commitments }),
    "digest = contentId({seq, prev_digest, commitments}) — the receiving door's own re-derivation");
  const again = await runFlush(dir, { id: "orphan-hearsay", now: T1 });
  ok(again.bundles[0].reused === true, "re-flush reuses the composed teleport — one OUT entry per (archivist, tank)");
  // an unchartered archivist (no offer, no --common) is skipped, narrated — never guessed at.
  writeFileSync(path.join(dir, "_data/antidotes.yml"), `- id: larimer\n  repo: acme/antidote.larimer\n- id: bare\n  repo: acme/bare\n`);
  const mixed = await runFlush(dir, { id: "orphan-hearsay", now: T1 });
  ok(mixed.skipped.length === 1 && /no COMMON CONSTITUTION/.test(mixed.skipped[0].why),
    "no declared offer and no --common -> that archivist is skipped with the reason (no constitution, no catalog)");
}

// 9. release verifies the receipt three ways, then — and only then — the raw goes; the report stays.
{
  const dir = await retiredScratch();
  const { bundles } = await runFlush(dir, { id: "orphan-hearsay", now: T1 });
  const digest = bundles[0].digest;
  const sent = JSON.parse(readFileSync(path.join(dir, "_data/flush-ledger.json"), "utf8")).entries[0].sent;
  const archivist = await generateIdentity();

  // unpinned signer -> refused before anything else is even read.
  let threw = "";
  try { await runRelease(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = e.message; }
  ok(/no pinned signer/.test(threw), "release refuses while the archivist's signer is unpinned (PIN-ME is not a pin)");
  pinSigner(dir, archivist.fingerprint);

  // missing receipt -> refused.
  threw = ""; try { await runRelease(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = e.message; }
  ok(/no receipt/.test(threw), "release refuses without the archivist's ledger copy — the tally alone never releases");

  // wrong signer -> refused (a receipt from anyone is not a receipt from THE archivist).
  const impostor = await generateIdentity();
  await receiptFor(dir, { digest, admitted: sent, signer: impostor });
  threw = ""; try { await runRelease(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = e.message; }
  ok(/not the pinned/.test(threw), "a receipt signed by an impostor is refused against the pin");

  // tampered entries -> refused (bytes must hash to the attested head).
  await receiptFor(dir, { digest, admitted: sent, signer: archivist });
  const rp = path.join(dir, "_data/receipts/larimer.json");
  const doctored = JSON.parse(readFileSync(rp, "utf8"));
  doctored.entries[0].admitted.push("sha256:" + "c".repeat(64));
  writeFileSync(rp, JSON.stringify(doctored));
  threw = ""; try { await runRelease(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = e.message; }
  ok(/digest mismatch/.test(threw), "doctored entries no longer hash to the attested head -> refused");

  // partial admission -> refused (a queued/refused record is re-homed, never silently dropped).
  await receiptFor(dir, { digest, admitted: sent.slice(0, 1), signer: archivist, queued: 1 });
  threw = ""; try { await runRelease(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = e.message; }
  ok(/not among them/.test(threw), "an incomplete admission blocks release, with the queued/refused counts narrated");

  // the honest receipt -> the raw goes, the report stays, the keyring walks to flushed.
  await receiptFor(dir, { digest, admitted: sent, signer: archivist });
  const r = await runRelease(dir, { id: "orphan-hearsay", now: T1 });
  ok(r.released === 2 && readdirSync(path.join(dir, "archived/colorado/budget")).filter((f) => f.endsWith(".json")).length === 0,
    "against a verified receipt the raw leaves archived/");
  ok(existsSync(path.join(dir, "archived/reports/orphan-hearsay.json")), "the coarse report stays forever");
  ok(readKeyring(path.join(dir, "_data/hearsay-piles.yml")).every((k) => k.status === "flushed" && k.flushed_at),
    "the keyring walked torn-down -> flushed, stamped");
  const fl = JSON.parse(readFileSync(path.join(dir, "_data/flush-ledger.json"), "utf8"));
  ok(fl.entries.some((e) => e.kind === "release" && e.receipts?.[0]?.antidote === "larimer"),
    "the release itself is a hash-linked entry in the open flush ledger");
}

// 10. release order: never before torn-down; flush never before deflate.
{
  const dir = await scratch({ ballots: [{ answer: "A" }],
    antidotes: `- id: larimer\n  repo: acme/antidote.larimer\n  constitution: "${COMMON}"\n` });
  keep(dir);
  await runTee(dir, { now: T0 });
  let threw = ""; try { await runFlush(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = e.message; }
  ok(/not retired/.test(threw), "flush before deflate is refused — it composes from archived/");
  await runDeflate(dir, { id: "orphan-hearsay", now: T1 });
  threw = ""; try { await runRelease(dir, { id: "orphan-hearsay", now: T1 }); } catch (e) { threw = e.message; }
  ok(/not torn-down/.test(threw), "release before teardown is refused — the raw leaves last, after the mailbox");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall retire tests passed");
