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
- **Scope:** this validates *ownership* (who registered), not *fitness* (whether the registrant's
  constitution coheres with what this Atlas attests). Fitness is the **judge**, #5 — a distinct intake.

## 5. The summonable judge — the consent junction that gates registration

A signed registration proves **ownership** (#4: *who* is registering) but never **fitness** (*what* the
registrant's constitution commits to, and whether it coheres with what this Atlas attests). An ownership
signature vouches for identity; it cannot vouch for content. That gap is invisible while `register` is
narrow — it can only append a Tell's own self-description — but a **registry-agnostic `register`**
([tell `OPEN-QUESTIONS.md` #3](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel/blob/main/OPEN-QUESTIONS.md))
would let a node make this Atlas commit arbitrary buckets backed by arbitrary logic on the strength of an
ownership signature alone. The widening is only safe **when a judgement is rendered**; unattended, it
steals base on consent.

So a registration has **three consent intakes**, and an operator is choosing among them *per action*:

- **PR** — a human attests by merging. Registration already leans on this: the human in the merge loop
  *is* a judgement, by design.
- **judge** — an agent reads the registrant's live constitution and renders a fitness verdict. The
  pattern already exists as `bin/match`'s `ATLAS_MATCH_CMD` seam — the first summonable judge, today only
  in the matchmaker, not the registration path.
- **unattended** — a parent auto-signs all collection buckets with no per-item judgement. Cheapest to
  operate, and the **largest runtime judgement burden to make safe**; gateable by a cron batcher, but
  with practical cost limits per operator.

**The judge is a junction, not a hard gate.** It has an *available* state and a *not-available* state
(too busy, rate-limited, budget/quota spent, a manual switch, or the judge's own uncertainty). The
not-available state is exactly where a human steps in — which is the PR's human-merge intake. So the
registration judge is naturally **a PR hook that can stop _async_, awaiting a human**, for any reason it
can't decide: judge-when-it-can, human-when-it-can't — the two intakes unified rather than competing. The
same judge, used in `composite`, is also reusable for any constitution-comparison work it performs
elsewhere.

- **Blocks:** safely generalizing `register` (the widening needs this gate); a listing that isn't purely
  "a human merged it"; reusing one judge idiom everywhere constitutions are compared.
- **Constraint (load-bearing):** binding a registration *parent* to a **scaling** judgement workload is
  risky even batched — a large judgement backlog grinds the parent to a halt, and *to users that is
  indistinguishable from being down entirely*. So our actions must keep operating on **fixed buckets with
  narrow workload assurances**: an operator may run the judge always on some workloads and route others to
  human mode, but no action should hand the judge an unbounded queue.
- **Open (the judge action's I/O + authorization):**
  - how a judge action *receives* {the registrant's live constitution, the registry/parent context} and
    *emits* a verdict that gates a merge — including the async "awaiting a human" verdict — and how that
    verdict is recorded (a committed verdict, a transparency report, a PR label?);
  - if an Atlas calls a shared `FCCN-ANTIBODY/judge` action, how the calling node **identifies itself**
    and **proves the request is authorized**. The Atlas-side handle for "this is a legitimate judgement
    request" is its `needs/` board — but that is Atlas-specific, not a Tell notion, so it does not
    generalize down a tier. The authorization model for a shared judge is unsettled.
- **Elective (opt-in) judgement, and who pays for it.** Beyond *gating* registration, the same judge can
  be **summoned electively** by a node that wants its own boundary governed — judgement as a service it
  opts into, not a checkpoint imposed on it. (The pile-side governor in **closed
  [data-pile #6](https://github.com/FCCN-ANTIBODY/data-pile/pull/6)** — `bin/accept` + `questions/`
  guidance + an acceptance ledger — is the historical record of wanting exactly this; it was set aside as
  unsafe-by-default, but it can only ever land as an *optional* action, which is this question.) Open:
  how the cost/authority is sourced — the requester's **own private credentials** (they bring their own
  judge budget) vs. a **timeshare** on the Tell's or Atlas's judge capacity (the parent lends cycles under
  its own quota, against the fixed-bucket constraint above). Same authorization gap, seen from the
  *spender's* side rather than the gatekeeper's.

## 6. Requested search from a peer Atlas — the request→match→answer automation

`CONTRACT.md` → "Peering with another Atlas" lands the **foundation**: a peer registry
(`_data/atlases.yml`), an Atlas peer-signer (`keys/atlas.fpr` + `ATLAS_SIGNER_KEY`, via
`bin/atlas-bootstrap`), and the signed `atlas/<scope>/<id>` introduction gesture (`bin/register-atlas`
+ the `register-peer` action/workflow). What is **not** built is the live mechanism that lets a listed
peer *truthfully trigger this Atlas's matcher* and get an answer back — the reciprocal half of the deal.

- **Blocks:** cross-Atlas discovery — answering a friend's search over your own piles/Tells; the half of
  the peering deal that makes a peer entry worth more than a link.
- **Sketch (unbuilt):** (a) a **separate signed request queue** — a `request/<peer>/<id>` branch or
  `_data/requests.yml` — appended only by a PR whose commit verifies against a `signer` already in
  `_data/atlases.yml`, and kept **off** `/needs.json` (it is the peer's need, not this constituency's);
  (b) a `bin/match` **mode/trigger** that reads the queue and runs the existing judge over this Atlas's
  own candidates — internal and peer-requested search are one matcher, two triggers; (c) an **answer**
  step that opens a *signed PR back to the requesting peer* modifying the line for the address it knows
  (invitation, not delivery — one hop, no routing into the ultimate asker).
- **Deferred because:** there is **no second live Atlas** to handshake with yet, so the request/answer
  path can't be exercised end to end; and it is **coupled** to two existing deferrals — the
  registration-validation check (#4, which must now also cover `atlas/<scope>/<id>` peer PRs and verify
  against the new Atlas signer) and the **summonable judge** (#5, the same `ATLAS_MATCH_CMD` seam that
  would judge a requested search). Build it when a real peer exists and #4/#5 land.
- **Bounded to the first hop:** no transitive federation — a peer's peers are not yours. Connections
  beyond the first are explicitly out of scope until there is a model for them.
