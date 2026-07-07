// bin/hearsay.mjs — THE ATLAS-OWNED HEARSAY PILE (civic-node #91). bin/custody plans stand-in
// custody for polls whose OWNER is findable; what it can't seal degrades to archiveOnly — the
// dead-end this turns live. A direct-drop ballot with no Tell, no fronted poll, and no findable
// owner is a SHADOW QUESTION: a question known only because we hold answers to it. Here the Atlas
// itself becomes the keeper — data-pile `pile-new --keygen` (Computer posture: the identity is the
// new pile repo's own PILE_AGE_IDENTITY secret), operated exactly like any other keeper, no
// deviations — transient by intent, deflated losslessly to the archive when it goes quiet.
//
// Two halves, and only one ever acts:
//
//   plan (default) — read custody-plan.json's archiveOnly + the drop archive, and write
//     hearsay-plan.json: each ownerless (pile,poll) that rose to custody but could not be sealed,
//     with the EXACT provisioning gesture spelled out. needs:"judge" — this script never
//     provisions. HONEST DEFAULTS FIRE NOTHING: no custody plan, no candidates.
//
//   record — the post-consent registration: after a judge/human ran the provisioning gesture
//     (or .github/workflows/hearsay-provision.yml did, on a dispatch = the consent), append the
//     new pile to the PUBLIC KEYRING _data/hearsay-piles.yml. The keyring holds no secrets:
//     the pile's age RECIPIENT is the postable face of its key — derived from the secret,
//     useless for reading. Proof of possession is a REVEAL (data-pile bin/prove), never a
//     surrender; keys are minted fresh per pile, never derived from a master.
//
//   bin/hearsay                      # plan: write hearsay-plan.json (for a judge)
//   bin/hearsay record --id ID --pile PILE --poll POLL --scope SCOPE \
//     --repo-url URL --recipient age1… [--question TEXT]
//
// Env (ATLAS_* overrides): ATLAS_CUSTODY_PLAN (default custody-plan.json), ATLAS_HEARSAY
// (default _data/hearsay-piles.yml), ATLAS_HEARSAY_OUT (default hearsay-plan.json),
// ATLAS_ARCHIVE (default _data/drop-archive), ATLAS_PILE_OWNER (the GitHub owner the
// provisioning gesture would create pile repos under; narration only).

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { readItems } from "./drop.mjs";

const RECIPIENT_RE = /^age1[ac-hj-np-z02-9]{58}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function scalar(yml, key) { const m = yml.match(new RegExp(`^${key}:\\s*(.*)$`, "m")); return m ? m[1].replace(/\s+#.*$/, "").trim().replace(/^"(.*)"$/, "$1") : ""; }
function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback; }
export function readKeyring(p) { return existsSync(p) ? readItems(readFileSync(p, "utf8")) : []; }

function selfId(root) {
  const yml = existsSync(path.join(root, "atlas.yml")) ? readFileSync(path.join(root, "atlas.yml"), "utf8") : "";
  return scalar(yml, "id") || "atlas";
}

// ---- plan: the ownerless residue of the custody plan, with the gesture spelled out -----------------------
export function runHearsayPlan(root, opts = {}) {
  const at = opts.now || new Date().toISOString();
  const p = (env, rel) => process.env[env] || path.join(root, rel);
  const custodyPath = opts.custodyPlan || p("ATLAS_CUSTODY_PLAN", "custody-plan.json");
  const keyringPath = opts.keyring || p("ATLAS_HEARSAY", "_data/hearsay-piles.yml");
  const outPath = opts.out || p("ATLAS_HEARSAY_OUT", "hearsay-plan.json");
  const owner = opts.owner || process.env.ATLAS_PILE_OWNER || "<owner>";

  const self = selfId(root);
  const custody = readJson(custodyPath, null);
  const kept = readKeyring(keyringPath);
  const keptQuestions = new Set(kept.map((k) => `${k.pile}/${k.poll}`));

  // The candidates are exactly custody's archiveOnly rows: they ROSE (mass or scope-fit — the same
  // honest thresholds; nothing here re-lowers them) but no owner could be found or sealed to.
  const plan = [], already = [];
  for (const c of custody?.archiveOnly || []) {
    if (keptQuestions.has(`${c.pile}/${c.poll}`)) { already.push({ pile: c.pile, poll: c.poll, why: "already kept — see the keyring" }); continue; }
    const id = `${c.pile}-hearsay`.slice(0, 63);
    plan.push({
      pile: c.pile, poll: c.poll, scope: c.scope ?? null, mass: c.mass, rose: c.reason, unowned: c.why,
      needs: "judge", // NEVER provisioned by this script — a judge/human consents, then provisions
      gesture: {
        provision: `data-pile/bin/pile-new create --owner ${owner} --id ${id} --scope ${c.scope || "<scope>"} --keygen`,
        record: `bin/hearsay record --id ${id} --pile ${c.pile} --poll ${c.poll} --scope ${c.scope || "<scope>"} --repo-url https://github.com/${owner}/${id} --recipient <the new pile's keys/pile.age.pub>`,
        fill: `data-pile/bin/drop-pack --dir <checkout of ${owner}/${id}> --sign <ATLAS drop signer> <the archived ballots>  # then push feed/drop`,
      },
    });
  }

  const out = { schema: "atlas.hearsay-plan/v1", self, at,
    plan, alreadyKept: already,
    note: custody ? undefined : "no custody-plan.json — run bin/custody first (honest default: nothing rises)" };
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  return out;
}

// ---- record: append the keyring entry (public halves only) -----------------------------------------------
export function recordHearsayPile(root, args) {
  const { id, pile, poll, scope, repoUrl, recipient, question } = args;
  const at = args.now || new Date().toISOString();
  const keyringPath = args.keyring || process.env.ATLAS_HEARSAY || path.join(root, "_data/hearsay-piles.yml");

  if (!id || !SLUG_RE.test(id) || id.length > 63) throw new Error("hearsay record: --id must be a lowercase slug that fits a DNS label");
  if (!pile || !poll) throw new Error("hearsay record: --pile and --poll are required (the question identity this pile keeps)");
  if (!recipient || !RECIPIENT_RE.test(recipient)) throw new Error("hearsay record: --recipient is not an age recipient (age1…) — the keyring posts the PUBLIC half only");
  if (recipient.includes("SECRET") || /AGE-SECRET-KEY/i.test(JSON.stringify(args))) throw new Error("hearsay record: an identity was passed where only a recipient may go");

  const kept = readKeyring(keyringPath);
  const dup = kept.find((k) => k.id === id);
  if (dup) {
    if (dup.age_recipient === recipient) return { id, already: true }; // idempotent re-record
    throw new Error(`hearsay record: id ${id} already kept with a DIFFERENT recipient — a keyring entry is never silently rewritten`);
  }

  const self = selfId(root);
  const y = (s) => `"${String(s).replace(/"/g, "")}"`;
  let entry = `- id: ${id}\n  pile: ${y(pile)}\n  poll: ${y(poll)}\n`;
  if (scope) entry += `  scope: ${y(scope)}\n`;
  if (question) entry += `  question: ${y(question)}\n`;
  if (repoUrl) entry += `  repo_url: ${y(repoUrl)}\n`;
  entry += `  age_recipient: ${y(recipient)}\n`;
  entry += `  provisioner: ${y(`self:${self}`)}\n  provisioner_spec: "data-pile/pile-new/v1"\n`;
  entry += `  provisioned_at: ${y(at)}\n  status: live\n`;
  appendFileSync(keyringPath, entry);
  return { id, already: false };
}

// ---- CLI -------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {}; const map = { "--id": "id", "--pile": "pile", "--poll": "poll", "--scope": "scope",
    "--repo-url": "repoUrl", "--recipient": "recipient", "--question": "question" };
  for (let i = 0; i < argv.length; i++) {
    const k = map[argv[i]];
    if (!k) throw new Error(`hearsay: unknown arg ${argv[i]}`);
    out[k] = argv[++i];
  }
  return out;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "record") {
    const r = recordHearsayPile(root, parseArgs(rest));
    console.error(r.already ? `hearsay: ${r.id} already on the keyring (no change)` : `hearsay: ${r.id} recorded on the public keyring (_data/hearsay-piles.yml)`);
  } else if (!cmd) {
    const out = runHearsayPlan(root);
    console.error(`hearsay (${out.self}): ${out.plan.length} shadow question(s) rise to a keep (needs a judge), ` +
      `${out.alreadyKept.length} already kept -> hearsay-plan.json`);
  } else {
    console.error("usage: bin/hearsay            # plan (writes hearsay-plan.json)\n" +
      "       bin/hearsay record --id ID --pile PILE --poll POLL --scope SCOPE --repo-url URL --recipient age1…");
    process.exit(2);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
