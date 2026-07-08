// Unit: the registration drop door (bin/admit.mjs, civic-node#85). The three-rule table over signed
// words: freshness wins and an unstamped word never supersedes (never a freshness nobody stamped);
// a de-listing quell loses to the owner's fresher word and only the owner or this Atlas may quell;
// the first admitted signer owns its coordinates — a competing key is recorded beside, never
// replacing. Resolution is stamp-ordered, so any arrival order lands the same state (replay
// indifference). Run: node test/admit.test.mjs
import { resolveAdmissions, registryRows, REGISTER_QUELL } from "../bin/admit.mjs";
import { attest, generateIdentity, defaultHash, canonicalize } from "../bin/drop.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const te = new TextEncoder();
const T1 = "2026-07-01T00:00:00Z", T2 = "2026-07-05T00:00:00Z", T3 = "2026-07-08T00:00:00Z";

async function proposal(entry, identity, { registry = "tells", at } = {}) {
  const payload = canonicalize({ schema: "anecdote.register/v1", registry, entry, ...(at ? { at } : {}) });
  const u8 = te.encode(payload);
  return attest({ schema: "anecdote.transfer/v1", kind: "registration", size: u8.length,
    hash: await defaultHash(u8), bytes: Buffer.from(u8).toString("base64") }, identity);
}
const quell = (coords, identity) => attest({ schema: REGISTER_QUELL, ...coords }, identity);

const owner = await generateIdentity(), rival = await generateIdentity(), atlasSelf = await generateIdentity();
const TELL = { id: "tell-a", name: "Tell A", url: "https://tell-a.example.org", scope: "colorado", signer: "SHA256:aaa" };

// 1. verify-from-anyone: a tampered word is refused; a stamp that doesn't parse is no stamp.
{
  const p = await proposal(TELL, owner, { at: T1 });
  const doctored = { ...p, bytes: p.bytes.slice(0, -4) + "AAAA" };
  const r = await resolveAdmissions({ proposals: [doctored] });
  ok(r.admitted.length === 0 && r.refused.length === 1, "a tampered proposal is refused");
  const bad = await proposal(TELL, owner, { at: "not-a-date" });
  const r2 = await resolveAdmissions({ proposals: [bad] });
  ok(/no stamp/.test(r2.refused[0].why), "an unparseable stamp refuses the word (never a fake freshness)");
}

// 2. first contact admits; unstamped admits but is marked as carrying no date to win with.
{
  const r = await resolveAdmissions({ proposals: [await proposal(TELL, owner)] });
  ok(r.admitted.length === 1 && r.admitted[0].stamped === false, "an unstamped listing lands on first contact, marked");
  const again = await resolveAdmissions({ proposals: [await proposal({ ...TELL, name: "Tell A v2" }, owner)], ledger: r.state });
  ok(again.stale.length === 1 && /never supersedes/.test(again.stale[0].why) && again.state["tells|colorado|tell-a"].entry.name === "Tell A",
    "an unstamped word never supersedes — the held entry stands");
}

// 3. freshness wins among the owner's stamped words; older and equal never regress.
{
  let { state } = await resolveAdmissions({ proposals: [await proposal(TELL, owner, { at: T2 })] });
  const newer = await resolveAdmissions({ proposals: [await proposal({ ...TELL, name: "Tell A fresh" }, owner, { at: T3 })], ledger: state });
  ok(newer.superseded.length === 1 && newer.state["tells|colorado|tell-a"].entry.name === "Tell A fresh", "the owner's fresher word supersedes");
  const older = await resolveAdmissions({ proposals: [await proposal({ ...TELL, name: "Tell A stale" }, owner, { at: T1 })], ledger: newer.state });
  ok(older.stale.length === 1 && older.state["tells|colorado|tell-a"].entry.name === "Tell A fresh", "an older stamp never regresses the record");
}

// 4. the quell: owner or self de-lists; freshness arbitrates; a third party never does.
{
  let { state } = await resolveAdmissions({ proposals: [await proposal(TELL, owner, { at: T1 })] });
  const q = await resolveAdmissions({ quells: [await quell({ registry: "tells", id: "tell-a", scope: "colorado", ts: T2 }, owner)], ledger: state });
  ok(q.deListed.length === 1 && q.state["tells|colorado|tell-a"].status === "de-listed", "the owner's quell de-lists");
  const relist = await resolveAdmissions({ proposals: [await proposal(TELL, owner, { at: T3 })], ledger: q.state });
  ok(relist.admitted.length === 1 && relist.admitted[0].relisted === true && relist.state["tells|colorado|tell-a"].status === "listed",
    "the owner's fresher word supersedes the quell — de-listing is a claim like any other");
  const staleQ = await resolveAdmissions({ quells: [await quell({ registry: "tells", id: "tell-a", scope: "colorado", ts: T2 }, owner)], ledger: relist.state });
  ok(staleQ.stale.length === 1 && staleQ.state["tells|colorado|tell-a"].status === "listed", "a quell older than the listed word loses");
  const third = await resolveAdmissions({ quells: [await quell({ registry: "tells", id: "tell-a", scope: "colorado", ts: "2026-07-09T00:00:00Z" }, rival)], ledger: relist.state });
  ok(third.refused.length === 1 && /third party/.test(third.refused[0].why), "a third party never de-lists another's entry");
  const selfQ = await resolveAdmissions({ quells: [await quell({ registry: "tells", id: "tell-a", scope: "colorado", ts: "2026-07-09T00:00:00Z" }, atlasSelf)],
    ledger: relist.state, self: [atlasSelf.fingerprint] });
  ok(selfQ.deListed.length === 1, "this Atlas may quell its OWN copy — retention is per-copy");
}

// 5. ownership: a competing key's claim is recorded beside the owner's, never replacing it.
{
  const { state } = await resolveAdmissions({ proposals: [await proposal(TELL, owner, { at: T1 })] });
  const r = await resolveAdmissions({ proposals: [await proposal({ ...TELL, url: "https://evil.example.org" }, rival, { at: T3 })], ledger: state });
  ok(r.competing.length === 1 && r.competing[0].owner === owner.fingerprint && r.competing[0].claimant === rival.fingerprint,
    "the competing claim is recorded, named");
  ok(r.state["tells|colorado|tell-a"].entry.url === TELL.url, "the owner's entry stands untouched");
}

// 6. replay indifference: any arrival order of the same stamped words lands the same state.
{
  const words = [
    await proposal(TELL, owner, { at: T1 }),
    await proposal({ ...TELL, name: "Tell A fresh" }, owner, { at: T3 }),
  ];
  const qs = [await quell({ registry: "tells", id: "tell-a", scope: "colorado", ts: T2 }, owner)];
  const fwd = await resolveAdmissions({ proposals: words, quells: qs });
  const rev = await resolveAdmissions({ proposals: [...words].reverse(), quells: qs });
  ok(JSON.stringify(fwd.state) === JSON.stringify(rev.state) && fwd.state["tells|colorado|tell-a"].status === "listed" &&
     fwd.state["tells|colorado|tell-a"].entry.name === "Tell A fresh",
    "shuffled arrivals resolve to one state: listed under the freshest word, the mid-stamp quell superseded");
}

// 7. the rows a consenting merge would land: listed-only, per registry, sorted.
{
  const { state } = await resolveAdmissions({ proposals: [
    await proposal(TELL, owner, { at: T1 }),
    await proposal({ id: "need-1", asker_repo: "acme/x", scope: "colorado", topic: "water" }, rival, { at: T1, registry: "needs" }),
  ] });
  const withQuell = await resolveAdmissions({ quells: [await quell({ registry: "tells", id: "tell-a", scope: "colorado", ts: T2 }, owner)], ledger: state });
  const rows = registryRows(withQuell.state);
  ok(!rows.tells && rows.needs?.length === 1, "de-listed entries leave the rows; other registries stand");
}

// 8. a quell for nothing listed is refused, named.
{
  const r = await resolveAdmissions({ quells: [await quell({ registry: "tells", id: "ghost", scope: "colorado", ts: T1 }, owner)] });
  ok(r.refused.length === 1 && /nothing listed/.test(r.refused[0].why), "a quell for nothing listed is refused");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall admit tests passed");
