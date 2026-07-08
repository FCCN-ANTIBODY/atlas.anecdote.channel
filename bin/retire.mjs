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
//   bin/retire                      # plan: write retire-plan.json (for a judge)
//   bin/retire deflate --id TANK
//   bin/retire teardown --id TANK
//
// Env (ATLAS_* overrides): ATLAS_QUIET_DAYS (UNSET => Infinity => nothing quiet), ATLAS_HEARSAY,
// ATLAS_ARCHIVE (default _data/drop-archive), ATLAS_TEE_LEDGER, ATLAS_ANTIDOTES, ATLAS_ARCHIVED
// (default archived/), ATLAS_RETIRE_OUT (default retire-plan.json).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { contentId, readItems } from "./drop.mjs";
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

// ---- CLI --------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {}; const map = { "--id": "id" };
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
  } else {
    console.error("usage: bin/retire            # plan (writes retire-plan.json)\n" +
      "       bin/retire deflate --id TANK\n       bin/retire teardown --id TANK");
    process.exit(2);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
