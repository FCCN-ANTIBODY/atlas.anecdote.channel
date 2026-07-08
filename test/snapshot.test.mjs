// Unit: the signed snapshot (bin/snapshot.mjs, civic-node#71 "real at one time"). The export signs
// exactly the record served — inline content, per-file content-ids, a stamped date, absences named —
// under the one ledger signer; verify is from-anyone with the ok/trusted split; ingest keeps both
// dates (staleness honest), never replaces newer with older, and never swaps canons (a different
// signer) without the operator's hand. Run: node test/snapshot.test.mjs
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runExport, buildSnapshot, verifySnapshot, compareSnapshots, runIngest } from "../bin/snapshot.mjs";
import { attest, generateIdentity } from "../bin/drop.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };
const T1 = "2026-07-01T00:00:00.000Z", T2 = "2026-07-08T00:00:00.000Z";

function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), "atlas-snapshot-"));
  mkdirSync(path.join(dir, "_data"), { recursive: true });
  mkdirSync(path.join(dir, "keys"), { recursive: true });
  writeFileSync(path.join(dir, "atlas.yml"), `id: colorado\nurl: "https://atlas.example.org"\n`);
  writeFileSync(path.join(dir, "_data/tells.yml"), `- id: tell\n  scope: colorado\n`);
  writeFileSync(path.join(dir, "_data/piles.yml"), `- id: cd04-q1\n  scope: colorado\n`);
  return dir;
}
const keyOf = (dir) => path.join(dir, "keys/dump-signer.pk8");

// 1. export signs exactly the record: content inline, ids match, absences named, date stamped.
const dir = scratch();
{
  const { signed, fingerprint } = await runExport(dir, { now: T2, keyPath: keyOf(dir), out: path.join(dir, "snapshot.json") });
  ok(signed.schema === "atlas.snapshot/v1" && signed.atlas === "colorado" && signed.at === T2, "the envelope names the atlas and stamps the date");
  ok(signed.files.length === 2 && signed.files.every((f) => f.content && /^sha256:/.test(f.id)),
    "present registries ride verbatim, each under its own content-id");
  ok(signed.absent.includes("matches.json") && signed.absent.includes("_data/needs.yml"),
    "what the record lacks is NAMED inside the signature, never silently missing");
  const v = await verifySnapshot(signed, { signer: fingerprint });
  ok(v.ok && v.trusted && v.at === T2, "verifies from anyone; trusted against the pinned ledger signer");
  ok(readFileSync(path.join(dir, "keys/dump.fpr"), "utf8").trim() === fingerprint, "the public fingerprint rides at keys/dump.fpr");
}

// 2. one flipped byte anywhere breaks it — the signature covers the carried content.
{
  const signed = JSON.parse(readFileSync(path.join(dir, "snapshot.json"), "utf8"));
  const doctored = JSON.parse(JSON.stringify(signed));
  const pile = doctored.files.find((f) => f.path === "_data/piles.yml");
  pile.content = pile.content.replace("cd04-q1", "cd04-q9");
  const v = await verifySnapshot(doctored);
  ok(!v.ok, "edited content fails verification (the envelope is content-bound)");
  const redated = JSON.parse(JSON.stringify(signed));
  redated.at = "2027-01-01T00:00:00.000Z";
  ok(!(await verifySnapshot(redated)).ok, "a re-stamped date fails — never a freshness the Atlas did not stamp");
}

// 3. a forgery verifies-from-anyone but is NOT the pinned signer — trust decides action.
{
  const impostor = await generateIdentity();
  const forged = await attest(await buildSnapshot(dir, { now: T2 }), impostor);
  const pinned = readFileSync(path.join(dir, "keys/dump.fpr"), "utf8").trim();
  const v = await verifySnapshot(forged, { signer: pinned });
  ok(v.ok && !v.trusted && v.by === impostor.fingerprint, "ok from anyone; untrusted against the pin");
}

// 4. ingest keeps both dates; refuses the wrong pin on first contact.
const carrier = scratch(); // the device that carries/keeps copies
{
  const pinned = readFileSync(path.join(dir, "keys/dump.fpr"), "utf8").trim();
  writeFileSync(path.join(carrier, "in.json"), readFileSync(path.join(dir, "snapshot.json")));
  let threw = false;
  try { await runIngest(carrier, { file: path.join(carrier, "in.json"), signer: "key:sha256:" + "0".repeat(64), now: T2 }); }
  catch { threw = true; }
  ok(threw, "first contact with the wrong pin is refused");
  const r = await runIngest(carrier, { file: path.join(carrier, "in.json"), signer: pinned, now: "2026-07-09T00:00:00.000Z" });
  const kept = JSON.parse(readFileSync(r.keptPath, "utf8"));
  ok(kept.stamped_at === T2 && kept.accepted_at === "2026-07-09T00:00:00.000Z" && kept.trusted === true,
    "the kept copy carries BOTH dates — staleness is honest, never hidden");
}

// 5. never silently replace newer with older; same stamp is a no-op; newer advances.
{
  const older = await runExport(dir, { now: T1, keyPath: keyOf(dir), out: path.join(dir, "older.json") });
  writeFileSync(path.join(carrier, "older.json"), JSON.stringify(older.signed));
  let threw = "";
  try { await runIngest(carrier, { file: path.join(carrier, "older.json"), now: T2 }); } catch (e) { threw = e.message; }
  ok(/never silently replaced with older/.test(threw), "an older stamp over the kept newer one is refused");
  const same = await runIngest(carrier, { file: path.join(carrier, "in.json"), now: T2 });
  ok(same.unchanged === true, "the same stamp is a no-op");
  const newer = await runExport(dir, { now: "2026-07-10T00:00:00.000Z", keyPath: keyOf(dir), out: path.join(dir, "newer.json") });
  writeFileSync(path.join(carrier, "newer.json"), JSON.stringify(newer.signed));
  const r = await runIngest(carrier, { file: path.join(carrier, "newer.json"), now: "2026-07-11T00:00:00.000Z" });
  ok(r.stamped_at === "2026-07-10T00:00:00.000Z", "a newer stamp advances the kept copy");
}

// 6. a different signer for the same atlas id never replaces the kept canon.
{
  const impostor = await generateIdentity();
  const forged = await attest(await buildSnapshot(dir, { now: "2026-07-12T00:00:00.000Z" }), impostor);
  writeFileSync(path.join(carrier, "forged.json"), JSON.stringify(forged));
  let threw = "";
  try { await runIngest(carrier, { file: path.join(carrier, "forged.json"), now: T2 }); } catch (e) { threw = e.message; }
  ok(/a new canon is a decision/.test(threw), "a fresher stamp under a DIFFERENT key is refused — swapping canons is the operator's act");
}

// 7. compare orders two copies of ONE canon; different canons are not comparable.
{
  const a = JSON.parse(readFileSync(path.join(dir, "older.json"), "utf8"));
  const b = JSON.parse(readFileSync(path.join(dir, "newer.json"), "utf8"));
  ok(compareSnapshots(a, b).newer === "b" && compareSnapshots(b, a).newer === "a", "two stamps of one canon order by date");
  const other = await attest(await buildSnapshot(dir, { now: T2 }), await generateIdentity());
  ok(compareSnapshots(a, other).comparable === false, "different signers are two canons, never two dates of one");
}

rmSync(dir, { recursive: true, force: true });
rmSync(carrier, { recursive: true, force: true });
if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall snapshot tests passed");
