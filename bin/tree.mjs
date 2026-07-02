// bin/tree.mjs — THE TIMESTAMPED HEARTBEAT TREE (notes/boundary-canon.md "The above mark";
// notes/atlas-roadmap.md item 1). Atlas's active behavior: hydrate the `above` subordinate marks into a
// public, plain-text, full org tree with a last-refreshed stamp at every level. Structure knits itself
// from below — a node signs "I file myself under that one," up-pointing only, by consent.
//
// THREE THINGS THIS BUILDER HOLDS TO (all decided in boundary-canon.md, locked before this build):
//   STRUCTURE IS A POSITION, NOT A VALUE. The only thing the walker ever treats as an edge is the `parent`
//   field of a VERIFIED anecdote.above/v1 artifact. `as` (the human name) is copied for display and never
//   walked; a file of any other schema is not an edge; you cannot type a string that "becomes" structure.
//   THE EDGE IS LEASED AND DATED. Each above-mark is a signed assertion with a fresh `at`, re-signed to
//   stay alive (renewal, same pattern as a boundary claim). That timestamp IS the heartbeat: a stale edge
//   is marked derelict AND STILL SHOWN — dereliction is visible in place, never a silent disappearance.
//   NODES ARE FINGERPRINTS, NOT SLUGS. A node's identity is the signer fingerprint (the ownership anchor
//   from _data/atlases.yml). `parent` references a fingerprint too. So slugs can collide harmlessly and a
//   child that names a parent this Atlas doesn't hold renders as a DISJOINT branch reaching off-map —
//   additive, not broken.
//
//   bin/tree build [--window-days N]   # hydrate the forest → tree.txt + tree.json (build products)
//   bin/tree mine --parent <fpr> [--as <name>]   # sign THIS atlas's own above-edge under a parent
//   bin/tree fpr                       # the above-signer's public fingerprint

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;
const b64 = (u8) => Buffer.from(u8).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

// ---- vendored attestation core (byte-mirrors composer/sign.mjs, same as bin/dump.mjs) -----------------
export function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}
const dh = async (bytes) => "sha256:" + hex(new Uint8Array(await subtle.digest("SHA-256", bytes)));
const fingerprint = async (rawPub) => "key:" + (await dh(rawPub));
export async function attest(obj, identity) {
  const rest = { ...obj }; delete rest.sig;
  const signature = new Uint8Array(await subtle.sign({ name: "Ed25519" }, identity.privateKey, te.encode(canonicalize(rest))));
  return { ...rest, sig: { alg: "ed25519", by: identity.fingerprint, key: b64(identity.raw), signature: b64(signature) } };
}
export async function verifyAttested(obj) {
  if (!obj || !obj.sig || obj.sig.alg !== "ed25519") return { ok: false, by: null, errors: ["no ed25519 sig"] };
  const rest = { ...obj }; delete rest.sig;
  try {
    const key = await subtle.importKey("raw", unb64(obj.sig.key), { name: "Ed25519" }, true, ["verify"]);
    const ok = await subtle.verify({ name: "Ed25519" }, key, unb64(obj.sig.signature), te.encode(canonicalize(rest)));
    const by = await fingerprint(unb64(obj.sig.key));
    if (!ok) return { ok: false, by, errors: ["signature does not verify"] };
    if (by !== obj.sig.by) return { ok: false, by, errors: ["key fingerprint ≠ sig.by"] };
    return { ok: true, by, errors: [] };
  } catch (e) { return { ok: false, by: null, errors: ["verify threw: " + e.message] }; }
}
export async function loadOrCreateSigner(keyPath, { create = false } = {}) {
  if (existsSync(keyPath)) {
    const pk8 = unb64(readFileSync(keyPath, "utf8").trim());
    const privateKey = await subtle.importKey("pkcs8", pk8, { name: "Ed25519" }, true, ["sign"]);
    const jwk = await subtle.exportKey("jwk", privateKey);
    const raw = unb64(jwk.x.replace(/-/g, "+").replace(/_/g, "/"));
    return { privateKey, raw, fingerprint: await fingerprint(raw) };
  }
  if (!create) throw new Error(`tree: no signer key at ${keyPath}`);
  const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pk8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));
  mkdirSync(path.dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, b64(pk8) + "\n", { mode: 0o600 });
  const raw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return { privateKey: pair.privateKey, raw, fingerprint: await fingerprint(raw), created: true };
}

export const ABOVE = "anecdote.above/v1";

// A signed, dated, up-pointing edge: "I (the signer) file myself under `parent`." `child` is a human slug
// label carried inside the signed bytes; `parent` is the PARENT'S fingerprint (the ownership anchor). `as`
// is the optional human name for the relationship — carried verbatim, never walked.
export async function makeAbove({ child = "", parent, as = null, at } = {}, identity) {
  if (!parent || typeof parent !== "string") throw new Error("tree: an above-edge needs a parent fingerprint");
  return attest({ schema: ABOVE, child: String(child), parent, as: as || null, at: at || new Date().toISOString() }, identity);
}

// Verify an edge end to end. Returns the STRUCTURAL facts only from verified bytes; `as` rides for display.
export async function verifyAbove(edge) {
  if (!edge || edge.schema !== ABOVE) return { ok: false, errors: ["not an above-edge"] };
  const v = await verifyAttested(edge);
  if (!v.ok) return { ok: false, errors: v.errors };
  if (typeof edge.parent !== "string" || !edge.parent) return { ok: false, errors: ["no parent reference"] };
  return { ok: true, by: v.by, child: edge.child || "", parent: edge.parent, as: typeof edge.as === "string" ? edge.as : null, at: edge.at, errors: [] };
}

// Read all edges from a directory, verify each, keep the LATEST (by `at`) per signer (renewal wins;
// nodes are keyed by signer fingerprint, so two files from the same key are the same node's history).
export async function readEdges(dir) {
  const out = new Map();
  if (!existsSync(dir)) return [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    let edge; try { edge = JSON.parse(readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    const v = await verifyAbove(edge);
    if (!v.ok) continue;
    const prev = out.get(v.by);
    if (!prev || new Date(v.at) > new Date(prev.at)) out.set(v.by, v);
  }
  return [...out.values()];
}

// Build the forest. `residents` = fingerprints this Atlas holds (self + peers in _data/atlases.yml); a
// parent not resident becomes an OFF-MAP placeholder root (the branch reaches off this Atlas). `labels`
// maps a fingerprint → a display name (from the registry) for parent-only nodes. Every node carries the
// heartbeat: its edge's `at` and whether it is `fresh` within the lease window.
export function buildForest(edges, { residents = [], windowDays = 180, now } = {}) {
  const at = now ? new Date(now) : new Date();
  const resident = new Set(residents);
  const node = (key) => nodes.get(key) || (nodes.set(key, { key, label: null, resident: resident.has(key), offMap: false, edge: null, children: [] }), nodes.get(key));
  const nodes = new Map();
  let stale = 0;
  for (const e of edges) {
    const by = e.by || (e.sig && e.sig.by);            // accepts a verified record OR a signed edge (readEdges is the verification gate)
    const child = node(by); child.label = e.child || child.label;
    const fresh = Number.isFinite(at - new Date(e.at)) && (at - new Date(e.at)) <= windowDays * 86400_000;
    if (!fresh) stale++;
    child.edge = { parent: e.parent, as: e.as, at: e.at, fresh };
    const parent = node(e.parent);
    if (!resident.has(e.parent)) parent.offMap = true;
    parent.children.push(child);
  }
  // roots: nodes with no upward edge of their own (top orgs that do nothing) + off-map placeholders.
  const roots = [...nodes.values()].filter((n) => !n.edge).sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const n of nodes.values()) n.children.sort((a, b) => (a.key < b.key ? -1 : 1));
  return { roots, nodes, count: nodes.size, edges: edges.length, stale, windowDays, at: at.toISOString() };
}

const shortKey = (k) => String(k).replace(/^key:sha256:/, "").slice(0, 8);

// Plain-text tree: indented, one node per line, heartbeat stamp per level, dereliction shown in place.
export function renderText(forest) {
  const lines = [`# atlas heartbeat tree — ${forest.count} nodes, ${forest.edges} edges, ${forest.stale} stale (window ${forest.windowDays}d, as of ${forest.at})`];
  const seen = new Set();
  const walk = (n, depth) => {
    const indent = "  ".repeat(depth);
    const name = n.label || (n.offMap ? `⤴ off-map ${shortKey(n.key)}` : shortKey(n.key));
    let line = `${indent}${depth ? "└─ " : "● "}${name}`;
    if (n.edge) line += `  —${n.edge.as ? n.edge.as + " " : ""}→  ${n.edge.fresh ? "♥ " : "✗ STALE "}${n.edge.at}`;
    else if (n.offMap) line += "  (reaches off this atlas)";
    else line += "  (root)";
    lines.push(line);
    if (seen.has(n.key)) { lines.push(`${indent}  … (cycle guard)`); return; }
    seen.add(n.key);
    for (const c of n.children) walk(c, depth + 1);
  };
  for (const r of forest.roots) walk(r, 0);
  return lines.join("\n") + "\n";
}

// JSON tree: structured nodes for a future graph / heartbeat-tracker UI (no re-parsing the text).
export function renderJSON(forest) {
  const seen = new Set();
  const node = (n) => {
    if (seen.has(n.key)) return { key: n.key, cycle: true };
    seen.add(n.key);
    return { key: n.key, label: n.label, resident: n.resident, offMap: n.offMap || false,
             edge: n.edge ? { parent: n.edge.parent, as: n.edge.as, at: n.edge.at, fresh: n.edge.fresh } : null,
             children: n.children.map(node) };
  };
  return { schema: "anecdote.atlas-tree/v1", at: forest.at, windowDays: forest.windowDays,
           count: forest.count, edges: forest.edges, stale: forest.stale, roots: forest.roots.map(node) };
}

// residents + labels from _data/atlases.yml (peers) + this atlas's own fpr.
function readResidents(root) {
  const residents = [], labels = {};
  try { const self = readFileSync(path.join(root, "keys/atlas.fpr"), "utf8").trim(); if (self) residents.push(self); } catch {}
  try {
    const y = readFileSync(path.join(root, "_data/atlases.yml"), "utf8");
    const re = /signer:\s*"?([^"\n]+)"?/g; let m; while ((m = re.exec(y))) residents.push(m[1].trim());
  } catch {}
  return { residents, labels };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const mode = process.argv[2] || "build";
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  if (mode === "build") {
    const wd = arg("--window-days");
    const edges = await readEdges(path.join(root, "_data/above"));
    const { residents } = readResidents(root);
    const forest = buildForest(edges, { residents, windowDays: wd ? +wd : 180 });
    writeFileSync(path.join(root, "tree.txt"), renderText(forest));
    writeFileSync(path.join(root, "tree.json"), JSON.stringify(renderJSON(forest), null, 2) + "\n");
    console.log(`tree: ${forest.count} nodes, ${forest.edges} edges, ${forest.stale} stale → tree.txt + tree.json`);
  } else if (mode === "mine") {
    const parent = arg("--parent"); if (!parent) { console.error("usage: bin/tree mine --parent <fpr> [--as <name>] [--child <slug>]"); process.exit(2); }
    const keyPath = process.env.ATLAS_ABOVE_KEY || path.join(root, "keys/above-signer.pk8");
    const signer = await loadOrCreateSigner(keyPath, { create: true });
    let child = arg("--child"); if (!child) { try { const m = readFileSync(path.join(root, "atlas.yml"), "utf8").match(/^id:\s*(\S+)/m); child = m ? m[1] : ""; } catch { child = ""; } }
    const edge = await makeAbove({ child, parent, as: arg("--as"), at: new Date().toISOString() }, signer);
    const dir = path.join(root, "_data/above"); mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${child || shortKey(signer.fingerprint)}.json`), JSON.stringify(edge, null, 2) + "\n");
    mkdirSync(path.join(root, "keys"), { recursive: true }); writeFileSync(path.join(root, "keys/above.fpr"), signer.fingerprint + "\n");
    console.log(`signed above-edge: ${child} → ${parent}${edge.as ? " (as " + edge.as + ")" : ""}  · re-run to renew (fresh date keeps the heartbeat alive)`);
  } else if (mode === "fpr") {
    console.log((await loadOrCreateSigner(process.env.ATLAS_ABOVE_KEY || path.join(root, "keys/above-signer.pk8"), { create: false })).fingerprint);
  } else { console.error("usage: bin/tree [build|mine|fpr]"); process.exit(2); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
