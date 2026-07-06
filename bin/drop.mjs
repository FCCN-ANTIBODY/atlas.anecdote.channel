// bin/drop.mjs — THE BALLOT DROP DOOR (forward-first). Receives hand-carried ballots, verifies them
// FROM ANYONE, dedups by content-id, and routes each into one of three fates (CONSTITUTION.md "I accept
// hand-carried ballots at one signed door, and I judge none of them"; notes/ballot-door.md; civic-node
// #86). bin/dump one more floor: where dump hydrates boundaries and atlas-index hydrates peers, this
// RECEIVES ballots and keeps them content-addressed.
//
// FORWARD-FIRST IS THE WHOLE OF THIS SLICE. Custody — standing up a stand-in ballot-box pile — is #86
// Slice 3, lives behind a judge, and is deliberately NOT here. This never judges a ballot's genuineness
// (witness, not judge) and never provisions a pile.
//
//   turnIn         — the pile is listed here (a Tell I list fronts it) AND the ballot arrived (its scope
//                    is one I serve) AND the poll is still live: stage it for turn-in.
//   shrugQuellBack — a known quell retires the poll (a terminal author quell; host quells lose to my own
//                    live listing): do not ingest, hand the quell(s) back to the carrier. Dormant until
//                    the quell registry (_data/quells.json) and poll-author map exist — freshness/#85.
//   floodOnward    — everything else still alive: keep it, content-addressed, at
//                    _data/drop-archive/<scope>/<poll>/<id>.json (this write IS the dedup — arrival
//                    behavior) and queue a ONE-HOP forward to the peer Atlases in _data/atlases.yml.
//                    Never dropped.
//
// Verify-from-anyone: the vendored attestation core byte-mirrors composer/sign.mjs (same as bin/dump.mjs
// and bin/atlas-index.mjs), so a ballot's content-id here equals composer/ballot.mjs's ballotId. The
// friend-list "whether to act" decision is not this door's business; this door keeps + routes.
//
//   bin/drop        # read the inbox, resolve, write drops.json + the content-addressed archive
// Env (ATLAS_* overrides, the code-vs-data split — see .github/actions/drop):
//   ATLAS_DROP_IN   inbox JSON: { ballots:[...], quells?:[...] } or a bare [ ...ballots ]  (default _data/drop-inbox.json)
//   ATLAS_QUELLS    signed-quell JSON array                                                (default _data/quells.json, optional)
//   ATLAS_POLL_AUTHORS  { "<pile>/<poll>": "<author fingerprint>" } for terminal author quells (default _data/poll-authors.json, optional)
//   ATLAS_PILES / ATLAS_TELLS / ATLAS_ATLASES   the registries                             (default _data/*.yml)
//   ATLAS_DROP_OUT  the fate manifest                                                      (default drops.json)
//   ATLAS_ARCHIVE   the content-addressed keep                                             (default _data/drop-archive)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;
const b64 = (u8) => Buffer.from(u8).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

// ---- vendored attestation core (byte-mirrors composer/sign.mjs, as bin/dump.mjs / bin/atlas-index.mjs) ----
export function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}
export async function defaultHash(bytes) { return "sha256:" + hex(new Uint8Array(await subtle.digest("SHA-256", bytes))); }
const fingerprint = async (rawPub) => "key:" + (await defaultHash(rawPub));
export async function contentId(obj) { return defaultHash(te.encode(canonicalize(obj))); } // == composer/ballot.mjs ballotId

export async function attest(obj, identity) { // exported for tests (build signed ballots/quells)
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
    if (by !== obj.sig.by) return { ok: false, by, errors: ["key fingerprint != sig.by"] };
    return { ok: true, by, errors: [] };
  } catch (e) { return { ok: false, by: null, errors: ["verify threw: " + e.message] }; }
}
export async function generateIdentity() { // exported for tests
  const pair = await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await subtle.exportKey("raw", pair.publicKey));
  return { privateKey: pair.privateKey, raw, fingerprint: await fingerprint(raw) };
}

// ---- vendored quell law (byte-mirrors composer/quell.mjs — pure) -----------------------------------------
export function quells(quell, target) { return !!target && quell.pile === target.pile && quell.poll === target.poll; }
export function isAuthorQuell(quell, authorKid) { return !quell.host && !!authorKid && !!quell.sig && quell.sig.by === authorKid; }
export function supersededBy(quell, listing) {
  if (!quell.host || !listing || listing.host !== quell.host) return false;
  return Date.parse(listing.ts) > Date.parse(quell.ts);
}
export function stillLive({ authorKid, quells: qs = [], listings = [] } = {}) {
  for (const q of qs) if (isAuthorQuell(q, authorKid)) return false;
  if (!listings.length) return true;
  return listings.some((l) => !qs.some((q) => q.host === l.host && !supersededBy(q, l)));
}

const BALLOT_SCHEMA = "anecdote.ballot/v1";
export function isBallot(b) {
  return !!b && b.schema === BALLOT_SCHEMA && typeof b.pile === "string" && typeof b.poll === "string" &&
    typeof b.answer === "string" && !!b.ts && !!b.sig;
}

// ---- the pure resolver: the three-rule table (mirrors anecdote composer/drop.mjs resolveDrop) ------------
export function resolveDrop({ ballots = [], listings = [], quells: qlist = [], myScopes = [],
                             authorKidFor = () => undefined } = {}) {
  const scopes = new Set(myScopes);
  const turnIn = [], shrugQuellBack = [], floodOnward = [];
  for (const ballot of ballots) {
    if (!isBallot(ballot)) continue;
    const forPoll = (x) => x.pile === ballot.pile && x.poll === ballot.poll;
    const pollQuells = qlist.filter((q) => quells(q, ballot));
    const pollListings = listings.filter(forPoll);
    if (!stillLive({ authorKid: authorKidFor(ballot.pile, ballot.poll), quells: pollQuells, listings: pollListings })) {
      shrugQuellBack.push({ ballot, quells: pollQuells });
      continue;
    }
    const knownDoor = pollListings.length > 0;
    const arrived = !!ballot.scope && scopes.has(ballot.scope);
    if (knownDoor && arrived) turnIn.push(ballot);
    else floodOnward.push(ballot);
  }
  return { turnIn, shrugQuellBack, floodOnward };
}

// ---- zero-dep registry reader (the readPeers way): a flat YAML list of scalar-only maps ------------------
export function readItems(yml) {
  const strip = (s) => { const q = s.replace(/\s+#.*$/, "").trim(); return q.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"); };
  const items = []; let cur = null;
  for (const line of yml.split("\n")) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    const m = line.match(/^(\s*)(- )?([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const [, , dash, key, rawVal] = m;
    if (dash) { cur = {}; items.push(cur); }
    if (!cur) continue;
    cur[key] = strip(rawVal);
  }
  return items;
}
function scalar(yml, key) { const m = yml.match(new RegExp(`^${key}:\\s*(.*)$`, "m")); return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : ""; }
function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback; }
function readYml(p) { return existsSync(p) ? readItems(readFileSync(p, "utf8")) : []; }

// ---- the driver: verify -> dedup -> resolve -> archive + manifest ----------------------------------------
export async function runDrop(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const inboxPath = opts.inbox || p("ATLAS_DROP_IN", "_data/drop-inbox.json");
  const quellsPath = opts.quells || p("ATLAS_QUELLS", "_data/quells.json");
  const authorsPath = opts.pollAuthors || p("ATLAS_POLL_AUTHORS", "_data/poll-authors.json");
  const pilesPath = p("ATLAS_PILES", "_data/piles.yml");
  const atlasesPath = p("ATLAS_ATLASES", "_data/atlases.yml");
  const tellsPath = p("ATLAS_TELLS", "_data/tells.yml");
  const outPath = opts.out || p("ATLAS_DROP_OUT", "drops.json");
  const archiveDir = opts.archiveDir || p("ATLAS_ARCHIVE", "_data/drop-archive");

  const selfYml = existsSync(path.join(root, "atlas.yml")) ? readFileSync(path.join(root, "atlas.yml"), "utf8") : "";
  const self = { id: scalar(selfYml, "id") || "atlas", scope: scalar(selfYml, "scope") };

  const inbox = readJson(inboxPath, []);
  const rawBallots = Array.isArray(inbox) ? inbox : (inbox.ballots || []);
  const qlist = [...(Array.isArray(inbox) ? [] : inbox.quells || []), ...readJson(quellsPath, [])];
  const authors = readJson(authorsPath, {});
  const authorKidFor = (pile, poll) => authors[`${pile}/${poll}`];

  const piles = readYml(pilesPath), tells = readYml(tellsPath), peers = readYml(atlasesPath);
  const listedPiles = new Set(piles.map((x) => x.id).filter(Boolean));
  const served = new Set([self.scope, ...piles.map((x) => x.scope), ...tells.map((x) => x.scope)].filter(Boolean));
  const forwardTo = peers.map((x) => x.id).filter(Boolean);

  // verify-from-anyone, then dedup by content-id (arrival-time convergence).
  let rejected = 0;
  const seen = new Map(); // id -> { ballot, id }
  for (const b of rawBallots) {
    if (!isBallot(b) || !(await verifyAttested(b)).ok) { rejected++; continue; }
    const id = await contentId(b);
    if (!seen.has(id)) seen.set(id, { ballot: b, id });
  }
  const idOf = new Map([...seen.values()].map((e) => [e.ballot, e.id]));
  const ballots = [...seen.values()].map((e) => e.ballot);

  // a listing exists (for freshness + "known door") only for a pile I actually list; my own live
  // listing is dated `at`, so a stale host quell for my door loses to it (a terminal author quell
  // still ends the question). Per (pile,poll) the ballots touch.
  const listings = [];
  const seenPoll = new Set();
  for (const b of ballots) {
    const k = `${b.pile}/${b.poll}`;
    if (seenPoll.has(k) || !listedPiles.has(b.pile)) continue;
    seenPoll.add(k);
    listings.push({ pile: b.pile, poll: b.poll, host: self.id, ts: at });
  }

  const { turnIn, shrugQuellBack, floodOnward } = resolveDrop({ ballots, listings, quells: qlist, myScopes: [...served], authorKidFor });

  // archive EVERY kept ballot, content-addressed — the durable keep and the dedup in one write.
  const archived = [];
  for (const b of ballots) {
    const id = idOf.get(b);
    const dir = path.join(archiveDir, b.scope || "_", b.poll);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, id.replace(/^sha256:/, "") + ".json");
    writeFileSync(file, JSON.stringify(b, null, 2) + "\n");
    archived.push(path.relative(root, file));
  }

  const brief = (b) => ({ id: idOf.get(b), pile: b.pile, poll: b.poll, scope: b.scope || null });
  const qId = new Map();
  for (const { quells: qs } of shrugQuellBack) for (const q of qs) if (!qId.has(q)) qId.set(q, await contentId(q));
  const manifest = {
    schema: "atlas.drops/v1", self: self.id, at,
    received: rawBallots.length, rejected, kept: ballots.length,
    fates: {
      turnIn: turnIn.map(brief),
      shrugQuellBack: shrugQuellBack.map(({ ballot, quells: qs }) => ({ ...brief(ballot), quells: qs.map((q) => qId.get(q)) })),
      floodOnward: floodOnward.map((b) => ({ ...brief(b), forward_to: forwardTo })),
    },
  };
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
  return { manifest, archived, outPath };
}

// ---- CLI -------------------------------------------------------------------------------------------------
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { manifest, archived } = await runDrop(root);
  const f = manifest.fates;
  console.error(`drop (${manifest.self}): ${manifest.kept} kept / ${manifest.rejected} rejected — ` +
    `${f.turnIn.length} turn-in, ${f.shrugQuellBack.length} shrug, ${f.floodOnward.length} flood; ${archived.length} archived`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
