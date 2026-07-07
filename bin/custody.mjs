// bin/custody.mjs — THE STAND-IN CUSTODY DECISION (civic-node #86 Slice 3). The drop door
// (bin/drop.mjs) FLOODS + archives ballots it can't home. This is the gated question of whether an
// un-homed poll has accumulated enough to deserve a STAND-IN ballot-box pile — and it only ever
// PLANS. It never provisions: standing up the pile (data-pile bin/pile-new --provisioner, signing the
// delivery manifest) is the deferred imperative step, and it is done on a JUDGE's or a human's
// consent, never by this script and never unattended.
//
// The trigger (all must hold):
//   no live door  — the pile is not one I list (the drop door already flooded it; it is un-homed).
//   held fronted poll — I hold a verifiable anecdote.atlaspoll/v1 for this (pile,poll) (#87). It is
//                   what tells me WHO the owner is (custody must seal to the owner's age recipient,
//                   which data-pile forbids a provisioner from holding) and who authored it.
//   mass OR scope-fit — either enough un-homed ballots have accumulated (mass >= ATLAS_CUSTODY_MASS)
//                   OR the poll's scope is one I claim a boundary for (ATLAS_CUSTODY_SCOPES).
//
// HONEST DEFAULTS FIRE NOTHING. Mass defaults to Infinity and claimed-scopes defaults to empty, so
// custody-plan.json is empty until an operator sets a policy — the open "mass vs scope-fit" question
// is thus POLICY, not a hard-coded pick. And a poll that rises but whose fronted poll carries NO age
// recipient can't be sealed: it degrades to archive-only (recorded, never silently custodied).
//
//   bin/custody     # read the archive + fronted polls, write custody-plan.json (a plan for a judge)
// Env (ATLAS_* overrides): ATLAS_CUSTODY_MASS (int), ATLAS_CUSTODY_SCOPES (comma list),
//   ATLAS_LINEAGE (comma list of trusted Atlas fingerprints), ATLAS_ARCHIVE, ATLAS_ATLASPOLLS,
//   ATLAS_PILES, ATLAS_CUSTODY_OUT.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { verifyAttested, contentId, readItems } from "./drop.mjs";

// ---- vendored atlaspoll accessors (mirror composer/atlaspoll.mjs; this repo is stdlib-only) --------------
const ATLASPOLL_SCHEMA = "anecdote.atlaspoll/v1";
export function isAtlasPoll(p) {
  return !!p && p.schema === ATLASPOLL_SCHEMA && typeof p.pile === "string" && typeof p.poll === "string" &&
    typeof p.fronts === "string" && !!p.sig;
}
export async function verifyAtlasPoll(signed, { lineage = [] } = {}) {
  if (!isAtlasPoll(signed)) return { ok: false, by: null, trusted: false };
  const v = await verifyAttested(signed);
  return { ok: v.ok, by: v.by, trusted: v.ok && !!v.by && lineage.includes(v.by) };
}
export const custodyRecipient = (f) => (isAtlasPoll(f) && f.age_recipient) || null;
export const instigatorOf = (f) => (isAtlasPoll(f) && f.instigator) || undefined;

// ---- helpers ---------------------------------------------------------------------------------------------
function scalar(yml, key) { const m = yml.match(new RegExp(`^${key}:\\s*(.*)$`, "m")); return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : ""; }
function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback; }
function envList(v) { return (v || "").split(",").map((s) => s.trim()).filter(Boolean); }

// walk the content-addressed archive: <archive>/<scope>/<poll>/<id>.json -> the kept ballot objects.
// (exported: bin/hearsay.mjs and bin/tee.mjs read the same keep.)
export function readArchive(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const scope of readdirSync(dir, { withFileTypes: true })) {
    if (!scope.isDirectory()) continue;
    const sdir = path.join(dir, scope.name);
    for (const poll of readdirSync(sdir, { withFileTypes: true })) {
      if (!poll.isDirectory()) continue;
      const pdir = path.join(sdir, poll.name);
      for (const f of readdirSync(pdir)) {
        if (!f.endsWith(".json")) continue;
        try { out.push(JSON.parse(readFileSync(path.join(pdir, f), "utf8"))); } catch { /* skip unreadable */ }
      }
    }
  }
  return out;
}

// ---- the planner: decide which un-homed polls rise to custody, and how -----------------------------------
export async function runCustody(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const archiveDir = opts.archiveDir || p("ATLAS_ARCHIVE", "_data/drop-archive");
  const atlaspollsPath = opts.atlaspolls || p("ATLAS_ATLASPOLLS", "_data/atlaspolls.json");
  const pilesPath = p("ATLAS_PILES", "_data/piles.yml");
  const outPath = opts.out || p("ATLAS_CUSTODY_OUT", "custody-plan.json");

  const mass = opts.mass ?? (process.env.ATLAS_CUSTODY_MASS ? +process.env.ATLAS_CUSTODY_MASS : Infinity);
  const claimedScopes = new Set(opts.scopes ?? envList(process.env.ATLAS_CUSTODY_SCOPES));
  const lineage = opts.lineage ?? envList(process.env.ATLAS_LINEAGE);

  const selfYml = existsSync(path.join(root, "atlas.yml")) ? readFileSync(path.join(root, "atlas.yml"), "utf8") : "";
  const self = { id: scalar(selfYml, "id") || "atlas" };

  const listedPiles = new Set(readItems(existsSync(pilesPath) ? readFileSync(pilesPath, "utf8") : "").map((x) => x.id).filter(Boolean));
  const fronted = readJson(atlaspollsPath, []);

  // group the archive by (pile,poll,scope), counting DISTINCT ballots (content-id) as the mass.
  const groups = new Map();
  for (const b of readArchive(archiveDir)) {
    if (!b || typeof b.pile !== "string" || typeof b.poll !== "string") continue;
    const key = `${b.pile} ${b.poll} ${b.scope || ""}`;
    if (!groups.has(key)) groups.set(key, { pile: b.pile, poll: b.poll, scope: b.scope || null, ids: new Set() });
    groups.get(key).ids.add(await contentId(b));
  }

  // find a verifiable fronted poll for a (pile,poll): first that verifies; prefer a trusted one.
  const frontedFor = async (pile, poll) => {
    let best = null;
    for (const fp of fronted) {
      if (!isAtlasPoll(fp) || fp.pile !== pile || fp.poll !== poll) continue;
      const v = await verifyAtlasPoll(fp, { lineage });
      if (!v.ok) continue;
      if (v.trusted) return { fp, v };
      best = best || { fp, v };
    }
    return best;
  };

  const plan = [], archiveOnly = [], skipped = [];
  for (const g of groups.values()) {
    const massN = g.ids.size;
    if (listedPiles.has(g.pile)) { skipped.push({ ...brief(g, massN), why: "homed — a pile I list" }); continue; }
    const scopeFit = !!g.scope && claimedScopes.has(g.scope);
    const massFit = massN >= mass;
    if (!scopeFit && !massFit) { skipped.push({ ...brief(g, massN), why: "below threshold (no mass, no scope-fit)" }); continue; }
    const reason = scopeFit && massFit ? "both" : scopeFit ? "scope-fit" : "mass";
    const found = await frontedFor(g.pile, g.poll);
    if (!found) { archiveOnly.push({ ...brief(g, massN), reason, why: "no verifiable fronted poll — cannot verify or seal" }); continue; }
    const recipient = custodyRecipient(found.fp);
    if (!recipient) { archiveOnly.push({ ...brief(g, massN), reason, why: "fronted poll carries no age recipient — nothing to seal to" }); continue; }
    plan.push({
      ...brief(g, massN), reason,
      recipient, instigator: instigatorOf(found.fp), fronts: found.fp.fronts, trusted: found.v.trusted,
      ballotIds: [...g.ids].sort(),
      needs: "judge", // NEVER provisioned by this script — a judge/human consents, then provisions
    });
  }

  const out = { schema: "atlas.custody-plan/v1", self: self.id, at,
    policy: { mass: mass === Infinity ? null : mass, scopes: [...claimedScopes] },
    plan, archiveOnly, skipped };
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  return out;
}
function brief(g, mass) { return { pile: g.pile, poll: g.poll, scope: g.scope, mass }; }

// ---- CLI -------------------------------------------------------------------------------------------------
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const out = await runCustody(root);
  console.error(`custody (${out.self}): ${out.plan.length} rise to a stand-in pile (needs a judge), ` +
    `${out.archiveOnly.length} archive-only, ${out.skipped.length} skipped -> custody-plan.json`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
