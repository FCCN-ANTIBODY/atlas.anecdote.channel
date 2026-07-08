// bin/admit.mjs — THE REGISTRATION DROP DOOR (civic-node #85; CONSTITUTION.md "My registration door
// runs on three rules"). #72's sneakernet moves whole snapshots BETWEEN carriers; this is the other
// door: how an Atlas resolves the signed words aimed AT its registries — a Tell's listing, a
// de-listing, a competing claim — so a public, promiscuously-shared index can't be poisoned by a
// stale or hostile drop. The arrivals are the offline consent-exchange artifacts already built
// (anecdote composer/register-exchange.mjs, civic-node#60): an anecdote.register/v1 payload riding a
// signed anecdote.transfer/v1 envelope. This door RESOLVES AND NARRATES ONLY — it writes its
// admissions ledger and prints what each registry should show; the listing itself stays the
// PR-merge consent gesture it has always been (never an edit to _data/*.yml from here).
//
// The three-rule table, plus the stamp rule that makes replay harmless:
//   1. FRESHNESS WINS — the newest truthfully-signed word per (registry, scope, id) is what shows.
//      A word's stamp is `at` INSIDE the signed register payload (or `ts` on a quell) — never the
//      arrival time, which anyone could game by re-dropping an old artifact. A word with NO stamp
//      may be admitted on first contact but can never supersede anything: never a freshness nobody
//      stamped.
//   2. A DE-LISTING QUELL removes a listing but LOSES to the owner's fresher signed word — the
//      de-listing (anecdote.register-quell/v1: {registry, id, scope, ts}, attested) is a claim like
//      any other, arbitrated by the same rule. Only the entry's OWNER or THIS Atlas (opts.self —
//      applying its own retention to its own copy) may quell; a third party's quell is refused.
//   3. OWNERSHIP — the first admitted signer owns its (registry, scope, id). A different key's
//      claim on the same coordinates never silently replaces the owner's: it is recorded BESIDE it
//      (competing, for a human to read), exactly the snapshot-canon rule one level down.
//
//   bin/admit        # read _data/admit-inbox.json, resolve against _data/admissions.json, narrate
// Env (ATLAS_* overrides): ATLAS_ADMIT_IN (default _data/admit-inbox.json — { proposals:[...],
// quells:[...] } or a bare array of proposals), ATLAS_ADMISSIONS (default _data/admissions.json),
// ATLAS_SELF_SIGNERS (comma list of this Atlas's own fingerprints, for rule-2 self-quells).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { verifyAttested, defaultHash } from "./drop.mjs";

export const REGISTER = "anecdote.register/v1";
export const REGISTER_QUELL = "anecdote.register-quell/v1";
const TRANSFER = "anecdote.transfer/v1";
const te = new TextEncoder(), td = new TextDecoder();
const REGISTRIES = new Set(["piles", "tells", "atlases", "needs"]);

function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback; }
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const keyOf = (w) => `${w.registry}|${w.scope}|${w.id}`;

// open a register proposal: the transfer envelope verifies from anyone, the payload is a strict
// anecdote.register/v1, and the optional `at` stamp rides INSIDE the signed bytes.
export async function openProposal(envelope) {
  if (!envelope || envelope.schema !== TRANSFER || envelope.kind !== "registration")
    return { ok: false, errors: ["not a registration transfer"] };
  const att = await verifyAttested(envelope);
  if (!att.ok) return { ok: false, by: att.by, errors: att.errors };
  let bytes;
  try { bytes = unb64(envelope.bytes); } catch { return { ok: false, by: att.by, errors: ["bad payload encoding"] }; }
  if (await defaultHash(bytes) !== envelope.hash) return { ok: false, by: att.by, errors: ["payload hash mismatch"] };
  let inner;
  try { inner = JSON.parse(td.decode(bytes)); } catch { return { ok: false, by: att.by, errors: ["payload is not JSON"] }; }
  if (inner?.schema !== REGISTER || !REGISTRIES.has(inner.registry) || !inner.entry?.id || !inner.entry?.scope)
    return { ok: false, by: att.by, errors: ["payload is not a well-formed " + REGISTER] };
  if (inner.at !== undefined && Number.isNaN(Date.parse(inner.at)))
    return { ok: false, by: att.by, errors: ["a stamp that does not parse is no stamp"] };
  return { ok: true, by: att.by, registry: inner.registry, id: inner.entry.id, scope: inner.entry.scope,
    entry: inner.entry, at: inner.at || null };
}

export async function openQuell(q) {
  if (!q || q.schema !== REGISTER_QUELL) return { ok: false, errors: ["not a register-quell"] };
  const att = await verifyAttested(q);
  if (!att.ok) return { ok: false, by: att.by, errors: att.errors };
  if (!REGISTRIES.has(q.registry) || !q.id || !q.scope || !q.ts || Number.isNaN(Date.parse(q.ts)))
    return { ok: false, by: att.by, errors: ["a quell needs registry/id/scope and a parseable ts"] };
  return { ok: true, by: att.by, registry: q.registry, id: q.id, scope: q.scope, at: q.ts };
}

// the pure resolver: arrivals x the ledger -> the new ledger + the honest account of every word.
export async function resolveAdmissions({ proposals = [], quells = [], ledger = {}, self = [] } = {}) {
  const state = { ...ledger };            // key -> { owner, entry, at, status, since }
  const admitted = [], superseded = [], deListed = [], competing = [], stale = [], refused = [];

  const words = [];
  for (const p of proposals) {
    const w = await openProposal(p);
    if (!w.ok) { refused.push({ why: "proposal: " + w.errors.join("; "), by: w.by || null }); continue; }
    words.push({ ...w, word: "listing" });
  }
  for (const q of quells) {
    const w = await openQuell(q);
    if (!w.ok) { refused.push({ why: "quell: " + w.errors.join("; "), by: w.by || null }); continue; }
    words.push({ ...w, word: "quell" });
  }
  // stamped words resolve in stamp order, so one inbox delivers the same end-state as any arrival
  // order — replay indifference is the whole point of rule 1.
  words.sort((a, b) => (Date.parse(a.at || 0) || 0) - (Date.parse(b.at || 0) || 0));

  for (const w of words) {
    const k = keyOf(w);
    const cur = state[k];
    if (w.word === "quell") {
      if (!cur) { refused.push({ key: k, why: "a quell for nothing listed" , by: w.by }); continue; }
      if (w.by !== cur.owner && !self.includes(w.by)) { refused.push({ key: k, why: "a third party never de-lists another's entry", by: w.by }); continue; }
      if (cur.at && Date.parse(w.at) <= Date.parse(cur.at)) { stale.push({ key: k, why: "the listed word is fresher than the quell", by: w.by }); continue; }
      state[k] = { ...cur, status: "de-listed", at: w.at, word_by: w.by };
      deListed.push({ key: k, at: w.at, by: w.by });
      continue;
    }
    // a listing.
    if (!cur) {
      state[k] = { owner: w.by, entry: w.entry, at: w.at, status: "listed", since: w.at || null };
      admitted.push({ key: k, at: w.at, by: w.by, stamped: !!w.at });
      continue;
    }
    if (cur.owner !== w.by) { competing.push({ key: k, owner: cur.owner, claimant: w.by, at: w.at }); continue; }
    if (!w.at) { stale.push({ key: k, why: "an unstamped word never supersedes", by: w.by }); continue; }
    if (cur.at && Date.parse(w.at) <= Date.parse(cur.at)) { stale.push({ key: k, why: "older than the word already held", by: w.by }); continue; }
    const was = cur.status;
    state[k] = { ...cur, entry: w.entry, at: w.at, status: "listed" };
    (was === "de-listed" ? admitted : superseded).push({ key: k, at: w.at, by: w.by, relisted: was === "de-listed" });
  }
  return { state, admitted, superseded, deListed, competing, stale, refused };
}

// what each registry SHOULD show under the resolved state — the rows a consenting merge would land.
export function registryRows(state) {
  const rows = {};
  for (const [k, v] of Object.entries(state)) {
    if (v.status !== "listed") continue;
    const registry = k.split("|")[0];
    (rows[registry] ||= []).push(v.entry);
  }
  for (const r of Object.values(rows)) r.sort((a, b) => (a.id < b.id ? -1 : 1));
  return rows;
}

// ---- CLI -------------------------------------------------------------------------------------------------
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const inbox = readJson(p("ATLAS_ADMIT_IN", "_data/admit-inbox.json"), []);
  const ledgerPath = p("ATLAS_ADMISSIONS", "_data/admissions.json");
  const prior = readJson(ledgerPath, { schema: "atlas.admissions/v1", state: {} });
  const r = await resolveAdmissions({
    proposals: Array.isArray(inbox) ? inbox : inbox.proposals || [],
    quells: Array.isArray(inbox) ? [] : inbox.quells || [],
    ledger: prior.state,
    self: (process.env.ATLAS_SELF_SIGNERS || "").split(",").map((s) => s.trim()).filter(Boolean),
  });
  writeFileSync(ledgerPath, JSON.stringify({ schema: "atlas.admissions/v1", state: r.state }, null, 2) + "\n");
  console.error(`admit: ${r.admitted.length} admitted, ${r.superseded.length} superseded, ${r.deListed.length} de-listed, ` +
    `${r.competing.length} competing (recorded beside, never replacing), ${r.stale.length} stale, ${r.refused.length} refused`);
  const rows = registryRows(r.state);
  for (const [reg, entries] of Object.entries(rows))
    console.error(`admit: _data/${reg}.yml should show ${entries.length} entr${entries.length === 1 ? "y" : "ies"} — the merge stays the consent gesture`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
