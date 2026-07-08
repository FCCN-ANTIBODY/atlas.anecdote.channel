// Unit: the retirement of a keep (bin/retire.mjs, civic-node#91 lifecycle). Quiet is read from
// the OPEN TEE LEDGER (arrival dates), never from ballot timestamps; honest defaults read
// nothing as quiet; the default-hold guard (#94) refuses to evict into a hole; deflate is
// lossless (files MOVE, whole, to archived/) and the report speaks only log bands; the keyring
// walks live -> deflated -> torn-down, in order, and a retired question can rise again into a
// NEW tank (the stone skips). Run: node test/retire.test.mjs
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runRetirePlan, runDeflate, runTeardown, band } from "../bin/retire.mjs";
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

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall retire tests passed");
