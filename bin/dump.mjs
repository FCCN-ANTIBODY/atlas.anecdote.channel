// bin/dump.mjs — THE ATLAS DUMP: the canon of boundary claims this Atlas holds, as one signed, served,
// catchable artifact (notes/boundary-canon.md). A phone fetches it (or catches it over the gravel), holds
// the shapes, and bisects LOCALLY — the offline client's self-constituency assertion starts here.
//
// THE TWO CALLS THIS BUILDER MAKES, AND THE ONE IT REFUSES TO:
//   listed  — computed from RENEWAL FRESHNESS (the lease; notes/boundary-canon.md "Renewal"). No renewal
//             inside the window means not listed — recorded in `expired`, never silently dropped. A
//             renewal only counts from the SAME key that signed the claim (no silent signer swap).
//   anchored — an OBSERVATION, never a gate: does the member's DECLARED anchor (its center of mass,
//             "where you'd knock") sit inside this Atlas's own shape (_data/boundaries/self.json — e.g.
//             Colorado's, attested by Colorado's Tell)? ONE point-in-polygon test of a declared point;
//             declared, never computed — polygon-vs-polygon containment is a TRAP (rounding math must
//             never exile a county sitting a hair over a line). MEMBERSHIP is not this: membership is the
//             DECLARED FILING — a Tell's artifacts are in this Atlas's intake because it registered here,
//             the consent gesture, full stop. anchored: false is a DESCRIPTION (normal for a watershed),
//             not a demerit; no declared anchor → anchored: null, recorded honestly.
//   (refused) — the call NOT made: geometry comparison of members against each other or against the self
//             shape. THE WATERSHED RULE: every verified, listed shape SHIPS in the dump and is bisectable,
//             no matter where its center of mass lives — a watershed that spills over any line we would
//             draw is doing something completely different, and the client's bisect must see it.
//
// Intake (the one door, downstream of the registration gesture): _data/boundaries/<tell-id>/<slug>.json
// (compiled anecdote.boundary/v1 artifacts, verbatim from the Tells) + <tell-id>/renewals/*.json, and
// _data/boundaries/self.json (this Atlas's own shape). Proposals (artifacts carrying `proposes`) go in
// their OWN section — wishes never mix into the canon of claims. Invalid artifacts land in `refused`
// with reasons. The whole dump is attested by the dump signer (keys/dump-signer.pk8, gitignored;
// public fingerprint published at keys/dump.fpr — the keys/atlas.fpr pattern): the Atlas signs its
// LEDGER, never the truth of a shape.
//
//   bin/dump build [--window-days N]   # compose + sign + write boundaries.json (the served dump)
//   bin/dump fpr                       # print the dump signer's public fingerprint

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;
const b64 = (u8) => Buffer.from(u8).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

// ---- vendored attestation core (byte-mirrors anecdote.channel/composer/sign.mjs, same as the Tell's) ---
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
  if (!create) throw new Error(`dump: no signer key at ${keyPath}`);
  const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const pk8 = new Uint8Array(await subtle.exportKey("pkcs8", pair.privateKey));
  mkdirSync(path.dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, b64(pk8) + "\n", { mode: 0o600 });
  const raw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return { privateKey: pair.privateKey, raw, fingerprint: await fingerprint(raw), created: true };
}

// ---- the ONE geometric primitive: even-odd point-in-polygons (mirrors composer/bisect.mjs) -------------
export function contains(polygons, point) {
  const inRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (const poly of polygons || []) {
    if (!inRing(point, poly[0])) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (inRing(point, poly[h])) { inHole = true; break; }
    if (!inHole) return true;
  }
  return false;
}

// ---- the build ------------------------------------------------------------------------------------------
export async function buildDump(root, { windowDays = 90, now } = {}) {
  const at = now || new Date().toISOString();
  const intake = path.join(root, "_data/boundaries");
  const atlasId = (() => { try { const m = readFileSync(path.join(root, "atlas.yml"), "utf8").match(/^id:\s*(\S+)/m); return m ? m[1] : "atlas"; } catch { return "atlas"; } })();

  // the Atlas's own shape — bounded is computed against it; absent → bounded: null for everyone
  let self = null, selfId = null;
  const selfPath = path.join(intake, "self.json");
  if (existsSync(selfPath)) {
    const s = JSON.parse(readFileSync(selfPath, "utf8"));
    if ((await verifyAttested(s)).ok) { self = s; selfId = await contentId(s); }
  }

  const members = [], proposals = [], expired = [], refused = [];
  if (existsSync(intake)) for (const tell of readdirSync(intake).sort()) {
    const tdir = path.join(intake, tell);
    if (!statSync(tdir).isDirectory()) continue;
    // renewals first: latest valid renewal per boundary id, SAME-KEY rule enforced at use
    const renewals = new Map();
    const rdir = path.join(tdir, "renewals");
    if (existsSync(rdir)) for (const f of readdirSync(rdir).sort()) {
      try {
        const r = JSON.parse(readFileSync(path.join(rdir, f), "utf8"));
        if (r.schema !== "anecdote.boundary-renewal/v1") continue;
        const v = await verifyAttested(r);
        if (!v.ok) continue;
        const prev = renewals.get(r.boundary);
        if (!prev || new Date(r.at) > new Date(prev.at)) renewals.set(r.boundary, r);
      } catch { /* an unreadable renewal renews nothing */ }
    }
    for (const f of readdirSync(tdir).sort()) {
      if (!f.endsWith(".json")) continue;
      const fpath = path.join(tdir, f);
      let artifact;
      try { artifact = JSON.parse(readFileSync(fpath, "utf8")); } catch { refused.push({ tell, file: f, errors: ["unreadable JSON"] }); continue; }
      if (artifact.schema !== "anecdote.boundary/v1") { refused.push({ tell, file: f, errors: ["not an anecdote.boundary/v1"] }); continue; }
      const v = await verifyAttested(artifact);
      if (!v.ok) { refused.push({ tell, file: f, errors: v.errors }); continue; }
      const id = await contentId(artifact);
      // a wish is not a claim: proposals go to their own section, whole, verbatim
      if (artifact.proposes) { proposals.push({ tell, id, artifact }); continue; }
      // the lease: the renewal IS the listing, and only from the claim's own key
      const renewal = renewals.get(id);
      const sameKey = renewal && renewal.sig.by === artifact.sig.by;
      const fresh = sameKey && (new Date(at) - new Date(renewal.at)) <= windowDays * 86400_000;
      if (!fresh) { expired.push({ tell, id, slug: artifact.constituency, lastRenewal: sameKey ? renewal.at : null }); continue; }
      // anchored: the member's DECLARED anchor, one point test — an observation, or an honest null
      const anchored = self && Array.isArray(artifact.center) ? contains(self.polygons, artifact.center) : null;
      members.push({ tell, id, renewal, anchored, artifact });
    }
  }
  members.sort((a, b) => (a.id < b.id ? -1 : 1));
  proposals.sort((a, b) => (a.id < b.id ? -1 : 1));

  const keyPath = process.env.ATLAS_DUMP_KEY || path.join(root, "keys/dump-signer.pk8");
  const signer = await loadOrCreateSigner(keyPath, { create: true });
  const dump = await attest({
    schema: "anecdote.atlas-dump/v1",
    atlas: atlasId, at, windowDays,
    boundary: selfId,                                    // the shape `anchored` was observed against
    memberIds: members.map((m) => m.id),                 // the SET — what's in, in one glance
    members, proposals, expired, refused,
  }, signer);
  mkdirSync(path.join(root, "keys"), { recursive: true });
  writeFileSync(path.join(root, "keys/dump.fpr"), signer.fingerprint + "\n");
  return { dump, signer };
}

// ---- CLI -------------------------------------------------------------------------------------------------
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const mode = process.argv[2] || "build";
  if (mode === "build") {
    const wd = process.argv.indexOf("--window-days");
    const { dump, signer } = await buildDump(root, { windowDays: wd > 0 ? +process.argv[wd + 1] : 90 });
    writeFileSync(path.join(root, "boundaries.json"), JSON.stringify(dump, null, 2) + "\n");
    console.log(`dump: ${dump.members.length} listed, ${dump.proposals.length} proposals, ${dump.expired.length} expired, ${dump.refused.length} refused`);
    console.log(`signer: ${signer.fingerprint}  (published at keys/dump.fpr) → boundaries.json`);
  } else if (mode === "fpr") {
    const keyPath = process.env.ATLAS_DUMP_KEY || path.join(root, "keys/dump-signer.pk8");
    console.log((await loadOrCreateSigner(keyPath, { create: false })).fingerprint);
  } else { console.error("usage: bin/dump [build [--window-days N]|fpr]"); process.exit(2); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
