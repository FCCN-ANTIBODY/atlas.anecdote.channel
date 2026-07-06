// Unit: the stand-in custody DECISION (bin/custody.mjs, #86 Slice 3). Honest defaults fire nothing;
// mass OR scope-fit raises an un-homed poll with a held fronted poll to a plan (needs a judge); a
// missing recipient or fronted poll degrades to archive-only; a homed (listed) pile never rises.
// The planner NEVER provisions. Run: node test/custody.test.mjs
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCustody } from "../bin/custody.mjs";
import { attest, generateIdentity, contentId } from "../bin/drop.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const NOW = "2026-07-06T22:00:00.000Z";

const atlasSigner = await generateIdentity();
const owner = await generateIdentity();
const RECIPIENT = "age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg";

const frontedPoll = (over = {}) => attest({ schema: "anecdote.atlaspoll/v1", pile: "orphan", poll: "budget",
  fronts: "colorado", scope: "colorado", instigator: owner.fingerprint, age_recipient: RECIPIENT, ...over }, atlasSigner);

async function scratch({ fronted = [], ballots = [] } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-custody-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: colorado\nscope: colorado\n`);
  writeFileSync(path.join(dir, "_data/piles.yml"), `- id: listed\n  scope: colorado\n`); // a pile I DO list (homed)
  writeFileSync(path.join(dir, "_data/atlaspolls.json"), JSON.stringify(await Promise.all(fronted)));
  for (const spec of ballots) {
    const b = await attest({ schema: "anecdote.ballot/v1", pile: "orphan", poll: "budget", scope: "colorado",
      answer: "Keep", ts: "2026-07-04T18:00:00Z", ...spec }, owner);
    const id = (await contentId(b)).replace(/^sha256:/, "");
    const d = path.join(dir, "_data/drop-archive", b.scope || "_", b.poll);
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, id + ".json"), JSON.stringify(b));
  }
  return dir;
}
// three DISTINCT ballots for the orphan poll (distinct answers -> distinct content-ids -> mass 3)
const three = [{ answer: "A" }, { answer: "B" }, { answer: "C" }];

// 1. honest defaults fire nothing.
{
  const dir = await scratch({ fronted: [frontedPoll()], ballots: three });
  const out = await runCustody(dir, { now: NOW });
  ok(out.plan.length === 0 && out.archiveOnly.length === 0, "default policy (no mass, no scopes) -> nothing rises");
  ok(out.skipped.some((s) => s.pile === "orphan" && s.mass === 3), "the orphan is seen (mass 3) but skipped below threshold");
}

// 2. mass fires -> a plan entry sealed to the owner's recipient, needing a judge.
{
  const dir = await scratch({ fronted: [frontedPoll()], ballots: three });
  const out = await runCustody(dir, { now: NOW, mass: 2 });
  ok(out.plan.length === 1 && out.plan[0].reason === "mass", "mass >= threshold -> rises with reason 'mass'");
  ok(out.plan[0].recipient === RECIPIENT && out.plan[0].instigator === owner.fingerprint && out.plan[0].needs === "judge",
    "the plan carries the owner recipient + instigator and needs a judge (never auto-provisioned)");
}

// 3. scope-fit fires independently of mass.
{
  const dir = await scratch({ fronted: [frontedPoll()], ballots: [{ answer: "solo" }] });
  const out = await runCustody(dir, { now: NOW, scopes: ["colorado"] });
  ok(out.plan.length === 1 && out.plan[0].reason === "scope-fit", "a claimed scope raises the poll on one ballot (scope-fit)");
}

// 4. a homed (listed) pile never rises, even over threshold.
{
  const dir = await scratch({ fronted: [frontedPoll({ pile: "listed" })], ballots: three.map((b) => ({ ...b, pile: "listed" })) });
  const out = await runCustody(dir, { now: NOW, mass: 1 });
  ok(!out.plan.length && out.skipped.some((s) => s.pile === "listed" && /homed/.test(s.why)), "a listed pile is homed -> never custodied");
}

// 5. rises but the fronted poll has no age recipient -> archive-only (nothing to seal to).
{
  const dir = await scratch({ fronted: [frontedPoll({ age_recipient: undefined })], ballots: three });
  const out = await runCustody(dir, { now: NOW, mass: 2 });
  ok(!out.plan.length && out.archiveOnly.length === 1 && /no age recipient/.test(out.archiveOnly[0].why),
    "no recipient in the fronted poll -> archive-only, recorded (not silently custodied)");
}

// 6. rises but no fronted poll at all -> archive-only (cannot verify or seal).
{
  const dir = await scratch({ fronted: [], ballots: three });
  const out = await runCustody(dir, { now: NOW, mass: 2 });
  ok(!out.plan.length && out.archiveOnly.length === 1 && /no verifiable fronted poll/.test(out.archiveOnly[0].why),
    "no fronted poll -> archive-only");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall custody tests passed");
