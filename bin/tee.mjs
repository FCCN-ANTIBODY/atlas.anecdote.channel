// bin/tee.mjs — THE ARCHIVIST TEE (civic-node #91 "flush = a presumed PR", #94 "Atlas forwards
// dumb and fast; Antidote distills"). The Atlas's whole archival contract is two verbs — accept
// lost mail, forward it — and this is the second verb: loop the registered Antidote servers
// (_data/antidotes.yml — the Atlas treats them the way an honest operator treats its log servers)
// and tee everything the drop door kept to EACH of them, as soon as we can.
//
// Deliberately dumb (witness, not judge, one tier down the wire): no sharding, no jurisdiction
// modeling, no dedup beyond the content-id convergence the archive already is, no constitution
// computed (only an Antidote determines a COMMON CONSTITUTION — #94). Each bundle is LOOSE MAIL in
// exactly the shape an Antidote intake door accepts — { from, ballots:[...] } — so every record
// still wears its own constitution and the receiving door judges admission itself.
//
// Transparency is the guard (#86 "Atlas archival"): every send is a hash-linked entry in an OPEN
// ledger (_data/tee-ledger.json), and delivery is a PR the archivist consents to merge — this
// script writes bundles to an outbox and narrates the gesture; it never pushes anywhere.
//
//   bin/tee        # read the archive + the antidote registry; write outbox bundles + the ledger
//
// Per antidote the ledger remembers what was already sent, so a re-run tees only what's new —
// the loop that keeps "as soon as we can" honest without ever double-sending.
//
// Env (ATLAS_* overrides): ATLAS_ANTIDOTES (default _data/antidotes.yml), ATLAS_ARCHIVE (default
// _data/drop-archive), ATLAS_TEE_LEDGER (default _data/tee-ledger.json), ATLAS_TEE_OUT (default
// _data/tee-outbox).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { contentId, readItems } from "./drop.mjs";
import { readArchive } from "./custody.mjs";

function scalar(yml, key) { const m = yml.match(new RegExp(`^${key}:\\s*(.*)$`, "m")); return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : ""; }
function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback; }

export async function runTee(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const antidotesPath = opts.antidotes || p("ATLAS_ANTIDOTES", "_data/antidotes.yml");
  const archiveDir = opts.archiveDir || p("ATLAS_ARCHIVE", "_data/drop-archive");
  const ledgerPath = opts.ledger || p("ATLAS_TEE_LEDGER", "_data/tee-ledger.json");
  const outDir = opts.outDir || p("ATLAS_TEE_OUT", "_data/tee-outbox");

  const selfYml = existsSync(path.join(root, "atlas.yml")) ? readFileSync(path.join(root, "atlas.yml"), "utf8") : "";
  const self = { id: scalar(selfYml, "id") || "atlas" };

  const antidotes = existsSync(antidotesPath) ? readItems(readFileSync(antidotesPath, "utf8")) : [];
  // HONEST DEFAULT FIRES NOTHING: no registered archivist, no tee — and we say so.
  if (!antidotes.length) return { schema: "atlas.tee/v1", self: self.id, at, bundles: [], note: "no antidote servers registered (_data/antidotes.yml) — nothing teed" };

  // the keep, content-addressed: id -> ballot (the same convergence the drop door wrote).
  const held = new Map();
  for (const b of readArchive(archiveDir)) held.set(await contentId(b), b);

  const ledger = readJson(ledgerPath, { schema: "atlas.tee-ledger/v1", entries: [] });
  const sentTo = new Map(); // antidote id -> Set of content-ids already teed
  for (const e of ledger.entries) {
    if (!sentTo.has(e.antidote)) sentTo.set(e.antidote, new Set());
    for (const id of e.sent || []) sentTo.get(e.antidote).add(id);
  }

  const bundles = [];
  for (const a of antidotes) {
    if (!a.id) continue;
    const seen = sentTo.get(a.id) || new Set();
    const ids = [...held.keys()].filter((id) => !seen.has(id)).sort();
    if (!ids.length) continue;

    // loose mail, the intake door's own shape: every ballot still wears its own constitution.
    const bundle = { from: self.id, at, ballots: ids.map((id) => held.get(id)) };
    const dir = path.join(outDir, a.id);
    mkdirSync(dir, { recursive: true });
    const seq = ledger.entries.filter((e) => e.antidote === a.id).length;
    const file = path.join(dir, String(seq).padStart(6, "0") + ".json");
    writeFileSync(file, JSON.stringify(bundle, null, 2) + "\n");

    // the open ledger: one hash-linked entry per send, chained across ALL sends.
    const prev = ledger.entries[ledger.entries.length - 1] || null;
    const entry = { seq: ledger.entries.length, at, antidote: a.id, sent: ids, prev_hash: prev ? prev.this_hash : null };
    entry.this_hash = await contentId(entry);
    ledger.entries.push(entry);

    bundles.push({ antidote: a.id, repo: a.repo || null, file: path.relative(root, file), count: ids.length });
  }
  if (bundles.length) writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");

  return { schema: "atlas.tee/v1", self: self.id, at, bundles,
    deliver: bundles.length ? "each bundle is a presumed PR: open a PR on the antidote's repo placing the bundle at _data/intake-inbox.json (its intake door's inbox) — the merge is the consent; the door verifies from anyone and judges admission itself" : undefined };
}

// ---- CLI -------------------------------------------------------------------------------------------------
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const out = await runTee(root);
  if (!out.bundles.length) { console.error(`tee (${out.self}): ${out.note || "nothing new to tee"}`); return; }
  for (const b of out.bundles) console.error(`tee (${out.self}): ${b.count} ballot(s) -> ${b.antidote} (${b.file})${b.repo ? ` — PR onto ${b.repo}` : ""}`);
  console.error(`tee (${out.self}): ${out.deliver}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
