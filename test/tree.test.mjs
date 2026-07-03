// Unit: the timestamped heartbeat tree. Signed up-pointing above-edges hydrate into a public plain-text +
// JSON org tree with a last-refreshed stamp at every level. Holds the three locked rules: structure is a
// POSITION not a value (only a verified anecdote.above/v1 `parent` is an edge; `as` never walks); the edge
// is LEASED and DATED (stale = derelict, shown in place); disjoint branches reach OFF-MAP, additive not
// broken. Run: node test/tree.test.mjs
import { attest, verifyAbove, makeAbove, makeCalls, verifyCalls, buildForest, renderText, renderJSON, loadOrCreateSigner, signReport, verifyReport, readSubtrees, graftSubtrees, ABOVE, CALLS, TREE } from "../bin/tree.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const NOW = "2026-07-02T22:00:00.000Z";
const dir = mkdtempSync(path.join(tmpdir(), "atlas-tree-"));
let n = 0;
const key = () => loadOrCreateSigner(path.join(dir, "k" + n++ + ".pk8"), { create: true });

// a small church-ish world: a worldwide org that does nothing, two dioceses under it, parishes under those,
// and a rowdy modernist parish pointing at a parent this atlas does NOT hold (off-map).
const church = await key();     // top org — signs no edge of its own (does nothing; followers attach)
const dioceseA = await key();
const dioceseB = await key();
const parish1 = await key();
const parish2 = await key();
const modernist = await key();
const offmapOrg = await key();  // never resident here

const mk = async (signer, child, parent, as, at) => (await makeAbove({ child, parent, as, at }, signer));
const edges = [
  await mk(dioceseA, "diocese-north", church.fingerprint, "diocese", "2026-06-30T00:00:00Z"),
  await mk(dioceseB, "diocese-south", church.fingerprint, "diocese", "2026-01-01T00:00:00Z"), // STALE (>180d)
  await mk(parish1, "st-anne", dioceseA.fingerprint, "parish", "2026-06-29T00:00:00Z"),
  await mk(parish2, "st-mark", dioceseA.fingerprint, "parish", "2026-06-28T00:00:00Z"),
  await mk(modernist, "new-light", offmapOrg.fingerprint, "we-say-so", "2026-06-30T00:00:00Z"),
];
const residents = [church.fingerprint, dioceseA.fingerprint, dioceseB.fingerprint, parish1.fingerprint, parish2.fingerprint, modernist.fingerprint];

// 1. the edge: verifies, surfaces structural facts, and `as` is just a string.
{
  const v = await verifyAbove(edges[0]);
  ok(v.ok && v.parent === church.fingerprint && v.child === "diocese-north" && v.as === "diocese", "an above-edge verifies and surfaces parent/child/as");
  ok(v.by === dioceseA.fingerprint, "the node identity is the SIGNER fingerprint (up-pointing, signed by the one attaching itself)");
  // bend the last char to a GUARANTEED-different one — replacing with a fixed "0" is a no-op ~1/16 of the
  // time (when the random fingerprint already ends in "0"), which made this assertion flaky.
  const bent = JSON.parse(JSON.stringify(edges[0]));
  bent.parent = church.fingerprint.slice(0, -1) + (church.fingerprint.endsWith("0") ? "1" : "0");
  ok(!(await verifyAbove(bent)).ok, "a bent parent reference fails the signature");
}

// 2. STRUCTURE IS A POSITION, NOT A VALUE — the walker only ever reads `parent` of a verified above-edge.
{
  // a non-above artifact that tries to LOOK structural: an `as` literally saying "above", a stray parent-ish key.
  const impostor = await attest({ schema: "anecdote.note/v1", parent: dioceseA.fingerprint, as: "above", above: church.fingerprint }, parish1);
  const v = await verifyAbove(impostor);
  ok(!v.ok, "a non-above schema is NOT an edge, even if it carries a `parent`/`above`-looking field");
  // and within a real edge, `as` is carried but never forms an edge
  const f = buildForest([await mk(parish1, "st-anne", dioceseA.fingerprint, "above", NOW)], { residents, windowDays: 180, now: NOW });
  const p = f.nodes.get(parish1.fingerprint);
  ok(p.edge.parent === dioceseA.fingerprint && p.edge.as === "above", "`as` may even be the word 'above' — it is a name, carried, never walked into an edge");
}

// 3. the forest: the walk both directions, the top org as a root, the heartbeat stamp.
{
  const f = buildForest(edges, { residents, windowDays: 180, now: NOW });
  const churchNode = f.roots.find((r) => r.key === church.fingerprint);
  ok(churchNode && churchNode.children.length === 2, "the worldwide org that signs nothing is a ROOT with its dioceses under it (structure knits from below)");
  const dioNorth = churchNode.children.find((c) => c.key === dioceseA.fingerprint);
  ok(dioNorth && dioNorth.children.map((c) => c.label).sort().join(",") === "st-anne,st-mark", "down-the-chain: both parishes hydrate under diocese-north");
  ok(dioNorth.edge.fresh === true && dioNorth.edge.as === "diocese", "a fresh edge carries its heartbeat ♥ and its human name");
}

// 4. THE HEARTBEAT — a stale edge is marked derelict and STILL SHOWN (never a silent disappearance).
{
  const f = buildForest(edges, { residents, windowDays: 180, now: NOW });
  ok(f.stale === 1, "exactly one edge is stale past the 180d window");
  const dioSouth = f.roots.find((r) => r.key === church.fingerprint).children.find((c) => c.key === dioceseB.fingerprint);
  ok(dioSouth && dioSouth.edge.fresh === false, "diocese-south's lapsed edge is present but marked NOT fresh — dereliction visible in place");
  ok(renderText(f).includes("✗ STALE"), "the plain-text tree shows the stale marker inline");
}

// 5. DISJOINT / OFF-MAP — a child whose declared parent this atlas doesn't hold reaches off, additive.
{
  const f = buildForest(edges, { residents, windowDays: 180, now: NOW });
  const off = f.roots.find((r) => r.offMap);
  ok(off && off.key === offmapOrg.fingerprint, "the unheld parent becomes an OFF-MAP placeholder root");
  ok(off.children.length === 1 && off.children[0].label === "new-light", "the modernist parish hangs under it — the branch reaches off, not broken");
  ok(renderText(f).includes("reaches off this atlas"), "the text says the branch reaches off");
}

// 6. renewal wins by date; both outputs render; JSON mirrors the text.
{
  const older = await mk(dioceseA, "diocese-north", church.fingerprint, "diocese", "2026-05-01T00:00:00Z");
  const newer = await mk(dioceseA, "diocese-north-RENAMED", church.fingerprint, "archdiocese", "2026-06-30T00:00:00Z");
  const f = buildForest([older, newer], { residents, windowDays: 365, now: NOW });
  const dio = f.nodes.get(dioceseA.fingerprint);
  ok(dio.label === "diocese-north-RENAMED" && dio.edge.as === "archdiocese", "the LATEST edge per signer wins (renewal is the lease heartbeat)");
  const j = renderJSON(f);
  ok(j.schema === "anecdote.atlas-tree/v1" && j.roots.length === f.roots.length && typeof renderText(f) === "string", "both plain-text and JSON render from the same forest");
}

// 7. THE NAME FALLS FROM ABOVE — a superior's calls-record is the authoritative name, but ONLY when the
// signer is the parent the child actually files under. Anyone else naming the child is garbage-grade.
{
  // the church names diocese-north "Archdiocese of the North"; the child's own moniker was "diocese-north".
  const call = await makeCalls({ child: dioceseA.fingerprint, name: "Archdiocese of the North", at: NOW }, church);
  const cv = await verifyCalls(call);
  ok(cv.ok && cv.by === church.fingerprint && cv.child === dioceseA.fingerprint && cv.name === "Archdiocese of the North", "a calls-record verifies and surfaces signer/child/name");

  const f = buildForest(edges, { residents, calls: [cv], windowDays: 180, now: NOW });
  const dio = f.nodes.get(dioceseA.fingerprint);
  ok(dio.name === "Archdiocese of the North" && dio.assigned && dio.assigned.by === church.fingerprint, "the child's actual parent names it — that name is authoritative (assigned from above)");
  ok(dio.label === "diocese-north", "the subordinate's OWN moniker is still carried — as adornment, not the structural name");
  ok(renderText(f).includes('Archdiocese of the North (aka "diocese-north")'), "the plain text leads with the superior's name, the moniker rides in parens");
  const jn = renderJSON(f).roots.find((r) => r.key === church.fingerprint).children.find((c) => c.key === dioceseA.fingerprint);
  ok(jn.name === "Archdiocese of the North" && jn.label === "diocese-north" && jn.assigned.fresh === true, "JSON carries authoritative name + moniker + the name's heartbeat");
}

// 8. an IMPOSTOR naming — a random atlas (not the parent) naming the child — is ignored, garbage-grade.
{
  const impostorName = await makeCalls({ child: dioceseA.fingerprint, name: "Definitely The Boss", at: NOW }, parish1);   // parish1 is NOT diocese-north's parent
  const f = buildForest(edges, { residents, calls: [await verifyCalls(impostorName)], windowDays: 180, now: NOW });
  const dio = f.nodes.get(dioceseA.fingerprint);
  ok(dio.name === null && dio.assigned === null, "a calls-record from anyone but the actual parent names nobody — cross-check refuses it");
  ok(f.unnamed >= 1 && renderText(f).includes(" *"), "an un-parent-named node is marked self-named (*) — a shape without a confirmed name");
}

// 9. the name is LEASED — a stale calls-record still names, but its dereliction shows in place.
{
  const stale = await makeCalls({ child: dioceseA.fingerprint, name: "Archdiocese (lapsed)", at: "2026-01-01T00:00:00Z" }, church);   // >180d before NOW
  const f = buildForest(edges, { residents, calls: [await verifyCalls(stale)], windowDays: 180, now: NOW });
  const dio = f.nodes.get(dioceseA.fingerprint);
  ok(dio.name === "Archdiocese (lapsed)" && dio.assigned.fresh === false, "a lapsed name is still shown (never a silent rename) but marked not-fresh");
  ok(renderText(f).includes("[name derelict]"), "the text shows the name going derelict in place");
}

// 10. THE ROLL-UP — a superior holds a subordinate's SIGNED report, verifies it, and grafts the
// subordinate's OWN subtree under the matching node: grade-labelled, carried, never laundered. No live-trace.
{
  const P = await key(), C = await key(), GC = await key();
  // the child's world: a grandchild files under the child; the child signs its assembly.
  const childForest = buildForest([await mk(GC, "grandchild", C.fingerprint, "team", NOW)], { residents: [C.fingerprint, GC.fingerprint], windowDays: 180, now: NOW });
  const childReport = await signReport(childForest, C);
  ok(childReport.schema === TREE && childReport.self === C.fingerprint && (await verifyReport(childReport)).ok, "an atlas signs its OWN assembly, and a superior can verify it");

  // the superior's world: the child files under the superior; locally the child is a leaf.
  const parent = buildForest([await mk(C, "child", P.fingerprint, "division", NOW)], { residents: [P.fingerprint, C.fingerprint], windowDays: 180, now: NOW });
  ok(parent.nodes.get(C.fingerprint).children.length === 0, "before roll-up, the child is a leaf in the superior's local forest");

  graftSubtrees(parent, [await verifyReport(childReport)], { windowDays: 180, now: NOW });
  const cnode = parent.nodes.get(C.fingerprint);
  ok(cnode.relay && cnode.relay.from === C.fingerprint && cnode.relay.verified === true && cnode.relay.fresh === true, "the child's node is grade-labelled: relayed from the child, verified, with its heartbeat");
  ok(cnode.children.length === 1 && cnode.children[0].key === GC.fingerprint, "the child's OWN subtree (the grandchild) is grafted under it — one hop, bottom-up");
  ok(parent.relayed === 1, "the roll-up counts one relayed subtree");

  const j = renderJSON(parent);
  const jc = j.roots.find((r) => r.key === P.fingerprint).children.find((c) => c.key === C.fingerprint);
  ok(j.relayed === 1 && jc.relay && jc.relay.from === C.fingerprint && jc.children.some((g) => g.key === GC.fingerprint), "JSON carries the relay label + the grafted grandchild");
  ok(renderText(parent).includes("relayed from " + C.fingerprint.replace(/^key:sha256:/, "").slice(0, 8)), "the plain text shows the relay marker in place");
}

// 11. the grade GATE — an unverifiable report grafts NOTHING; a stale-but-valid one is still shown, derelict.
{
  const P = await key(), C = await key(), GC = await key();
  const good = await signReport(buildForest([await mk(GC, "gc", C.fingerprint, "team", NOW)], { residents: [C.fingerprint, GC.fingerprint], windowDays: 180, now: NOW }), C);

  const bent = JSON.parse(JSON.stringify(good)); bent.at = "2000-01-01T00:00:00.000Z";   // tamper after signing
  ok(!(await verifyReport(bent)).ok, "a tampered report fails verification");
  const sdir = mkdtempSync(path.join(tmpdir(), "atlas-sub-"));
  writeFileSync(path.join(sdir, "bent.json"), JSON.stringify(bent));
  ok((await readSubtrees(sdir)).length === 0, "readSubtrees drops the unverifiable report — a relay is only ever one we verified came from that peer");

  const parent = buildForest([await mk(C, "child", P.fingerprint, "div", NOW)], { residents: [P.fingerprint, C.fingerprint], windowDays: 180, now: NOW });
  const stale = await signReport(buildForest([await mk(GC, "gc", C.fingerprint, "team", "2025-12-01T00:00:00Z")], { residents: [C.fingerprint, GC.fingerprint], windowDays: 999, now: "2025-12-01T00:00:00Z" }), C);
  graftSubtrees(parent, [await verifyReport(stale)], { windowDays: 30, now: NOW });        // report is ~7mo old vs NOW
  const cnode = parent.nodes.get(C.fingerprint);
  ok(cnode.relay && cnode.relay.fresh === false && cnode.children.length === 1, "a stale relay is still grafted + shown, marked NOT fresh — dereliction visible in place, never a silent drop");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall tree tests passed");
