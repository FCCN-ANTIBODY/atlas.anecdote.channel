// Unit: the Atlas dump — the canon as one signed artifact. The two calls it makes: `listed` from renewal
// freshness (the lease; same-key rule), `anchored` — an OBSERVATION, never a gate — from ONE point test
// of a member's DECLARED anchor against the Atlas's own shape (membership is the declared filing). The call it refuses: polygon-vs-polygon containment — THE WATERSHED
// RULE says every listed shape ships and bisects no matter where its center lives, and no rounding sliver
// can exile a member. Run: node test/dump.test.mjs
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attest, verifyAttested, contentId, contains, buildDump, loadOrCreateSigner } from "../bin/dump.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = "2026-07-02T21:00:00.000Z";

async function freshKey(dir, name) { return loadOrCreateSigner(path.join(dir, name + ".pk8"), { create: true }); }
const boundary = (constituency, polygons, extra = {}) => ({ schema: "anecdote.boundary/v1", constituency, name: constituency, polygons, basis: [{ kind: "asserted" }], ...extra });
const renewal = (id, at) => ({ schema: "anecdote.boundary-renewal/v1", boundary: id, at });

// one scratch Atlas with the full cast of characters
async function scratchAtlas() {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-dump-"));
  const bdir = path.join(dir, "_data/boundaries");
  writeFileSync(path.join(dir, "atlas.yml"), "id: testlas\nscope: colorado\n");
  mkdirSync(path.join(bdir, "tellA/renewals"), { recursive: true });
  mkdirSync(path.join(bdir, "tellB/renewals"), { recursive: true });
  process.env.ATLAS_DUMP_KEY = path.join(dir, "keys/dump-test.pk8");

  const stateKey = await freshKey(dir, "state");
  const aKey = await freshKey(dir, "a");
  const bKey = await freshKey(dir, "b");
  const impostor = await freshKey(dir, "imp");

  // the Atlas's own shape: "Colorado", a 0..100 square
  const self = await attest(boundary("colorado", [[[[0, 0], [100, 0], [100, 100], [0, 100]]]]), stateKey);
  writeFileSync(path.join(bdir, "self.json"), JSON.stringify(self));

  // tellA: a county squarely inside, center declared inside → bounded true
  const county = await attest(boundary("county-a", [[[[10, 10], [30, 10], [30, 30], [10, 30]]]], { center: [20, 20] }), aKey);
  const countyId = await contentId(county);
  writeFileSync(path.join(bdir, "tellA/county-a.json"), JSON.stringify(county));
  writeFileSync(path.join(bdir, "tellA/renewals/county-a.json"), JSON.stringify(await attest(renewal(countyId, "2026-06-20T00:00:00Z"), aKey)));

  // tellA: a member whose renewal is STALE (200 days old) → expired, not shipped
  const stale = await attest(boundary("county-stale", [[[[40, 10], [60, 10], [60, 30], [40, 30]]]], { center: [50, 20] }), aKey);
  const staleId = await contentId(stale);
  writeFileSync(path.join(bdir, "tellA/county-stale.json"), JSON.stringify(stale));
  writeFileSync(path.join(bdir, "tellA/renewals/county-stale.json"), JSON.stringify(await attest(renewal(staleId, "2025-12-01T00:00:00Z"), aKey)));

  // tellB: THE WATERSHED — center of mass OUTSIDE colorado (at [140,50]) but the shape SPILLS well inside
  const watershed = await attest(boundary("watershed-p", [[[[60, 40], [160, 40], [160, 60], [60, 60]]]], { center: [140, 50] }), bKey);
  const watershedId = await contentId(watershed);
  writeFileSync(path.join(bdir, "tellB/watershed.json"), JSON.stringify(watershed));
  writeFileSync(path.join(bdir, "tellB/renewals/watershed.json"), JSON.stringify(await attest(renewal(watershedId, "2026-06-25T00:00:00Z"), bKey)));

  // tellB: a fresh renewal signed by the WRONG key — must not count (no silent signer swap)
  const swapped = await attest(boundary("county-swapped", [[[[70, 10], [90, 10], [90, 30], [70, 30]]]], { center: [80, 20] }), bKey);
  const swappedId = await contentId(swapped);
  writeFileSync(path.join(bdir, "tellB/county-swapped.json"), JSON.stringify(swapped));
  writeFileSync(path.join(bdir, "tellB/renewals/county-swapped.json"), JSON.stringify(await attest(renewal(swappedId, "2026-07-01T00:00:00Z"), impostor)));

  // tellB: a PROPOSAL — the shape they wish tellA had; never a member
  const wish = await attest(boundary("county-a", [[[[10, 10], [32, 10], [32, 32], [10, 32]]]], { center: [21, 21], proposes: { for: "county-a", replaces: countyId } }), bKey);
  writeFileSync(path.join(bdir, "tellB/wish-county-a.json"), JSON.stringify(wish));
  writeFileSync(path.join(bdir, "tellB/renewals/wish.json"), JSON.stringify(await attest(renewal(await contentId(wish), "2026-07-01T00:00:00Z"), bKey)));

  // tellB: a bent artifact → refused with reasons
  const bent = JSON.parse(JSON.stringify(county)); bent.constituency = "county-forged";
  writeFileSync(path.join(bdir, "tellB/bent.json"), JSON.stringify(bent));

  // an artifact with NO declared center → bounded: null, still shipped
  const nocenter = await attest(boundary("district-nc", [[[[10, 40], [30, 40], [30, 60], [10, 60]]]]), aKey);
  writeFileSync(path.join(bdir, "tellA/district-nc.json"), JSON.stringify(nocenter));
  writeFileSync(path.join(bdir, "tellA/renewals/district-nc.json"), JSON.stringify(await attest(renewal(await contentId(nocenter), "2026-06-28T00:00:00Z"), aKey)));

  return { dir, ids: { countyId, staleId, watershedId, swappedId } };
}

// 1–6: the whole cast, one build.
{
  const { dir, ids } = await scratchAtlas();
  const { dump, signer } = await buildDump(dir, { windowDays: 90, now: NOW });

  const v = await verifyAttested(dump);
  ok(v.ok && v.by === signer.fingerprint, "the dump itself is attested — the Atlas signs its LEDGER");
  ok(dump.atlas === "testlas" && dump.boundary && dump.windowDays === 90, "the dump names its atlas, its own shape, and the window it applied");

  const by = (slug) => dump.members.find((m) => m.artifact.constituency === slug);
  ok(by("county-a") && by("county-a").anchored === true, "a county with its declared anchor inside → anchored: true (one point test, an observation)");
  ok(by("watershed-p") && by("watershed-p").anchored === false,
     "THE WATERSHED: anchor outside → anchored: false, a DESCRIPTION not a demerit — LISTED and SHIPPED all the same");
  ok(by("district-nc") && by("district-nc").anchored === null, "no declared anchor → anchored: null, recorded honestly, still shipped");

  ok(!by("county-stale") && dump.expired.some((e) => e.id === ids.staleId && e.lastRenewal),
     "a stale lease drops from the listing — recorded in expired with its last renewal, never silently");
  ok(!by("county-swapped") && dump.expired.some((e) => e.id === ids.swappedId && e.lastRenewal === null),
     "a renewal from the WRONG key renews nothing (no silent signer swap) — expired with lastRenewal: null");
  ok(dump.proposals.length === 1 && dump.proposals[0].artifact.proposes.for === "county-a" && !by("county-forged"),
     "a proposal ships in its OWN section — a wish never joins the canon of claims");
  ok(dump.refused.length === 1 && /signature/.test(dump.refused[0].errors[0]), "a bent artifact is refused with the reason");
  ok(dump.memberIds.length === dump.members.length && dump.memberIds.every((id, i) => dump.members[i].id === id),
     "memberIds is the SET at a glance, aligned with the members");

  // THE WATERSHED RULE, exercised: a body standing at [70,50] — inside colorado, inside the spill —
  // bisects into the watershed whose center lives outside any line we would draw.
  const hit = dump.members.filter((m) => contains(m.artifact.polygons, [70, 50])).map((m) => m.artifact.constituency);
  ok(hit.includes("watershed-p"), "a body inside the spill bisects INTO the watershed regardless of its center");

  // determinism: same intake, same set
  const again = await buildDump(dir, { windowDays: 90, now: NOW });
  ok(JSON.stringify(again.dump.memberIds) === JSON.stringify(dump.memberIds), "same intake → same set, same order");
}

// 7. cross-repo, guarded: the REAL tell-compiled colorado-4 flows through intake; the REAL client
// (composer/bisect.mjs) verifies the dump signature and bisects the dump's shapes.
{
  const tellRepo = path.resolve(ROOT, "../tell.anecdote.channel");
  const sibling = path.resolve(ROOT, "../anecdote.channel/composer");
  if (existsSync(path.join(tellRepo, "boundaries/compiled/colorado-4.json")) && existsSync(path.join(sibling, "bisect.mjs"))) {
    const dir = mkdtempSync(path.join(tmpdir(), "atlas-real-"));
    writeFileSync(path.join(dir, "atlas.yml"), "id: atlas\nscope: colorado\n");
    const bdir = path.join(dir, "_data/boundaries/tell");
    mkdirSync(path.join(bdir, "renewals"), { recursive: true });
    process.env.ATLAS_DUMP_KEY = path.join(dir, "dump-test.pk8");
    const c4 = JSON.parse(readFileSync(path.join(tellRepo, "boundaries/compiled/colorado-4.json"), "utf8"));
    writeFileSync(path.join(bdir, "colorado-4.json"), JSON.stringify(c4));
    const { verifyBoundary, bisect } = await import(path.join(sibling, "bisect.mjs"));
    const { verifyAttestation } = await import(path.join(sibling, "sign.mjs"));

    // Always: the REAL client verifies the COMMITTED artifact and bisects it — no key needed. This is the
    // cross-repo agreement check (composer/bisect.mjs and our vendored core accept the very same bytes).
    const vb = await verifyBoundary(c4);
    const placed = await bisect([-103.5, 39.5], [c4]);
    ok(vb.ok && placed.length === 1 && placed[0].constituency === "colorado-4",
       "the REAL client verifies the committed colorado-4 and bisects the eastern plains into it");

    // The LISTING leg needs a renewal from the artifact's OWN key. It runs only when this workspace holds a
    // boundary key whose fingerprint matches the committed signer — a re-key leaves the old local key behind,
    // so we skip honestly rather than sign a mismatched renewal the same-key rule would (correctly) reject.
    const tellKeyPath = path.join(tellRepo, "keys/boundary-signer.pk8");
    const tellKey = existsSync(tellKeyPath) ? await loadOrCreateSigner(tellKeyPath) : null;
    if (tellKey && tellKey.fingerprint === c4.sig.by) {
      writeFileSync(path.join(bdir, "renewals/colorado-4.json"),
        JSON.stringify(await attest(renewal(await contentId(c4), "2026-07-01T00:00:00Z"), tellKey)));
      const { dump } = await buildDump(dir, { windowDays: 90, now: NOW });
      ok((await verifyAttestation(dump, {})).ok, "the REAL client verifies the dump's signature (vendored core and composer agree)");
      const m = dump.members.find((x) => x.artifact.constituency === "colorado-4");
      // colorado-4 DOES declare an anchor now; `anchored` is null here only because this dump holds no self
      // shape to test the declared point against (buildDump: self && center ? contains : null).
      ok(!!m && m.anchored === null, "the real colorado-4 is LISTED off its real-key renewal (anchored null — this dump holds no self shape to test the anchor against)");
    } else {
      console.log("  ok: (list leg SKIPPED — no local tell key matching the committed signer" + (tellKey ? "; re-keyed" : "") + ")");
    }
  } else {
    console.log("  ok: (cross-repo leg SKIPPED — sibling checkouts not present)");
  }
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall dump tests passed");
