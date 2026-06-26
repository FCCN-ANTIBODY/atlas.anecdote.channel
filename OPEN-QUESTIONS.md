# Open questions (Atlas)

Deliberately-deferred design problems. Set aside, not forgotten. Each notes what it
**blocks** so we don't mistake "not yet decided" for "covered."

## 1. The weight/credibility mechanism behind the "open line"

`CONSTITUTION.md` attests that Atlas keeps an **open line** to every constituency instead of a
strictness gate: a report on that line **gains weight and credibility as it accumulates**, getting
harder for the constituency's real representatives to ignore. The *attestation* is binding now; the
*concrete mechanism* that materializes "weight" is unwritten.

- **Blocks:** any UI or aggregate that shows a constituency's standing rising over time; a
  machine-readable "credibility" signal a downstream aggregator could rank on; the point where the
  line's force becomes legible rather than promised.
- **Sketch (unbuilt):** a per-constituency tally derived from the reports Atlas aggregates (how long a
  line has stood, how much it has gathered), surfaced in `/tells.json` or a new `/standing.json` — and
  carried *without* publishing raw per-respondent counts (`CONSTITUTION.md` → "coarse standing"). Kept
  out for now: the input is the Tell transparency-report stream, which isn't aggregated yet (#2).

## 2. Aggregating Tell transparency reports upward

`CONSTITUTION.md` attests **affirmative escalation**: every report a listed Tell publishes is rolled
into **all** the constituency aggregations it belongs to. `CONTRACT.md` → "What listing requires" pins
the contract (a Tell describes its `reports/govern-…`; Atlas requires the shape and aggregates it). The
*aggregator itself* — the code that pulls each listed Tell's reports and rolls them up on a schedule —
is not built.

- **Blocks:** constituency/jurisdiction reports; the standing tally (#1); the whole point of being a
  directory that *aggregates*, not just lists.
- **Sketch (unbuilt):** a scheduled job (cf. `bin/match` + `match.yml`) that reads `_data/tells.yml`,
  fetches each Tell's described `reports` path, validates the shape its CONSTITUTION promised, and emits
  a coarse constituency rollup. Lands when a real listed Tell publishes reports to aggregate. Mirror of
  the Tell side's deferred "Atlas reporting-law contract"
  ([tell `OPEN-QUESTIONS.md` #7](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel/blob/main/OPEN-QUESTIONS.md)).

## 3. `bin/match` should resolve a pile's Tell by its `tell:` field

`_data/piles.yml` now records the `tell:` each pile groups behind. `bin/match` still resolves a
candidate's `tell_url` by **scope-first** (`_data/tells.yml` first entry in the need's scope), not by
the pile's own `tell:`. With one Tell per scope these agree; with several they could diverge.

- **Blocks:** correct addressing when a scope holds more than one Tell.
- **Sketch (unbuilt):** in `bin/match`, look up `tells[piles[i].tell].url` instead of scope-first. Small
  change; deferred to the Phase-B code pass that builds the Tell↔Atlas registration tooling, so the
  registry shape and the matcher move together and are exercised against a real second Tell.

## 4. Registration validation (the consent PR)

A Tell is listed by a signed PR appending to `_data/tells.yml` on a `tell/<scope>/<id>` branch
(`CONTRACT.md` → "Registering a Tell"). Today acceptance is **entirely manual** — a human merges the
PR. Nothing checks that the branch name matches the entry's `id`/`scope`, or that the commit's
signature matches the `signer` fingerprint the entry claims.

- **Blocks:** trustless listing; catching a registration whose branch/signature doesn't back its
  ownership claim before merge.
- **Sketch (unbuilt):** a PR check that (a) parses the appended entry, (b) confirms the head branch is
  `tell/<scope>/<id>` for that entry, and (c) verifies the head commit is signed by the key whose
  fingerprint equals `signer`. Deferred with the Phase-B tooling; needs the Tell-side `bin/register`
  landed first to produce PRs in the exact shape the check would enforce.
