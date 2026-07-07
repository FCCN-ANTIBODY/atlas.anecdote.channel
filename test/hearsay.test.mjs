// Unit: the Atlas-owned hearsay pile (bin/hearsay.mjs, civic-node#91). The plan turns
// bin/custody's archiveOnly dead-end into candidates — needs a judge, never provisions; honest
// defaults fire nothing. The record appends the PUBLIC keyring: recipients only, never an
// identity, never silently rewritten, idempotent on a true re-record. Run: node test/hearsay.test.mjs
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runHearsayPlan, recordHearsayPile, readKeyring } from "../bin/hearsay.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const NOW = "2026-07-07T22:00:00.000Z";
const RECIPIENT = "age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg";

function scratch({ custodyPlan } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-hearsay-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: colorado\nscope: colorado\n`);
  if (custodyPlan) writeFileSync(path.join(dir, "custody-plan.json"), JSON.stringify(custodyPlan));
  return dir;
}
const archiveOnlyRow = (over = {}) => ({ pile: "orphan", poll: "budget", scope: "colorado", mass: 3,
  reason: "mass", why: "no verifiable fronted poll — cannot verify or seal", ...over });

// 1. honest defaults fire nothing: no custody plan -> no candidates, and the plan says why.
{
  const dir = scratch();
  const out = runHearsayPlan(dir, { now: NOW });
  ok(out.plan.length === 0 && /no custody-plan/.test(out.note), "no custody plan -> empty hearsay plan, reason narrated");
}

// 2. custody's archiveOnly residue rises to a keep candidate — needing a judge, gesture spelled out.
{
  const dir = scratch({ custodyPlan: { archiveOnly: [archiveOnlyRow()] } });
  const out = runHearsayPlan(dir, { now: NOW, owner: "acme" });
  ok(out.plan.length === 1 && out.plan[0].needs === "judge", "an ownerless riser becomes a candidate that needs a judge");
  ok(/--keygen/.test(out.plan[0].gesture.provision) && !/--provisioner/.test(out.plan[0].gesture.provision),
    "the gesture is the OWNER path (pile-new --keygen), never the provisioner path");
  ok(/hearsay record/.test(out.plan[0].gesture.record) && /drop-pack/.test(out.plan[0].gesture.fill),
    "the plan narrates record + fill (the drop channel) so the consent is informed");
  ok(JSON.parse(readFileSync(path.join(dir, "hearsay-plan.json"), "utf8")).schema === "atlas.hearsay-plan/v1",
    "hearsay-plan.json lands with its schema");
}

// 3. record appends the public keyring; a re-record is idempotent; a different key is refused.
{
  const dir = scratch();
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  const args = { id: "orphan-hearsay", pile: "orphan", poll: "budget", scope: "colorado",
    repoUrl: "https://github.com/acme/orphan-hearsay", recipient: RECIPIENT, question: "Keep it?", now: NOW };
  const r1 = recordHearsayPile(dir, args);
  const kept = readKeyring(path.join(dir, "_data/hearsay-piles.yml"));
  ok(!r1.already && kept.length === 1 && kept[0].id === "orphan-hearsay", "record appends the keyring entry");
  ok(kept[0].age_recipient === RECIPIENT && kept[0].provisioner === "self:colorado" &&
     kept[0].provisioner_spec === "data-pile/pile-new/v1" && kept[0].status === "live",
    "the entry carries the public recipient + the self attestation + live status");
  const r2 = recordHearsayPile(dir, args);
  ok(r2.already && readKeyring(path.join(dir, "_data/hearsay-piles.yml")).length === 1, "same id + same recipient -> idempotent no-op");
  let threw = false;
  try { recordHearsayPile(dir, { ...args, recipient: "age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfaff" }); }
  catch { threw = true; }
  ok(threw, "same id with a DIFFERENT recipient is refused — never silently rewritten");
}

// 4. the keyring holds public halves only: a malformed recipient (or an identity) never lands.
{
  const dir = scratch();
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  for (const bad of ["age1short", "AGE-SECRET-KEY-1XXXX", ""]) {
    let threw = false;
    try { recordHearsayPile(dir, { id: "x-hearsay", pile: "x", poll: "y", recipient: bad, now: NOW }); }
    catch { threw = true; }
    ok(threw, `refused a non-recipient on the keyring (${bad ? bad.slice(0, 12) : "empty"})`);
  }
}

// 5. an already-kept question does not rise again.
{
  const dir = scratch({ custodyPlan: { archiveOnly: [archiveOnlyRow()] } });
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  recordHearsayPile(dir, { id: "orphan-hearsay", pile: "orphan", poll: "budget", scope: "colorado", recipient: RECIPIENT, now: NOW });
  const out = runHearsayPlan(dir, { now: NOW });
  ok(out.plan.length === 0 && out.alreadyKept.length === 1, "a kept question is not re-planned (the keyring is the memory)");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall hearsay tests passed");
