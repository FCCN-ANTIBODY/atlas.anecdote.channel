// Unit: the atlas-of-atlases INDEX — bin/dump one floor up. The peer directory (_data/atlases.yml, what
// bin/register-atlas populates) hydrates into ONE signed, catchable atlases.json: the reference root a
// walker lands on, its neighbors' addresses carried VERBATIM. Holds the promises: relays (never ranks or
// dedupes), leases (an optional `renewed` date; past-window → expired, undated → listed with stale:null,
// never a silent drop), signs its own LEDGER. Run: node test/atlas-index.test.mjs
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readPeers, buildIndex, verifyAttested } from "../bin/atlas-index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const NOW = "2026-07-02T22:00:00.000Z";

// a scratch Atlas that knows a few peers: one fresh-dated, one stale-dated, one undated (the current seed
// shape), one malformed stub with no id (must be dropped).
function scratchAtlas() {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-index-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  mkdirSync(path.join(dir, "keys"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: colorado\nname: "Colorado Atlas"\nurl: "https://atlas.anecdote.channel"\nscope: colorado\n`);
  writeFileSync(path.join(dir, "_data/atlases.yml"),
    `# a directory of peers\n` +
    `- id: wyoming\n  name: "Wyoming Atlas"\n  url: "https://atlas.wy.example"\n  repo: wy/atlas\n  scope: "wyoming"\n  signer: "SHA256:wy-fpr"\n  reports: "reports/aggregate-*"\n  renewed: "2026-06-20T00:00:00Z"\n` +
    `- id: kansas\n  name: "Kansas Atlas"\n  url: "https://atlas.ks.example"\n  repo: ks/atlas\n  scope: "kansas"\n  signer: "SHA256:ks-fpr"\n  renewed: "2025-12-01T00:00:00Z"\n` +   // STALE (>90d)
    `- id: neighbor\n  name: "Neighbor (undated seed)"\n  url: "https://atlas.example.org"\n  repo: example-org/atlas\n  scope: "utah"\n  signer: "SHA256:PLACEHOLDER"\n` +          // no renewed → listed, stale:null
    `- name: "no id — malformed stub"\n  url: "https://nope.example"\n`);                                                                                                          // dropped
  process.env.ATLAS_DUMP_KEY = path.join(dir, "keys/index-test.pk8");
  return dir;
}

// 1. the directory reader: scalar-only maps, quotes stripped, comments ignored, id-less stub dropped.
{
  const peers = readPeers(readFileSync(path.join(scratchAtlas(), "_data/atlases.yml"), "utf8"));
  ok(peers.length === 3 && peers.map((p) => p.id).join(",") === "wyoming,kansas,neighbor", "reads exactly the id-bearing entries (the malformed stub is dropped)");
  ok(peers[0].url === "https://atlas.wy.example" && peers[0].signer === "SHA256:wy-fpr" && peers[0].scope === "wyoming", "each scalar field parses, quotes stripped, verbatim");
}

// 2. the build: signed ledger, self identity, the SET, verbatim relay.
{
  const dir = scratchAtlas();
  const { index, signer, self } = await buildIndex(dir, { windowDays: 90, now: NOW });
  const v = await verifyAttested(index);
  ok(v.ok && v.by === signer.fingerprint, "the index itself is attested — the Atlas signs its LEDGER, one fingerprint for all it publishes");
  ok(index.schema === "anecdote.atlas-index/v1" && index.self === "colorado" && self.id === "colorado", "the index names the serving Atlas — the reference root a walker lands on");
  const wy = index.atlases.find((a) => a.id === "wyoming");
  ok(wy && wy.url === "https://atlas.wy.example" && wy.signer === "SHA256:wy-fpr" && wy.repo === "wy/atlas", "a peer is carried VERBATIM (url/signer/repo the walk needs, the pin a catcher checks)");
  ok(index.atlasIds.length === index.atlases.length && index.atlasIds.every((id, i) => index.atlases[i].id === id), "atlasIds is the SET at a glance — the URLs 'fetch the world' walks, aligned with the entries");
}

// 3. the lease: fresh listed with stale:false, undated listed with stale:null, stale-dated → expired (recorded, not dropped).
{
  const dir = scratchAtlas();
  const { index } = await buildIndex(dir, { windowDays: 90, now: NOW });
  const wy = index.atlases.find((a) => a.id === "wyoming");
  ok(wy && wy.stale === false && wy.renewed === "2026-06-20T00:00:00Z", "a fresh `renewed` date → listed, stale: false (the heartbeat)");
  const nb = index.atlases.find((a) => a.id === "neighbor");
  ok(nb && nb.stale === null && nb.renewed === null, "an undated peer is LISTED on presence with stale: null — honest absence, never dropped");
  ok(!index.atlases.some((a) => a.id === "kansas") && index.expired.some((e) => e.id === "kansas" && e.renewed === "2025-12-01T00:00:00Z"),
     "a `renewed` date past the window drops from the listing into `expired`, its last date recorded — never a silent disappearance");
}

// 4. additive + deterministic: no ranking, sorted by id, same directory → same index.
{
  const dir = scratchAtlas();
  const a = await buildIndex(dir, { windowDays: 90, now: NOW });
  const b = await buildIndex(dir, { windowDays: 90, now: NOW });
  ok(JSON.stringify(a.index.atlasIds) === JSON.stringify(b.index.atlasIds) && a.index.atlasIds.join(",") === "neighbor,wyoming", "listed peers are sorted by id (no authority ordering) and the build is deterministic");
}

// 5. cross-repo, guarded: the client's constituency consumer can read this index's urls to 'fetch the world'.
// It is atlases[].url that constituency.mjs's fetchDumps walks; assert the shape it depends on is present.
{
  const dir = scratchAtlas();
  const { index } = await buildIndex(dir, { windowDays: 90, now: NOW });
  const urls = index.atlases.map((a) => a.url).filter(Boolean);
  ok(urls.length === index.atlases.length && urls.every((u) => /^https?:\/\//.test(u)), "every listed peer carries a fetchable url — the exact list the client's 'fetch the world' walks to each boundaries.json");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall atlas-index tests passed");
