// bin/snapshot.mjs — THE SIGNED SNAPSHOT (civic-node #71, "real at one time"; CONSTITUTION.md "My
// record is one record, reachable or not"). What this Atlas serves live, what it exports, and what
// a carried copy of it shows are the same registries — and when it is not being fetched (darkness,
// distance, a thumb drive), the signed snapshot IS the truthful record: stale-dated, honest about
// its date, never a freshness it did not stamp.
//
// THE SIGNING TARGET (the #71 decision, recorded in notes/snapshot.md): one attested Ed25519
// envelope over the registries' INLINE CONTENT — each file riding verbatim with its own content-id
// (defaultHash over its bytes), the whole envelope carrying the stamped `at`. Content-bound, not
// code-bound: the signature proves these exact bytes were this Atlas's record at that moment. The
// git-enough tree hash remains a compatible *additional* address the offline origin can compute
// over the same carried files when it lands them in repo-world (#73) — it needs no second signature.
//
// The signer is the Atlas's LEDGER signer — the same identity that already attests the dump and the
// atlas-of-atlases index (keys/dump-signer.pk8, gitignored; public fingerprint at keys/dump.fpr).
// One identity family for every signed public surface; no new key class.
//
//   bin/snapshot                       # export: sign the record -> snapshot.json (served at /snapshot.json)
//   bin/snapshot verify --file F [--signer key:sha256:…]
//   bin/snapshot ingest --file F [--signer key:sha256:…]   # keep a carried copy, never older-over-newer
//   bin/snapshot compare --a F1 --b F2                     # which of two copies of one canon is newer
//
// Verify-from-anyone / trust-decides-action: `ok` means the signature and every content-id check out
// (anyone can run this, no secrets); `trusted` means the signer is one YOU pinned (--signer, or the
// ingest store's remembered fingerprint). Ingest REFUSES an older stamp over a kept newer one — a
// carried copy may be stale, but staleness is honest, never hidden, and never regresses.
//
// Env (ATLAS_* overrides): ATLAS_DUMP_KEY (the ledger signer), ATLAS_SNAPSHOT_OUT (default
// snapshot.json), ATLAS_SNAPSHOT_FILES (comma list overriding the declared default set),
// ATLAS_SNAPSHOTS (the ingest keep, default _data/snapshots).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { attest, verifyAttested, defaultHash } from "./drop.mjs";
import { loadOrCreateSigner } from "./dump.mjs";

const te = new TextEncoder();
const SCHEMA = "atlas.snapshot/v1";

// the record: every registry this Atlas keeps and every open ledger/surface it derives — the same
// list the CONSTITUTION means by "my own registry and the surfaces I derive from it". Present-only;
// what is absent is NAMED in the snapshot, never silently missing.
export const DEFAULT_FILES = [
  "_data/tells.yml", "_data/piles.yml", "_data/needs.yml", "_data/atlases.yml", "_data/requests.yml",
  "_data/hearsay-piles.yml", "_data/antidotes.yml", "_data/tee-ledger.json", "_data/flush-ledger.json",
  "matches.json", "atlases.json", "boundaries.json",
];

function scalar(yml, key) { const m = yml.match(new RegExp(`^${key}:\\s*(.*)$`, "m")); return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : ""; }

// ---- export: sign the record --------------------------------------------------------------------------------
export async function buildSnapshot(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const paths = opts.files || (process.env.ATLAS_SNAPSHOT_FILES ? process.env.ATLAS_SNAPSHOT_FILES.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_FILES);
  const selfYml = existsSync(path.join(root, "atlas.yml")) ? readFileSync(path.join(root, "atlas.yml"), "utf8") : "";
  const files = [], absent = [];
  for (const rel of paths) {
    const p = path.join(root, rel);
    if (!existsSync(p)) { absent.push(rel); continue; }
    const content = readFileSync(p, "utf8");
    files.push({ path: rel, id: await defaultHash(te.encode(content)), content });
  }
  return { schema: SCHEMA, atlas: scalar(selfYml, "id") || "atlas", url: scalar(selfYml, "url") || null, at, files, absent };
}

export async function runExport(root, opts = {}) {
  const outPath = opts.out || process.env.ATLAS_SNAPSHOT_OUT || path.join(root, "snapshot.json");
  const keyPath = opts.keyPath || process.env.ATLAS_DUMP_KEY || path.join(root, "keys/dump-signer.pk8");
  const unsigned = await buildSnapshot(root, opts);
  const signer = await loadOrCreateSigner(keyPath, { create: true });
  const signed = await attest(unsigned, signer);
  writeFileSync(outPath, JSON.stringify(signed, null, 2) + "\n");
  writeFileSync(path.join(path.dirname(keyPath), "dump.fpr"), signer.fingerprint + "\n"); // the public half rides beside the key
  return { signed, outPath, fingerprint: signer.fingerprint };
}

// ---- verify: anyone, no secrets ------------------------------------------------------------------------------
export async function verifySnapshot(snapshot, { signer = null } = {}) {
  if (!snapshot || snapshot.schema !== SCHEMA) return { ok: false, trusted: false, errors: ["not an atlas.snapshot/v1"] };
  const v = await verifyAttested(snapshot);
  if (!v.ok) return { ok: false, trusted: false, by: v.by, errors: v.errors };
  for (const f of snapshot.files || []) {
    const got = await defaultHash(te.encode(f.content ?? ""));
    if (got !== f.id) return { ok: false, trusted: false, by: v.by, errors: [`content-id mismatch at ${f.path}`] };
  }
  if (!snapshot.at || Number.isNaN(Date.parse(snapshot.at))) return { ok: false, trusted: false, by: v.by, errors: ["no verifiable date stamp"] };
  return { ok: true, trusted: !!signer && v.by === signer, by: v.by, at: snapshot.at, atlas: snapshot.atlas };
}

// ---- compare: two copies of ONE canon order by their stamped date --------------------------------------------
export function compareSnapshots(a, b) {
  if (a.atlas !== b.atlas || a.sig?.by !== b.sig?.by)
    return { comparable: false, why: "different atlas or different signer — two canons, not two dates of one" };
  const ta = Date.parse(a.at), tb = Date.parse(b.at);
  return { comparable: true, newer: tb > ta ? "b" : ta > tb ? "a" : "same" };
}

// ---- ingest: keep a carried copy; staleness honest; never older-over-newer -----------------------------------
export async function runIngest(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const file = opts.file;
  if (!file) throw new Error("snapshot ingest: --file is required");
  const dir = opts.dir || process.env.ATLAS_SNAPSHOTS || path.join(root, "_data/snapshots");
  const snapshot = JSON.parse(readFileSync(file, "utf8"));
  const v = await verifySnapshot(snapshot, { signer: opts.signer || null });
  if (!v.ok) throw new Error(`snapshot ingest: REFUSED — ${v.errors.join("; ")}`);

  const keptPath = path.join(dir, `${snapshot.atlas}.json`);
  if (existsSync(keptPath)) {
    const kept = JSON.parse(readFileSync(keptPath, "utf8"));
    // the pin is whatever we accepted first (trust-on-first-contact); a different signer never
    // silently replaces the canon we hold — that is a trust decision, not an ingest.
    if (kept.snapshot?.sig?.by !== snapshot.sig?.by)
      throw new Error(`snapshot ingest: REFUSED — signed by ${v.by}, but the kept copy of '${snapshot.atlas}' is signed by ${kept.snapshot?.sig?.by} (a new canon is a decision, not an ingest)`);
    const c = compareSnapshots(kept.snapshot, snapshot);
    if (c.newer !== "b" && c.newer !== "same")
      throw new Error(`snapshot ingest: REFUSED — the kept copy is stamped ${kept.snapshot.at}, the offered one ${snapshot.at}; newer is never silently replaced with older`);
    if (c.newer === "same") return { atlas: snapshot.atlas, keptPath, unchanged: true, stamped_at: snapshot.at };
  } else if (opts.signer && !v.trusted) {
    throw new Error(`snapshot ingest: REFUSED — signed by ${v.by}, not the pinned ${opts.signer}`);
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(keptPath, JSON.stringify({ schema: "atlas.snapshot-kept/v1",
    atlas: snapshot.atlas, stamped_at: snapshot.at, accepted_at: at, by: v.by, trusted: v.trusted,
    snapshot }, null, 2) + "\n");
  return { atlas: snapshot.atlas, keptPath, stamped_at: snapshot.at, accepted_at: at, by: v.by, trusted: v.trusted };
}

// ---- CLI ------------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {}; const map = { "--file": "file", "--signer": "signer", "--a": "a", "--b": "b", "--out": "out" };
  for (let i = 0; i < argv.length; i++) {
    const k = map[argv[i]];
    if (!k) throw new Error(`snapshot: unknown arg ${argv[i]}`);
    out[k] = argv[++i];
  }
  return out;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    const r = await runExport(root);
    console.error(`snapshot (${r.signed.atlas}): ${r.signed.files.length} file(s) signed at ${r.signed.at}` +
      (r.signed.absent.length ? ` (absent, named: ${r.signed.absent.join(", ")})` : "") +
      ` -> ${path.relative(root, r.outPath)} under ${r.fingerprint.slice(0, 24)}…`);
  } else if (cmd === "verify") {
    const a = parseArgs(rest);
    const v = await verifySnapshot(JSON.parse(readFileSync(a.file, "utf8")), { signer: a.signer || null });
    if (!v.ok) { console.error(`snapshot: NOT OK — ${v.errors.join("; ")}`); process.exit(1); }
    console.error(`snapshot: ok — '${v.atlas}' as of ${v.at}, signed by ${v.by}${v.trusted ? " (trusted: the pinned signer)" : a.signer ? " (NOT the pinned signer)" : ""}`);
  } else if (cmd === "ingest") {
    const r = await runIngest(root, parseArgs(rest));
    console.error(r.unchanged ? `snapshot: '${r.atlas}' already kept at this stamp (${r.stamped_at}) — no change`
      : `snapshot: kept '${r.atlas}' — stamped ${r.stamped_at}, accepted ${r.accepted_at}${r.trusted ? ", trusted" : ""} -> ${path.relative(root, r.keptPath)}`);
  } else if (cmd === "compare") {
    const a = parseArgs(rest);
    const A = JSON.parse(readFileSync(a.a, "utf8")), B = JSON.parse(readFileSync(a.b, "utf8"));
    const c = compareSnapshots(A, B);
    if (!c.comparable) { console.error(`snapshot: not comparable — ${c.why}`); process.exit(1); }
    console.error(c.newer === "same" ? "snapshot: same stamp" : `snapshot: ${c.newer === "a" ? a.a : a.b} is newer (${c.newer === "a" ? A.at : B.at})`);
  } else {
    console.error("usage: bin/snapshot            # export snapshot.json\n" +
      "       bin/snapshot verify --file F [--signer key:sha256:…]\n" +
      "       bin/snapshot ingest --file F [--signer key:sha256:…]\n" +
      "       bin/snapshot compare --a F1 --b F2");
    process.exit(2);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
