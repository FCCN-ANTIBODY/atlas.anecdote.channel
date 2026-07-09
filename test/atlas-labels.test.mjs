// Unit: the LABEL INDEX — bin/atlas-labels.mjs (civic-node #95; "query the Atlas by the same label
// structure it lists its polls under"). Groups the listed Tells + carried needs by componential label
// tokens; "no mask = the whole state"; witnesses, never ranks; signs its own ledger; query reduces the
// same way it listed. Run: node test/atlas-labels.test.mjs
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readRecords, reduceTokens, band, buildLabels, queryLabels, buildLabelIndex } from "../bin/atlas-labels.mjs";
import { verifyAttested } from "../bin/atlas-index.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. the componential reduce: split on any non-alnum (incl. "/"), drop stopwords, dedupe.
{
  ok(JSON.stringify(reduceTokens("social/boardgames")) === JSON.stringify(["social", "boardgames"]), "slash-delimited topic decomposes to components");
  ok(JSON.stringify(reduceTokens("Are you in favor of the Parks?")) === JSON.stringify(["favor", "parks"]), "stopwords drop, components remain: " + reduceTokens("Are you in favor of the Parks?"));
  ok(JSON.stringify(reduceTokens("parks parks PARKS")) === JSON.stringify(["parks"]), "deduped");
}

// 2. band is coarse, never raw.
ok(band(0) === "0" && band(1) === "1" && band(4) === "<10" && band(40) === "10s" && band(400) === "100s", "counts are bands");

// 3. buildLabels: a listed Tell and a carried need group by their components; each label carries its listings.
{
  const tells = [{ id: "foco", name: "Fort Collins Parks", scope: "colorado", url: "https://foco.example", signer: "key:foco" }];
  const needs = [{ id: "boardgame-80525", topic: "social/boardgames", scope: "colorado", need_url: "u", asker_repo: "acme/civic-node" }];
  const { labels, items } = buildLabels({ tells, needs });
  ok(items === 2, "two listed items");
  const parks = labels.find((l) => l.label === "parks");
  ok(parks && parks.listings.some((x) => x.kind === "tell" && x.id === "foco"), "the Tell is discoverable under 'parks'");
  const bg = labels.find((l) => l.label === "boardgames");
  ok(bg && bg.listings.some((x) => x.kind === "need" && x.id === "boardgame-80525"), "the need is discoverable under 'boardgames'");
  // 4. no ranking — labels are ordered by NAME, never by count.
  const names = labels.map((l) => l.label);
  ok(JSON.stringify(names) === JSON.stringify([...names].sort()), "labels sorted by name, not by count (anti-algorithm)");
}

// 5. no mask = the whole state.
{
  const needs = [{ id: "statewide", topic: "housing", scope: "", need_url: "u", asker_repo: "a/b" }];
  const { labels } = buildLabels({ needs });
  const housing = labels.find((l) => l.label === "housing");
  ok(housing.masks.includes("whole-state"), "an item with no scope is listed under the whole state");
}

// 6. query by the SAME structure the Atlas listed under — reduce the query, land on the components.
{
  const tells = [{ id: "foco", name: "Fort Collins Parks", scope: "colorado" }];
  const { labels } = buildLabels({ tells });
  const index = { labels };
  const hits = queryLabels(index, "collins parks");
  ok(hits.length === 2 && hits.every((h) => h.listings.some((x) => x.id === "foco")), "a query reduces the same way and finds the listing: " + hits.map((h) => h.label));
  ok(queryLabels(index, "nothing relevant here").length === 0, "a query with no shared component finds nothing — no false hit");
  // the pluggable reduce is the seam to the real reducer: inject it and 'board games' would meet 'boardgames'.
  const injected = queryLabels(index, "PARKS", (t) => reduceTokens(t));
  ok(injected.length === 1 && injected[0].label === "parks", "the reduce is pluggable (the reducer's kernel can be injected)");
}

// 7. readRecords parses the list-of-maps registries (tells.yml / needs.yml shape).
{
  const yml = `# comment\n- id: a\n  name: "Alpha"\n  scope: colorado\n- id: b\n  topic: social/games\n`;
  const recs = readRecords(yml);
  ok(recs.length === 2 && recs[0].name === "Alpha" && recs[1].topic === "social/games", "list-of-maps parsed, quotes+comments stripped");
  ok(readRecords("- name: no-id\n").length === 0, "a record without an id is dropped");
}

// 8. buildLabelIndex over a scratch Atlas: signed by the ledger, self-named, and empty-safe.
{
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-labels-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  mkdirSync(path.join(dir, "keys"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: scratch\n`);
  // empty registries first
  writeFileSync(path.join(dir, "_data/tells.yml"), "# empty\n");
  writeFileSync(path.join(dir, "_data/needs.yml"), "# empty\n");
  let r = await buildLabelIndex(dir, { now: "2026-07-09T00:00:00Z" });
  ok(r.index.labels.length === 0 && r.items === 0, "empty registries -> empty index (honest, fires nothing)");
  ok((await verifyAttested(r.index)).ok && r.index.self === "scratch", "the empty index is still signed by the ledger, self-named");

  writeFileSync(path.join(dir, "_data/tells.yml"), `- id: foco\n  name: "Fort Collins Parks"\n  scope: colorado\n`);
  writeFileSync(path.join(dir, "_data/needs.yml"), `- id: bg\n  topic: social/boardgames\n  scope: colorado\n  asker_repo: a/b\n`);
  r = await buildLabelIndex(dir, { now: "2026-07-09T00:00:00Z" });
  ok(r.items === 2 && r.index.labels.some((l) => l.label === "parks") && r.index.labels.some((l) => l.label === "boardgames"), "hydrates tells + needs into labels");
  ok((await verifyAttested(r.index)).ok, "the populated index verifies to the ledger signer");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall atlas-labels tests passed");
