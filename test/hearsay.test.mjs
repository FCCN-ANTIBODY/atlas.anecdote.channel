// Unit: the Atlas-owned hearsay pile (bin/hearsay.mjs, civic-node#91). The plan turns
// bin/custody's archiveOnly dead-end into candidates — needs a judge, never provisions; honest
// defaults fire nothing. The record appends the PUBLIC keyring: recipients only, never an
// identity, never silently rewritten, idempotent on a true re-record. Many doors may share one
// tank (join inherits the tank's public halves), and a kept question fronts under our own
// signature as a verifiable anecdote.atlaspoll/v1. Run: node test/hearsay.test.mjs
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runHearsayPlan, recordHearsayPile, frontQuestion, readKeyring } from "../bin/hearsay.mjs";
import { runCustody, verifyAtlasPoll, custodyRecipient } from "../bin/custody.mjs";
import { attest, generateIdentity, contentId } from "../bin/drop.mjs";

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

// 6. many doors, one tank: joining inherits the tank's public halves; mismatches are refused.
{
  const dir = scratch();
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  recordHearsayPile(dir, { id: "colorado-hearsay", pile: "orphan", poll: "budget", scope: "colorado",
    repoUrl: "https://github.com/acme/colorado-hearsay", recipient: RECIPIENT, now: NOW });
  const r = recordHearsayPile(dir, { id: "colorado-hearsay", pile: "stray", poll: "parks", scope: "colorado", now: NOW });
  const kept = readKeyring(path.join(dir, "_data/hearsay-piles.yml"));
  ok(r.joined === true && kept.length === 2, "a second question joins the tank as a new door");
  ok(kept[1].age_recipient === RECIPIENT && kept[1].repo_url === "https://github.com/acme/colorado-hearsay",
    "the door inherits the tank's recipient + repo (omit --recipient to join)");
  let threw = false;
  try { recordHearsayPile(dir, { id: "colorado-hearsay", pile: "third", poll: "q",
    recipient: "age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfaff", now: NOW }); }
  catch { threw = true; }
  ok(threw, "a door naming a DIFFERENT recipient than its tank is refused");
  const again = recordHearsayPile(dir, { id: "colorado-hearsay", pile: "stray", poll: "parks", now: NOW });
  ok(again.already === true && readKeyring(path.join(dir, "_data/hearsay-piles.yml")).length === 2,
    "re-recording an existing door is an idempotent no-op");
}

// 7. the plan offers the JOIN gesture when a live tank exists in the candidate's scope.
{
  const dir = scratch({ custodyPlan: { archiveOnly: [archiveOnlyRow()] } });
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  recordHearsayPile(dir, { id: "colorado-hearsay", pile: "earlier", poll: "q", scope: "colorado", recipient: RECIPIENT, now: NOW });
  const out = runHearsayPlan(dir, { now: NOW, owner: "acme" });
  ok(out.plan.length === 1 && /--id colorado-hearsay/.test(out.plan[0].gesture.join || ""),
    "a live tank in scope surfaces as the join gesture (the judge picks join vs provision)");
  ok(/hearsay front/.test(out.plan[0].gesture.front), "the front gesture rides every candidate");
}

// 8. front: a kept question re-publishes as a VERIFIABLE self-fronted atlaspoll; re-front is stable.
{
  const dir = scratch();
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  mkdirSync(path.join(dir, "keys"), { recursive: true });
  recordHearsayPile(dir, { id: "orphan-hearsay", pile: "orphan", poll: "budget", scope: "colorado",
    repoUrl: "https://github.com/acme/orphan-hearsay", recipient: RECIPIENT, now: NOW });
  const { signed, fingerprint } = await frontQuestion(dir, { pile: "orphan", poll: "budget" });
  const v = await verifyAtlasPoll(signed, { lineage: [fingerprint] });
  ok(v.ok && v.trusted && v.by === fingerprint, "the minted atlaspoll verifies (ok from anyone; trusted in our own lineage)");
  ok(custodyRecipient(signed) === RECIPIENT && signed.fronts === "colorado" && signed.scope === "colorado",
    "it carries the keep's recipient as the custody target, fronted by this Atlas");
  ok(readFileSync(path.join(dir, "keys/front.fpr"), "utf8").trim() === fingerprint, "the public fingerprint rides at keys/front.fpr");
  const held1 = JSON.parse(readFileSync(path.join(dir, "_data/atlaspolls.json"), "utf8"));
  await frontQuestion(dir, { pile: "orphan", poll: "budget" });
  const held2 = JSON.parse(readFileSync(path.join(dir, "_data/atlaspolls.json"), "utf8"));
  ok(held1.length === 1 && held2.length === 1 && JSON.stringify(held1) === JSON.stringify(held2),
    "re-fronting replaces our own prior front byte-for-byte (deterministic ed25519), never duplicates");
  let threw = false;
  try { await frontQuestion(dir, { pile: "never-kept", poll: "q" }); } catch { threw = true; }
  ok(threw, "fronting a question the keyring does not keep is refused");
}

// 9. no self-loop: our own front + keyring never raises our kept question back into custody.
{
  const dir = scratch();
  writeFileSync(path.join(dir, "_data/hearsay-piles.yml"), "# keyring\n");
  writeFileSync(path.join(dir, "_data/piles.yml"), "- id: listed\n  scope: colorado\n");
  mkdirSync(path.join(dir, "keys"), { recursive: true });
  recordHearsayPile(dir, { id: "orphan-hearsay", pile: "orphan", poll: "budget", scope: "colorado", recipient: RECIPIENT, now: NOW });
  await frontQuestion(dir, { pile: "orphan", poll: "budget" });
  // three distinct archived ballots for the kept question, plus a low custody threshold: without
  // the keyring skip, the self-fronted poll (recipient riding) would rise straight into the plan.
  const voter = await generateIdentity();
  for (const answer of ["A", "B", "C"]) {
    const b = await attest({ schema: "anecdote.ballot/v1", pile: "orphan", poll: "budget", scope: "colorado",
      answer, ts: "2026-07-04T18:00:00Z" }, voter);
    const d = path.join(dir, "_data/drop-archive/colorado/budget");
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, (await contentId(b)).replace(/^sha256:/, "") + ".json"), JSON.stringify(b));
  }
  const out = await runCustody(dir, { now: NOW, mass: 1 });
  ok(out.plan.length === 0 && out.archiveOnly.length === 0 &&
     out.skipped.some((s) => s.pile === "orphan" && /kept — a hearsay pile/.test(s.why)),
    "custody skips a keyring-kept question as homed — the front never loops back into a stand-in plan");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall hearsay tests passed");
