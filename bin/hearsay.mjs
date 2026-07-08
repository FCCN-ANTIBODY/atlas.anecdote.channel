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
//     MANY DOORS, ONE TANK: several questions may share one kept pile. A keyring row is a DOOR
//     — the question, in the open, routing what answers it — and recording a door on an id the
//     keyring already keeps JOINS that tank, inheriting its recipient/repo (omit --recipient).
//     Every door on a tank names the same recipient; a mismatch is refused, never rewritten.
//
//   front — RE-PUBLICATION under our own signature (the CONSTITUTION's fronting clause): mint
//     the constellation's own fronted-poll artifact (anecdote.atlaspoll/v1, byte-compatible
//     with composer/atlaspoll.mjs) for a question the keyring keeps — fronts = this Atlas,
//     age_recipient = the keep's public recipient — signed by the front signer
//     (keys/front-signer.pk8, gitignored; public fingerprint at keys/front.fpr, the
//     dump-signer pattern) and held in _data/atlaspolls.json. The signed question travels:
//     dropped at any peer Atlas, their EXISTING custody machinery can now seal stand-in piles
//     back toward this keep (the absent-owner path, with us as the reachable owner). Ed25519
//     is deterministic, so re-fronting the same door re-produces the same artifact.
//
//   bin/hearsay                      # plan: write hearsay-plan.json (for a judge)
//   bin/hearsay record --id ID --pile PILE --poll POLL --scope SCOPE \
//     --repo-url URL --recipient age1… [--question TEXT]   # new tank
//   bin/hearsay record --id KEPT-ID --pile PILE --poll POLL [--scope --question]  # join a tank
//   bin/hearsay front --pile PILE --poll POLL [--license TERMS]
//
// Env (ATLAS_* overrides): ATLAS_CUSTODY_PLAN (default custody-plan.json), ATLAS_HEARSAY
// (default _data/hearsay-piles.yml), ATLAS_HEARSAY_OUT (default hearsay-plan.json),
// ATLAS_ATLASPOLLS (default _data/atlaspolls.json), ATLAS_FRONT_KEY (default
// keys/front-signer.pk8), ATLAS_ARCHIVE (default _data/drop-archive), ATLAS_PILE_OWNER (the
// GitHub owner the provisioning gesture would create pile repos under; narration only).

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { readItems, attest } from "./drop.mjs";
import { loadOrCreateSigner } from "./dump.mjs";

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
  // The judge picks a gesture per candidate: JOIN a live tank in the same scope (a new door on an
  // existing keep — the retirement-cohort heuristic), or PROVISION a fresh tank; then FRONT it.
  const liveTanks = [...new Map(kept.filter((k) => (k.status || "live") === "live").map((k) => [k.id, k])).values()];
  const plan = [], already = [];
  for (const c of custody?.archiveOnly || []) {
    if (keptQuestions.has(`${c.pile}/${c.poll}`)) { already.push({ pile: c.pile, poll: c.poll, why: "already kept — see the keyring" }); continue; }
    const id = `${c.pile}-hearsay`.slice(0, 63);
    const scopeArg = c.scope || "<scope>";
    const tank = liveTanks.find((t) => t.scope === c.scope) || null;
    plan.push({
      pile: c.pile, poll: c.poll, scope: c.scope ?? null, mass: c.mass, rose: c.reason, unowned: c.why,
      needs: "judge", // NEVER provisioned by this script — a judge/human consents, then provisions
      gesture: {
        ...(tank ? { join: `bin/hearsay record --id ${tank.id} --pile ${c.pile} --poll ${c.poll} --scope ${scopeArg}  # a new door on the live '${tank.id}' tank (inherits its recipient/repo)` } : {}),
        provision: `data-pile/bin/pile-new create --owner ${owner} --id ${id} --scope ${scopeArg} --keygen`,
        record: `bin/hearsay record --id ${id} --pile ${c.pile} --poll ${c.poll} --scope ${scopeArg} --repo-url https://github.com/${owner}/${id} --recipient <the new pile's keys/pile.age.pub>`,
        fill: `data-pile/bin/drop-pack --dir <checkout of the tank repo> --sign <ATLAS drop signer> <the archived ballots>  # then push feed/drop`,
        front: `bin/hearsay front --pile ${c.pile} --poll ${c.poll}  # re-publish the question under our signature`,
      },
    });
  }

  const out = { schema: "atlas.hearsay-plan/v1", self, at,
    plan, alreadyKept: already,
    note: custody ? undefined : "no custody-plan.json — run bin/custody first (honest default: nothing rises)" };
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  return out;
}

// ---- record: append a keyring DOOR (public halves only; doors on one id share one tank) ------------------
export function recordHearsayPile(root, args) {
  const { id, pile, poll, scope, question } = args;
  const at = args.now || new Date().toISOString();
  const keyringPath = args.keyring || process.env.ATLAS_HEARSAY || path.join(root, "_data/hearsay-piles.yml");

  if (!id || !SLUG_RE.test(id) || id.length > 63) throw new Error("hearsay record: --id must be a lowercase slug that fits a DNS label");
  if (!pile || !poll) throw new Error("hearsay record: --pile and --poll are required (the question identity this door routes)");
  if (/AGE-SECRET-KEY/i.test(JSON.stringify(args))) throw new Error("hearsay record: an identity was passed where only a recipient may go");

  // Joining an existing tank inherits its public halves; a NEW tank must bring its own.
  const kept = readKeyring(keyringPath);
  const tank = kept.filter((k) => k.id === id);
  const recipient = args.recipient || tank[0]?.age_recipient || "";
  const repoUrl = args.repoUrl || tank[0]?.repo_url || "";
  if (!recipient) throw new Error("hearsay record: --recipient required for a new keep (or --id a tank the keyring already keeps, to join it)");
  if (!RECIPIENT_RE.test(recipient)) throw new Error("hearsay record: the recipient is not an age recipient (age1…) — the keyring posts the PUBLIC half only");
  if (tank.length && tank[0].age_recipient !== recipient)
    throw new Error(`hearsay record: tank ${id} keeps a DIFFERENT recipient — every door on a tank names the same recipient, never silently rewritten`);
  if (tank.length && tank[0].repo_url && repoUrl && tank[0].repo_url !== repoUrl)
    throw new Error(`hearsay record: tank ${id} lives at a DIFFERENT repo — never silently rewritten`);
  if (tank.some((k) => k.pile === pile && k.poll === poll)) return { id, already: true }; // idempotent re-record of a door

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
  return { id, already: false, joined: tank.length > 0 };
}

// ---- front: re-publish a kept question as a self-fronted atlaspoll ----------------------------------------
export async function frontQuestion(root, { pile, poll, license, keyring, out, keyPath } = {}) {
  const keyringPath = keyring || process.env.ATLAS_HEARSAY || path.join(root, "_data/hearsay-piles.yml");
  const outPath = out || process.env.ATLAS_ATLASPOLLS || path.join(root, "_data/atlaspolls.json");
  const kp = keyPath || process.env.ATLAS_FRONT_KEY || path.join(root, "keys/front-signer.pk8");
  if (!pile || !poll) throw new Error("hearsay front: --pile and --poll are required");

  // Front only what the keyring keeps, live: the artifact points answers at a tank that exists.
  const door = readKeyring(keyringPath).find((k) => k.pile === pile && k.poll === poll && (k.status || "live") === "live");
  if (!door) throw new Error(`hearsay front: no live keyring door for ${pile}/${poll} — I front only questions I keep`);
  if (!RECIPIENT_RE.test(door.age_recipient || "")) throw new Error(`hearsay front: keyring door for ${pile}/${poll} has no valid recipient`);

  // The constellation's own artifact (mirrors composer/atlaspoll.mjs buildAtlasPoll + signAtlasPoll).
  const unsigned = { schema: "anecdote.atlaspoll/v1", pile, poll, fronts: selfId(root), stores_public: true,
    age_recipient: door.age_recipient };
  if (license) unsigned.license = license;
  if (door.scope) unsigned.scope = door.scope;
  const signer = await loadOrCreateSigner(kp, { create: true });
  const signed = await attest(unsigned, signer);
  writeFileSync(path.join(path.dirname(kp), "front.fpr"), signer.fingerprint + "\n"); // the public half rides beside the key

  // Hold it with the fronted polls we hold from anyone else; replace only OUR OWN prior front of
  // this same question (Ed25519 is deterministic, so a re-front replaces with identical bytes).
  const held = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : [];
  const rest = held.filter((f) => !(f?.pile === pile && f?.poll === poll && f?.sig?.by === signer.fingerprint));
  rest.push(signed);
  writeFileSync(outPath, JSON.stringify(rest, null, 2) + "\n");
  return { signed, fingerprint: signer.fingerprint, outPath };
}

// ---- CLI -------------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {}; const map = { "--id": "id", "--pile": "pile", "--poll": "poll", "--scope": "scope",
    "--repo-url": "repoUrl", "--recipient": "recipient", "--question": "question", "--license": "license" };
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
    console.error(r.already ? `hearsay: that door is already on the keyring (no change)` :
      `hearsay: door recorded on the public keyring${r.joined ? ` — joined the '${r.id}' tank` : ` (new tank '${r.id}')`}`);
  } else if (cmd === "front") {
    const { signed, fingerprint } = await frontQuestion(root, parseArgs(rest));
    console.error(`hearsay: fronted ${signed.pile}/${signed.poll} under ${fingerprint.slice(0, 24)}… -> _data/atlaspolls.json\n` +
      `hearsay: the signed question travels — hand it to any Atlas; their custody can seal stand-in piles to this keep`);
  } else if (!cmd) {
    const out = runHearsayPlan(root);
    console.error(`hearsay (${out.self}): ${out.plan.length} shadow question(s) rise to a keep (needs a judge), ` +
      `${out.alreadyKept.length} already kept -> hearsay-plan.json`);
  } else {
    console.error("usage: bin/hearsay            # plan (writes hearsay-plan.json)\n" +
      "       bin/hearsay record --id ID --pile PILE --poll POLL [--scope --question] [--repo-url URL --recipient age1…]\n" +
      "       bin/hearsay front --pile PILE --poll POLL [--license TERMS]");
    process.exit(2);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
