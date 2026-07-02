// bin/atlas-index.mjs — THE ATLAS-OF-ATLASES INDEX: the peers this Atlas knows, as one signed, served,
// catchable artifact (notes/atlas-roadmap.md, item 3; notes/boundary-canon.md "discovery is a walk"). It is
// bin/dump one floor up — where the dump hydrates _data/boundaries/ into boundaries.json (the shapes a phone
// bisects), this hydrates _data/atlases.yml (the peer directory bin/register-atlas populates) into
// atlases.json: the leased index the client's "fetch the world" walks to reach every Atlas's boundaries.json.
//
// THE APEX IS A REFERENCE ROOT, NOT A REGISTRY. Any Atlas can serve this; the "apex" is just whichever node
// most walks happen to start from — a courier of its neighbors' addresses, never an authority over them.
// So this builder makes exactly ONE promise and refuses the tempting others:
//   relays  — every peer entry is carried VERBATIM (id/name/url/repo/scope/signer/reports). The Atlas
//             witnesses its directory; it does not rank, dedupe by geography, or resolve disagreements.
//             `signer` rides along untouched so a catcher can later pin it and verify that peer's own dump.
//   leases  — freshness is computed from an OPTIONAL per-entry `renewed:` date (the peering gesture's
//             heartbeat): a date past the window lands in `expired` (recorded, never silently dropped); an
//             entry with no date is LISTED on presence with `stale: null` (honest absence — the directory
//             membership is the git-merged consent; the date is an additive refinement). The index also
//             stamps its OWN `at`, so a stale atlases.json shows its age the way boundaries.json does.
//   (refused) — no transitive federation (one hop, matching _data/atlases.yml's own doctrine), no authority
//             ordering, no laundering a peer's say-so into this Atlas's own observations. Additive only:
//             holding two Atlases' indexes gives you more of the map, never a contradiction to resolve.
//
// The whole index is attested by this Atlas's LEDGER signer (keys/dump-signer.pk8, gitignored; public
// fingerprint at keys/dump.fpr) — the same identity that signs boundaries.json, so a catcher pins one
// fingerprint for everything this Atlas publishes. The Atlas signs its LEDGER, never the truth of a peer.
//
//   bin/atlas-index build [--window-days N]   # compose + sign + write atlases.json (the served index)
//   bin/atlas-index fpr                        # print the ledger signer's public fingerprint

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;
const b64 = (u8) => Buffer.from(u8).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

// ---- vendored attestation core (byte-mirrors composer/sign.mjs, same as bin/dump.mjs and the Tell's) ----
export function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}
export async function defaultHash(bytes) { return "sha256:" + hex(new Uint8Array(await subtle.digest("SHA-256", bytes))); }
const fingerprint = async (rawPub) => "key:" + (await defaultHash(rawPub));
export async function contentId(obj) { return defaultHash(te.encode(canonicalize(obj))); }

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
  if (!create) throw new Error(`atlas-index: no signer key at ${keyPath}`);
  const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pk8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));
  mkdirSync(path.dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, b64(pk8) + "\n", { mode: 0o600 });
  const raw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return { privateKey: pair.privateKey, raw, fingerprint: await fingerprint(raw), created: true };
}

// ---- the peer-directory reader: _data/atlases.yml is a flat YAML list of scalar-only maps -----------------
// (register-atlas emits exactly these keys; we keep the dependency surface at zero, the boundaries.mjs way).
const FIELDS = ["id", "name", "url", "repo", "scope", "signer", "reports", "renewed"];
export function readPeers(yml) {
  const strip = (s) => { const q = s.replace(/\s+#.*$/, "").trim(); return q.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"); };
  const peers = [];
  let cur = null;
  for (const line of yml.split("\n")) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    const m = line.match(/^(\s*)(- )?(\w[\w-]*):\s*(.*)$/);
    if (!m) continue;
    const [, , dash, key, rawVal] = m;
    if (dash && key === "id") { cur = {}; peers.push(cur); }
    if (!cur || !FIELDS.includes(key)) continue;
    cur[key] = strip(rawVal);
  }
  // a directory entry is only meaningful with a stable id; anything else is a malformed stub, dropped.
  return peers.filter((p) => p.id);
}

// this Atlas's own identity — the reference root a walker lands on (read verbatim from atlas.yml, no secrets)
function selfIdentity(root) {
  try {
    const yml = readFileSync(path.join(root, "atlas.yml"), "utf8");
    const one = (k) => { const m = yml.match(new RegExp(`^${k}:\\s*(.*)$`, "m")); return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : ""; };
    return { id: one("id") || "atlas", name: one("name"), url: one("url"), scope: one("scope") };
  } catch { return { id: "atlas" }; }
}

// ---- the build ------------------------------------------------------------------------------------------
export async function buildIndex(root, { windowDays = 90, now } = {}) {
  const at = now || new Date().toISOString();
  const self = selfIdentity(root);
  const regPath = path.join(root, "_data/atlases.yml");
  const peers = existsSync(regPath) ? readPeers(readFileSync(regPath, "utf8")) : [];

  const atlases = [], expired = [];
  for (const p of peers) {
    const entry = {};
    for (const f of FIELDS) if (p[f] !== undefined && f !== "renewed") entry[f] = p[f];
    // the lease: a `renewed` date past the window drops from the listing (recorded); no date → listed,
    // stale: null (present, undated). Never a silent disappearance — the punishment test, honored.
    if (p.renewed) {
      const fresh = (new Date(at) - new Date(p.renewed)) <= windowDays * 86400_000;
      if (!Number.isFinite(new Date(p.renewed).getTime())) { entry.renewed = null; entry.stale = null; }
      else if (!fresh) { expired.push({ id: p.id, renewed: p.renewed }); continue; }
      else { entry.renewed = p.renewed; entry.stale = false; }
    } else { entry.renewed = null; entry.stale = null; }
    atlases.push(entry);
  }
  atlases.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  expired.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const keyPath = process.env.ATLAS_DUMP_KEY || path.join(root, "keys/dump-signer.pk8");
  const signer = await loadOrCreateSigner(keyPath, { create: true });
  const index = await attest({
    schema: "anecdote.atlas-index/v1",
    self: self.id,                                 // whose directory this is — the root you landed on
    at, windowDays,
    atlasIds: atlases.map((a) => a.id),            // the SET at a glance — the URLs "fetch the world" walks
    atlases, expired,
  }, signer);
  mkdirSync(path.join(root, "keys"), { recursive: true });
  writeFileSync(path.join(root, "keys/dump.fpr"), signer.fingerprint + "\n");
  return { index, signer, self };
}

// ---- CLI -------------------------------------------------------------------------------------------------
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const mode = process.argv[2] || "build";
  if (mode === "build") {
    const wd = process.argv.indexOf("--window-days");
    const { index, signer, self } = await buildIndex(root, { windowDays: wd > 0 ? +process.argv[wd + 1] : 90 });
    writeFileSync(path.join(root, "atlases.json"), JSON.stringify(index, null, 2) + "\n");
    console.log(`atlas-index (${self.id}): ${index.atlases.length} peers listed, ${index.expired.length} expired`);
    console.log(`signer: ${signer.fingerprint}  (published at keys/dump.fpr) → atlases.json`);
  } else if (mode === "fpr") {
    const keyPath = process.env.ATLAS_DUMP_KEY || path.join(root, "keys/dump-signer.pk8");
    console.log((await loadOrCreateSigner(keyPath, { create: false })).fingerprint);
  } else { console.error("usage: bin/atlas-index [build [--window-days N]|fpr]"); process.exit(2); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
