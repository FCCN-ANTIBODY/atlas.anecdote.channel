// bin/retire.mjs — THE RETIREMENT OF A KEEP (civic-node#91 lifecycle: live -> quiet -> lossless
// deflate to the archive -> mailbox teardown; the keyring's status walks live -> deflated ->
// torn-down). A kept pile is transient BY INTENT — but it earns retirement by going quiet, never
// by a clock alone, and nothing is ever dropped: everything moves to archived/ at this repo's
// root (served in the open) before any mailbox comes down.
//
// QUIET IS A READING, NOT A VERDICT — and it is read from the OPEN TEE LEDGER, not from ballot
// timestamps. A ballot's signed `ts` is when it was answered; lateness does not exist in this
// system (#86), so an old ballot arriving today is ACTIVITY. What dates an arrival honestly is
// the first tee-ledger entry that forwarded its content-id (bin/tee runs "as soon as we can", so
// first-send ≈ arrival) — the transparency ledger doubles as the activity clock, for free.
//
// Three halves, only one of which moves anything:
//
//   plan (default) — per LIVE tank on the keyring: each door's last arrival (from the ledger),
//     whether it is quiet (no new content-id within ATLAS_QUIET_DAYS — UNSET MEANS NOTHING IS
//     EVER QUIET, the honest default), and the DEFAULT-HOLD guard (#94): every ballot the tank's
//     doors hold must have been teed to EVERY registered antidote — never evict into a hole; no
//     archivist registered, no retirement at all. A tank rises only when it is live, every door
//     is quiet, and every record is placed. needs:"judge" — this script retires nothing.
//
//   deflate --id TANK — the consented act, local and lossless: re-verify the default-hold guard
//     (hard — a judge cannot consent past a hole), MOVE the tank's ballots from the drop archive
//     to archived/<scope>/<poll>/ (same content-addressed layout, now at the served root), write
//     archived/reports/<TANK>.json (the log-band histogram — coarse standing, never raw counts;
//     the raw rides whole beside it), and walk the keyring rows to status: deflated. The doors
//     stay on the keyring, so the question stays findable — but they are no longer LIVE, so a
//     fresh drop for the same question can rise into a NEW tank later (the stone skips).
//
//   teardown --id TANK — the record of the REMOTE gesture (dispatch prune-pile-history on the
//     pile repo's feed branches, then archive the repo — narrated, never performed here):
//     requires status deflated, walks the keyring to torn-down. Discoverability outlives the
//     mailbox but not the archive.
//
// And the last two, the FLUSH-ELSEWHERE (#91's final verb; the raw leaves only against proof):
//
//   flush --id TANK — compose one antidote.teleport/v1 bundle PER registered archivist from the
//     tank's archived/ raw (byte-compatible with antidote bin/egress: sorted content-id
//     commitments, digest = contentId({seq, prev_digest, commitments}) chained through our own
//     open flush ledger — custody OUT). The COMMON CONSTITUTION governing the bundle is never
//     computed here (only an Antidote determines a COMMON): it is the archivist's declared offer
//     (the registry entry's `constitution:`) or an explicit --common; absent both, that
//     archivist is skipped and told why. Delivery stays the presumed PR; nothing local changes.
//
//   release --id TANK — the only step that ever lets raw go, and it goes ONLY against RECEIPTS:
//     for EVERY registered archivist, a copy of its intake ledger at _data/receipts/<id>.json
//     must (1) hash to its attested head, (2) verify against the signer PINNED in
//     _data/antidotes.yml, and (3) carry a custody-IN entry bound to our teleport by the SAME
//     digest, whose `admitted` covers every commitment (a queued/refused record blocks release —
//     it must be re-homed, never silently dropped). Then, and only then, the tank's raw leaves
//     archived/ (the coarse report stays forever) and the keyring walks torn-down -> flushed.
//     Our tee/flush tally proves WE SENT; the receipt proves THEY HOLD — release needs the second.
//
//   bin/retire                      # plan: write retire-plan.json (for a judge)
//   bin/retire deflate --id TANK
//   bin/retire teardown --id TANK
//   bin/retire flush --id TANK [--common sha256:…]
//   bin/retire release --id TANK
//
// Env (ATLAS_* overrides): ATLAS_QUIET_DAYS (UNSET => Infinity => nothing quiet), ATLAS_HEARSAY,
// ATLAS_ARCHIVE (default _data/drop-archive), ATLAS_TEE_LEDGER, ATLAS_ANTIDOTES, ATLAS_ARCHIVED
// (default archived/), ATLAS_RETIRE_OUT (default retire-plan.json), ATLAS_FLUSH_LEDGER (default
// _data/flush-ledger.json), ATLAS_FLUSH_OUT (default _data/flush-outbox), ATLAS_RECEIPTS
// (default _data/receipts).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { contentId, readItems, verifyAttested } from "./drop.mjs";
import { readKeyring } from "./hearsay.mjs";

function scalar(yml, key) { const m = yml.match(new RegExp(`^${key}:\\s*(.*)$`, "m")); return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : ""; }
function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback; }
function selfId(root) {
  const yml = existsSync(path.join(root, "atlas.yml")) ? readFileSync(path.join(root, "atlas.yml"), "utf8") : "";
  return scalar(yml, "id") || "atlas";
}

// exact counts never sit in the open: 0, then log-ten bands (mirrors antidote's band()).
export function band(n) {
  if (n <= 0) return "0";
  const lo = 10 ** Math.floor(Math.log10(n));
  return lo === 1 ? "1-9" : `${lo}-${lo * 10 - 1}`;
}

// like custody's readArchive, but keeping each ballot's FILE beside it (deflate moves files).
function walkArchive(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const scope of readdirSync(dir, { withFileTypes: true })) {
    if (!scope.isDirectory()) continue;
    for (const poll of readdirSync(path.join(dir, scope.name), { withFileTypes: true })) {
      if (!poll.isDirectory()) continue;
      const pdir = path.join(dir, scope.name, poll.name);
      for (const f of readdirSync(pdir)) {
        if (!f.endsWith(".json")) continue;
        try { out.push({ file: path.join(pdir, f), rel: path.join(scope.name, poll.name, f), b: JSON.parse(readFileSync(path.join(pdir, f), "utf8")) }); }
        catch { /* skip unreadable */ }
      }
    }
  }
  return out;
}

// the shared reading: doors per tank, held ballots per door, arrival dates + tee coverage from the ledger.
async function readKeep(root, opts) {
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const keyringPath = opts.keyring || p("ATLAS_HEARSAY", "_data/hearsay-piles.yml");
  const archiveDir = opts.archiveDir || p("ATLAS_ARCHIVE", "_data/drop-archive");
  const ledgerPath = opts.ledger || p("ATLAS_TEE_LEDGER", "_data/tee-ledger.json");
  const antidotesPath = opts.antidotes || p("ATLAS_ANTIDOTES", "_data/antidotes.yml");

  const doors = readKeyring(keyringPath);
  const antidotes = (existsSync(antidotesPath) ? readItems(readFileSync(antidotesPath, "utf8")) : []).filter((a) => a.id);
  const ledger = readJson(ledgerPath, { entries: [] });

  const firstSeen = new Map();               // content-id -> first ledger `at` (the arrival clock)
  const sentTo = new Map();                  // antidote id -> Set of content-ids
  for (const e of ledger.entries || []) {
    if (!sentTo.has(e.antidote)) sentTo.set(e.antidote, new Set());
    for (const id of e.sent || []) {
      sentTo.get(e.antidote).add(id);
      if (!firstSeen.has(id)) firstSeen.set(id, e.at);
    }
  }

  const held = [];                           // [{file, rel, b, id}] for every archived ballot
  for (const rec of walkArchive(archiveDir)) held.push({ ...rec, id: await contentId(rec.b) });

  return { keyringPath, archiveDir, doors, antidotes, firstSeen, sentTo, held };
}

const doorKey = (d) => `${d.pile}/${d.poll}`;
const heldFor = (held, door) => held.filter((h) => h.b.pile === door.pile && h.b.poll === door.poll);

// ---- plan: which live tanks have earned retirement (a judge still decides) --------------------------------
export async function runRetirePlan(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const outPath = opts.out || process.env.ATLAS_RETIRE_OUT || path.join(root, "retire-plan.json");
  const quietDays = opts.quietDays ?? (process.env.ATLAS_QUIET_DAYS ? +process.env.ATLAS_QUIET_DAYS : Infinity);
  const { doors, antidotes, firstSeen, sentTo, held } = await readKeep(root, opts);

  const tanks = new Map();
  for (const d of doors) { if (!tanks.has(d.id)) tanks.set(d.id, []); tanks.get(d.id).push(d); }

  const plan = [], holding = [];
  for (const [id, tankDoors] of tanks) {
    if (tankDoors.some((d) => (d.status || "live") !== "live")) continue; // only LIVE tanks are read
    const doorReads = tankDoors.map((d) => {
      const hs = heldFor(held, d);
      const arrivals = hs.map((h) => firstSeen.get(h.id) || null);
      const unplaced = arrivals.filter((a) => a === null).length;    // held but never teed: not even datable
      const last = arrivals.filter(Boolean).sort().pop() || null;
      const ageDays = last ? (Date.parse(at) - Date.parse(last)) / 86400000 : null;
      // an empty inbox is maximally quiet; an undatable arrival is ACTIVITY we can't place yet.
      const quiet = unplaced === 0 && (hs.length === 0 || (ageDays !== null && ageDays > quietDays));
      return { question: doorKey(d), held: hs.length, last_arrival: last, quiet };
    });
    // the default-hold guard (#94): every held id sent to EVERY registered archivist.
    const ids = tankDoors.flatMap((d) => heldFor(held, d).map((h) => h.id));
    const holes = antidotes.map((a) => ({ antidote: a.id, missing: ids.filter((i) => !(sentTo.get(a.id) || new Set()).has(i)).length }))
      .filter((h) => h.missing > 0);
    const placed = antidotes.length > 0 && holes.length === 0;
    const allQuiet = doorReads.every((r) => r.quiet);

    if (allQuiet && placed) {
      plan.push({ id, doors: doorReads, needs: "judge", // NEVER retired by this script
        gesture: { deflate: `bin/retire deflate --id ${id}`, then: `bin/retire teardown --id ${id}  # after the remote mailbox gestures` } });
    } else {
      holding.push({ id, doors: doorReads,
        why: !antidotes.length ? "no archivist registered — never evict into a hole (default-hold)"
          : holes.length ? `unplaced records (default-hold): ${holes.map((h) => `${h.missing} not yet teed to ${h.antidote}`).join("; ")}`
          : "not quiet — answers still arriving (or no quiet window set: honest default reads nothing as quiet)" });
    }
  }

  const out = { schema: "atlas.retire-plan/v1", self: selfId(root), at,
    policy: { quiet_days: quietDays === Infinity ? null : quietDays, archivists: antidotes.length },
    plan, holding };
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  return out;
}

// ---- keyring surgery: walk a tank's rows to a new status (the emitter's exact shape) -----------------------
function walkStatus(keyringPath, id, from, to, stampKey, at) {
  const lines = readFileSync(keyringPath, "utf8").split("\n");
  let cur = null, walked = 0;
  const out = [];
  for (const line of lines) {
    const m = line.match(/^- id:\s*(\S+)/);
    if (m) cur = m[1];
    if (cur === id && new RegExp(`^\\s*status:\\s*${from}\\s*$`).test(line)) {
      out.push(line.replace(new RegExp(`status:\\s*${from}`), `status: ${to}`));
      out.push(`  ${stampKey}: "${at}"`);
      walked++;
      continue;
    }
    out.push(line);
  }
  if (!walked) throw new Error(`retire: no '${from}' rows for tank ${id} on the keyring — nothing walked (never silently rewritten)`);
  writeFileSync(keyringPath, out.join("\n"));
  return walked;
}

// ---- deflate: the consented, local, LOSSLESS act -----------------------------------------------------------
export async function runDeflate(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const id = opts.id;
  if (!id) throw new Error("retire deflate: --id TANK is required");
  const archivedDir = opts.archivedDir || process.env.ATLAS_ARCHIVED || path.join(root, "archived");
  const { keyringPath, doors, antidotes, firstSeen, sentTo, held } = await readKeep(root, opts);

  const tankDoors = doors.filter((d) => d.id === id);
  if (!tankDoors.length) throw new Error(`retire deflate: no keyring doors for tank ${id}`);
  if (tankDoors.some((d) => (d.status || "live") !== "live")) throw new Error(`retire deflate: tank ${id} is not live`);

  // the default-hold guard is HARD here — a judge cannot consent past a hole.
  if (!antidotes.length) throw new Error("retire deflate: no archivist registered (_data/antidotes.yml) — never evict into a hole");
  const records = tankDoors.flatMap((d) => heldFor(held, d));
  for (const a of antidotes) {
    const missing = records.filter((r) => !(sentTo.get(a.id) || new Set()).has(r.id)).length;
    if (missing) throw new Error(`retire deflate: ${missing} record(s) not yet teed to ${a.id} — run bin/tee first (default-hold)`);
  }

  // the log-band histogram, per question: coarse standing in the open, never raw counts.
  const questions = tankDoors.map((d) => {
    const hs = heldFor(held, d);
    const answers = {};
    for (const h of hs) answers[String(h.b.answer)] = (answers[String(h.b.answer)] || 0) + 1;
    const windows = { "1d": 0, "7d": 0, "30d": 0, "90d": 0, older: 0 }; // log-spaced arrival windows
    for (const h of hs) {
      const seen = firstSeen.get(h.id);
      const days = seen ? (Date.parse(at) - Date.parse(seen)) / 86400000 : Infinity;
      windows[days <= 1 ? "1d" : days <= 7 ? "7d" : days <= 30 ? "30d" : days <= 90 ? "90d" : "older"]++;
    }
    return { pile: d.pile, poll: d.poll, scope: d.scope || null, question: d.question || null,
      held: band(hs.length),
      answers: Object.fromEntries(Object.entries(answers).sort().map(([k, v]) => [k, band(v)])),
      arrivals: Object.fromEntries(Object.entries(windows).map(([k, v]) => [k, band(v)])) };
  });

  // MOVE the raw, whole, into the served root — the same content-addressed layout, so any tool
  // that reads a drop archive reads this one. Nothing is transformed; nothing is dropped.
  const moved = [];
  for (const r of records) {
    const dest = path.join(archivedDir, r.rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    renameSync(r.file, dest);
    moved.push(r.rel);
  }

  const report = { schema: "atlas.retired-keep/v1", self: selfId(root), id, at,
    doors: tankDoors.length, records: band(records.length), questions,
    note: "raw kept whole under archived/<scope>/<poll>/ beside this report; counts are log bands (coarse standing, never raw)" };
  mkdirSync(path.join(archivedDir, "reports"), { recursive: true });
  const reportPath = path.join(archivedDir, "reports", `${id}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  walkStatus(keyringPath, id, "live", "deflated", "deflated_at", at);
  return { id, moved, reportPath, report };
}

// ---- teardown: record the remote gesture; narrate it, never perform it -------------------------------------
export async function runTeardown(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const id = opts.id;
  if (!id) throw new Error("retire teardown: --id TANK is required");
  const keyringPath = opts.keyring || process.env.ATLAS_HEARSAY || path.join(root, "_data/hearsay-piles.yml");
  const tankDoors = readKeyring(keyringPath).filter((d) => d.id === id);
  if (!tankDoors.length) throw new Error(`retire teardown: no keyring doors for tank ${id}`);
  if (!tankDoors.every((d) => d.status === "deflated"))
    throw new Error(`retire teardown: tank ${id} is not deflated — deflate first (lossless, always, before any mailbox comes down)`);
  walkStatus(keyringPath, id, "deflated", "torn-down", "torn_down_at", at);
  const repo = tankDoors[0].repo_url || "<the pile repo>";
  return { id, gesture: [
    `dispatch prune-pile-history on ${repo} for its feed/* branches (archive-and-reset, never rewrite)`,
    `then archive the repository on GitHub — the mailbox comes down; archived/ here keeps the record`,
  ] };
}

// ---- the archived/ side of a tank: its doors' raw, with files (the flush/release working set) ---------------
function archivedFor(archivedDir, tankDoors) {
  const keys = new Set(tankDoors.map(doorKey));
  return walkArchive(archivedDir).filter((r) => keys.has(`${r.b.pile}/${r.b.poll}`));
}

// ---- flush: compose the digest-bound teleport per archivist (custody OUT; delivery stays a PR) --------------
export async function runFlush(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const id = opts.id;
  if (!id) throw new Error("retire flush: --id TANK is required");
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const archivedDir = opts.archivedDir || p("ATLAS_ARCHIVED", "archived");
  const ledgerPath = opts.flushLedger || p("ATLAS_FLUSH_LEDGER", "_data/flush-ledger.json");
  const outDir = opts.outDir || p("ATLAS_FLUSH_OUT", "_data/flush-outbox");
  const keyringPath = opts.keyring || p("ATLAS_HEARSAY", "_data/hearsay-piles.yml");
  const antidotesPath = opts.antidotes || p("ATLAS_ANTIDOTES", "_data/antidotes.yml");

  const tankDoors = readKeyring(keyringPath).filter((d) => d.id === id);
  if (!tankDoors.length) throw new Error(`retire flush: no keyring doors for tank ${id}`);
  if (!tankDoors.every((d) => d.status === "deflated" || d.status === "torn-down"))
    throw new Error(`retire flush: tank ${id} is not retired — the flush composes from archived/; deflate first`);
  const antidotes = (existsSync(antidotesPath) ? readItems(readFileSync(antidotesPath, "utf8")) : []).filter((a) => a.id);
  if (!antidotes.length) throw new Error("retire flush: no archivist registered (_data/antidotes.yml)");

  const held = [];
  for (const r of archivedFor(archivedDir, tankDoors)) held.push({ ...r, id: await contentId(r.b) });
  if (!held.length) throw new Error(`retire flush: nothing under archived/ for tank ${id}`);
  const commitments = held.map((h) => h.id).sort();
  const records = commitments.map((c) => held.find((h) => h.id === c).b);

  const ledger = readJson(ledgerPath, { schema: "atlas.flush-ledger/v1", entries: [] });
  const bundles = [], skipped = [];
  for (const a of antidotes) {
    const existing = ledger.entries.find((e) => e.kind === "teleport" && e.antidote === a.id && e.pile === id);
    if (existing) { bundles.push({ antidote: a.id, digest: existing.digest, file: existing.file, reused: true }); continue; }
    // only an Antidote determines a COMMON — ours is the archivist's declared offer, or explicit.
    const common = opts.common || a.constitution || null;
    if (!common) { skipped.push({ antidote: a.id, why: "no COMMON CONSTITUTION — the registry entry declares none and --common was not given (no constitution, no catalog)" }); continue; }

    const teleports = ledger.entries.filter((e) => e.kind === "teleport");
    const seq = teleports.length;
    const prevDigest = teleports.length ? teleports[teleports.length - 1].digest : null;
    const digest = await contentId({ seq, prev_digest: prevDigest, commitments }); // = antidote bin/egress's derivation
    const bundle = { schema: "antidote.teleport/v1", from: selfId(root), pile: id, seq, prev_digest: prevDigest, at,
      common_constitution: common, commitments, digest, records };
    mkdirSync(path.join(outDir, a.id), { recursive: true });
    const file = path.join(outDir, a.id, `${id}-${String(seq).padStart(6, "0")}.json`);
    writeFileSync(file, JSON.stringify(bundle, null, 2) + "\n");

    const prev = ledger.entries[ledger.entries.length - 1] || null;
    const entry = { seq: ledger.entries.length, at, kind: "teleport", antidote: a.id, pile: id,
      common_constitution: common, sent: commitments, digest, file: path.relative(root, file),
      prev_hash: prev ? prev.this_hash : null };
    entry.this_hash = await contentId(entry);
    ledger.entries.push(entry);
    bundles.push({ antidote: a.id, digest, file: entry.file, count: commitments.length });
  }
  if (bundles.some((b) => !b.reused)) writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
  return { id, bundles, skipped,
    deliver: "each bundle is a presumed PR onto the archivist's repo (_data/intake-inbox.json); its intake door re-derives the digest and refuses the bundle whole on any mismatch. Bring back its ledger/manifest.json as _data/receipts/<antidote-id>.json for bin/retire release." };
}

// ---- release: raw leaves ONLY against verified receipts from EVERY archivist --------------------------------
export async function runRelease(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const id = opts.id;
  if (!id) throw new Error("retire release: --id TANK is required");
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const archivedDir = opts.archivedDir || p("ATLAS_ARCHIVED", "archived");
  const ledgerPath = opts.flushLedger || p("ATLAS_FLUSH_LEDGER", "_data/flush-ledger.json");
  const receiptsDir = opts.receipts || p("ATLAS_RECEIPTS", "_data/receipts");
  const keyringPath = opts.keyring || p("ATLAS_HEARSAY", "_data/hearsay-piles.yml");
  const antidotesPath = opts.antidotes || p("ATLAS_ANTIDOTES", "_data/antidotes.yml");

  const tankDoors = readKeyring(keyringPath).filter((d) => d.id === id);
  if (!tankDoors.length) throw new Error(`retire release: no keyring doors for tank ${id}`);
  if (!tankDoors.every((d) => d.status === "torn-down"))
    throw new Error(`retire release: tank ${id} is not torn-down — the raw leaves last, after the mailbox`);
  const antidotes = (existsSync(antidotesPath) ? readItems(readFileSync(antidotesPath, "utf8")) : []).filter((a) => a.id);
  if (!antidotes.length) throw new Error("retire release: no archivist registered — never release into a hole");

  const ledger = readJson(ledgerPath, { entries: [] });
  const verified = [];
  for (const a of antidotes) {
    const out = ledger.entries.find((e) => e.kind === "teleport" && e.antidote === a.id && e.pile === id);
    if (!out) throw new Error(`retire release: no flush to ${a.id} for tank ${id} — run bin/retire flush first`);
    if (!/^key:sha256:[0-9a-f]{64}$/.test(a.signer || ""))
      throw new Error(`retire release: no pinned signer for ${a.id} in _data/antidotes.yml — pin its keys/ledger.fpr (confirmed out-of-band) before any release`);

    const receiptPath = path.join(receiptsDir, `${a.id}.json`);
    if (!existsSync(receiptPath)) throw new Error(`retire release: no receipt at ${path.relative(root, receiptPath)} — bring back ${a.id}'s ledger/manifest.json`);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));

    // (1) the bytes hash to the attested head; (2) the head is signed by the PINNED archivist;
    // (3) a custody-IN entry is bound to our custody-OUT by the same digest, admitting everything.
    const digest = await contentId(receipt.entries || []);
    if (receipt.head?.digest !== digest) throw new Error(`retire release: ${a.id} receipt digest mismatch — entries do not hash to the attested head (tampered or partial copy)`);
    const v = await verifyAttested(receipt.head);
    if (!v.ok) throw new Error(`retire release: ${a.id} receipt head signature does not verify`);
    if (v.by !== a.signer) throw new Error(`retire release: ${a.id} receipt signed by ${v.by}, not the pinned ${a.signer}`);
    const bound = (receipt.entries || []).find((e) => e.teleport?.digest === out.digest);
    if (!bound) throw new Error(`retire release: ${a.id} receipt carries no custody-IN entry bound to our teleport digest ${out.digest.slice(0, 23)}…`);
    const admitted = new Set(bound.admitted || []);
    const missing = out.sent.filter((i) => !admitted.has(i));
    if (missing.length) throw new Error(`retire release: ${a.id} admitted ${admitted.size} but ${missing.length} of ours are not among them ` +
      `(queued: ${bound.queued ?? "?"}, refused: ${bound.refused ?? "?"}) — a held-back record is re-homed, never silently dropped`);
    verified.push({ antidote: a.id, digest: out.digest, in_seq: bound.seq });
  }

  // every archivist proved custody — NOW the raw may go. The coarse report stays forever.
  const sentIds = new Set(ledger.entries.filter((e) => e.kind === "teleport" && e.pile === id).flatMap((e) => e.sent));
  let released = 0;
  for (const r of archivedFor(archivedDir, tankDoors)) {
    if (sentIds.has(await contentId(r.b))) { unlinkSync(r.file); released++; }
  }
  const prev = ledger.entries[ledger.entries.length - 1] || null;
  const entry = { seq: ledger.entries.length, at, kind: "release", pile: id, released,
    receipts: verified, prev_hash: prev ? prev.this_hash : null };
  entry.this_hash = await contentId(entry);
  ledger.entries.push(entry);
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");
  walkStatus(keyringPath, id, "torn-down", "flushed", "flushed_at", at);
  return { id, released, verified, report: path.join("archived", "reports", `${id}.json`) };
}

// ---- CLI --------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {}; const map = { "--id": "id", "--common": "common" };
  for (let i = 0; i < argv.length; i++) {
    const k = map[argv[i]];
    if (!k) throw new Error(`retire: unknown arg ${argv[i]}`);
    out[k] = argv[++i];
  }
  return out;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) {
    const out = await runRetirePlan(root);
    console.error(`retire (${out.self}): ${out.plan.length} tank(s) earned retirement (needs a judge), ` +
      `${out.holding.length} holding -> retire-plan.json`);
  } else if (cmd === "deflate") {
    const r = await runDeflate(root, parseArgs(rest));
    console.error(`retire: deflated '${r.id}' — ${r.moved.length} record(s) moved whole to archived/, report at ${path.relative(root, r.reportPath)}; keyring walked to deflated`);
  } else if (cmd === "teardown") {
    const r = await runTeardown(root, parseArgs(rest));
    console.error(`retire: '${r.id}' recorded torn-down. The remote gesture is yours:\n  - ${r.gesture.join("\n  - ")}`);
  } else if (cmd === "flush") {
    const r = await runFlush(root, parseArgs(rest));
    for (const b of r.bundles) console.error(`retire: teleport for ${b.antidote}${b.reused ? " (already composed)" : ` — ${b.count} record(s)`} at ${b.file}, digest ${b.digest.slice(0, 23)}…`);
    for (const s of r.skipped) console.error(`retire: SKIPPED ${s.antidote}: ${s.why}`);
    console.error(`retire: ${r.deliver}`);
  } else if (cmd === "release") {
    const r = await runRelease(root, parseArgs(rest));
    console.error(`retire: released '${r.id}' — ${r.released} raw record(s) left archived/ against ${r.verified.length} verified receipt(s); the report stays at ${r.report}; keyring walked to flushed`);
  } else {
    console.error("usage: bin/retire            # plan (writes retire-plan.json)\n" +
      "       bin/retire deflate --id TANK\n       bin/retire teardown --id TANK\n" +
      "       bin/retire flush --id TANK [--common sha256:…]\n       bin/retire release --id TANK");
    process.exit(2);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
