// bin/atlas-labels.mjs — THE LABEL INDEX: non-shape discovery (civic-node #95; notes/public-exposure.md
// "Query the Atlas by the same label structure it lists its polls under"). Groups the things this Atlas
// LISTS — the Tells it fronts (_data/tells.yml) and the needs it carries (_data/needs.yml) — by their
// componential label tokens, so the public can find them BY LABEL, not only by shape (bin/dump's
// boundaries). "No mask = the whole state." A listing, never a delivery.
//
// It is bin/atlas-index's sibling, one more floor: where atlas-index hydrates PEERS and dump hydrates
// SHAPES, this hydrates LABELS. Same promises, same posture:
//   - witnesses, never RANKS (the anti-algorithm hypothesis, #95): labels are sorted by name, never by
//     count or "relevance"; the count is a coarse BAND (§C/§M — distinct signers when known, never raw);
//   - the label language is REDUCTIVE/COMPONENTIAL, not a controlled taxonomy: an item's text is decomposed
//     into tokens (the same "reduce to components" the Label-Reducer does), which is the hedge the design
//     note names against a controlled vocabulary becoming a soft-power center. The reduce() is PLUGGABLE —
//     the reducer's own fewest-verbs kernel can be injected as the tokenizer without changing this file;
//     the default is a dependency-free content-token split, compatible with reducer content-tokens;
//   - ONE HOP: it indexes only THIS Atlas's own listed items. A walker reaches a peer's labels by walking
//     that peer's labels.json — additive (two labels.jsons give MORE of the map, never a contradiction);
//   - signed by the SAME ledger signer as atlases.json/boundaries.json, so a catcher pins ONE fingerprint
//     for everything this Atlas publishes.
//
//   bin/atlas-labels build          # hydrate tells+needs -> signed labels.json
//   bin/atlas-labels query <text>   # reduce <text> the SAME way and print the labels it lands under
// Env (ATLAS_* overrides): ATLAS_TELLS (_data/tells.yml), ATLAS_NEEDS (_data/needs.yml),
//   ATLAS_DUMP_KEY (keys/dump-signer.pk8 — the ledger signer, shared with atlas-index).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { attest, loadOrCreateSigner } from "./atlas-index.mjs";

// A generic list-of-maps YAML reader (the shape of _data/tells.yml and _data/needs.yml): a new record
// starts at a `- key:` dash line, subsequent indented `key:` lines add to it. Only records with an id
// are meaningful. Mirrors atlas-index.readPeers' stripping, generalized over keys.
export function readRecords(yml) {
  const strip = (s) => { const q = s.replace(/\s+#.*$/, "").trim(); return q.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"); };
  const recs = [];
  let cur = null;
  for (const line of yml.split("\n")) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    const m = line.match(/^(\s*)(- )?([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const [, , dash, key, rawVal] = m;
    if (dash) { cur = {}; recs.push(cur); }
    if (!cur) continue;
    cur[key] = strip(rawVal);
  }
  return recs.filter((r) => r.id);
}

// Stopwords mirror the reducer's content() so the label language is the SAME componential structure a
// query renders under. (Kept in sync deliberately; the reducer's tokenizer can be injected to unify them.)
const STOP = new Set(
  ("a an the is are was were be been being am of at in on to into onto from this that these those there here" +
   " it its your you i we they he she for and or but with as by have has had do does did not no yes can could" +
   " would should will just very really my our their his her").split(/\s+/)
);

// The default componential reduce: lowercase, split on any non-alphanumeric (so "social/boardgames" ->
// [social, boardgames]), drop stopwords, dedupe. Order-free; a label is a component, never a phrase.
export function reduceTokens(text) {
  const seen = new Set(), out = [];
  for (const w of String(text || "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (w && !STOP.has(w) && !seen.has(w)) { seen.add(w); out.push(w); }
  }
  return out;
}

// Coarse standing, never a raw count (§C/§M): 1 stays 1; small numbers read "<10"; then decade bands.
export function band(n) {
  if (n <= 0) return "0";
  if (n === 1) return "1";
  if (n < 10) return "<10";
  return Math.pow(10, Math.floor(Math.log10(n))) + "s";
}

// Pure: build the label groups from the listed items. reduce is injectable (default reduceTokens).
export function buildLabels({ tells = [], needs = [], reduce = reduceTokens } = {}) {
  const items = [];
  for (const t of tells)
    items.push({ kind: "tell", id: t.id, scope: t.scope || null, url: t.url || null, signer: t.signer || null,
      text: [t.name, t.id].filter(Boolean).join(" ") });
  for (const n of needs)
    items.push({ kind: "need", id: n.id, scope: n.scope || null, url: n.need_url || null, signer: n.asker_repo || null,
      text: [n.topic, n.id].filter(Boolean).join(" ") });

  const groups = new Map();
  for (const it of items) {
    for (const tok of reduce(it.text)) {
      if (!groups.has(tok)) groups.set(tok, { label: tok, listings: [], masks: new Set(), signers: new Set() });
      const g = groups.get(tok);
      g.listings.push({ id: it.id, kind: it.kind, scope: it.scope, url: it.url });
      g.masks.add(it.scope || "whole-state");        // no mask = the whole state
      if (it.signer) g.signers.add(it.signer);
    }
  }
  const labels = [...groups.values()]
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))   // by NAME, never by count (no ranking)
    .map((g) => ({
      label: g.label,
      count: band(g.signers.size || g.listings.length),                     // distinct signers when known
      masks: [...g.masks].sort(),
      listings: g.listings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    }));
  return { labels, items: items.length };
}

// Pure: query the index by the SAME reduction — reduce the query to components and return the label
// groups any component lands on. This is the note's promise: query under the structure the Atlas lists by.
export function queryLabels(index, query, reduce = reduceTokens) {
  const want = new Set(reduce(query));
  return (index.labels || []).filter((l) => want.has(l.label));
}

function selfId(root) {
  try {
    const yml = readFileSync(path.join(root, "atlas.yml"), "utf8");
    const m = yml.match(/^id:\s*(.*)$/m);
    return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : "atlas";
  } catch { return "atlas"; }
}

export async function buildLabelIndex(root, { now, reduce } = {}) {
  const at = now || new Date().toISOString();
  const read = (env, rel) => { const p = process.env[env] || path.join(root, rel); return existsSync(p) ? readRecords(readFileSync(p, "utf8")) : []; };
  const tells = read("ATLAS_TELLS", "_data/tells.yml");
  const needs = read("ATLAS_NEEDS", "_data/needs.yml");
  const { labels, items } = buildLabels({ tells, needs, reduce });

  const keyPath = process.env.ATLAS_DUMP_KEY || path.join(root, "keys/dump-signer.pk8");
  const signer = await loadOrCreateSigner(keyPath, { create: true });
  const index = await attest({ schema: "anecdote.atlas-labels/v1", self: selfId(root), at, items, labels }, signer);
  return { index, signer, items };
}

// ---- CLI -------------------------------------------------------------------------------------------------
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const mode = process.argv[2] || "build";
  if (mode === "build") {
    const { index, signer, items } = await buildLabelIndex(root);
    writeFileSync(path.join(root, "labels.json"), JSON.stringify(index, null, 2) + "\n");
    console.log(`atlas-labels (${index.self}): ${items} listed item(s) -> ${index.labels.length} label(s) -> labels.json`);
    console.log(`signer: ${signer.fingerprint}`);
  } else if (mode === "query") {
    const q = process.argv.slice(3).join(" ");
    if (!q) { console.error("usage: bin/atlas-labels query <text>"); process.exit(2); }
    const p = path.join(root, "labels.json");
    if (!existsSync(p)) { console.error("no labels.json — run `bin/atlas-labels build` first"); process.exit(2); }
    const index = JSON.parse(readFileSync(p, "utf8"));
    const hits = queryLabels(index, q);
    console.log(`query ${JSON.stringify(q)} -> ${reduceTokens(q).join(" ")} :`);
    if (!hits.length) console.log("  (nothing listed under those components)");
    for (const h of hits) console.log(`  ${h.label} [${h.count}, ${h.masks.join("/")}]: ` + h.listings.map((l) => `${l.kind}:${l.id}`).join(", "));
  } else { console.error("usage: bin/atlas-labels [build|query <text>]"); process.exit(2); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
