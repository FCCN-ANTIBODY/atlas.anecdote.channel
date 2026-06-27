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

## 6. Requested search from a peer Atlas — the bill: emit + answer (live half deferred)

`CONTRACT.md` → "Peering with another Atlas" / "Requested search from a peer — the bill" now carries the
full design, and the **scaffold** is landed: the need shape gains a `constitution:` pointer
(`_data/needs.yml`, `needs.json`); `_data/requests.yml` is the empty-on-main inbound queue; `bin/bill`
assembles a bounded, needs-shaped bill (offline, pure); and `request-search` / `answer-bills` are
composite actions whose **offline halves run** (assemble the bill; run `bin/match` with
`ATLAS_NEEDS=<bill>` + `ATLAS_MATCH_CMD` over this Atlas's own candidates — internal search and a peer's
bill are one matcher, two triggers, honest `needs-judgment` default accepts nothing). What is **not** wired
is the live cross-Atlas half.

- **Blocks:** cross-Atlas discovery in practice — a friend's bill actually reaching a peer and an answer
  coming back; the half of the peering deal that makes a peer entry worth more than a link.
- **Unbuilt (the live half):** (a) `request-search` actually pushing the `request/<scope>/<id>` bill
  branch to the peer and opening the examine-not-merge PR (mirroring `bin/register-atlas`'s `pr`),
  **signed** and **gated** to a peer whose `signer` is already in `_data/atlases.yml`; (b) `answer-bills`
  reading those inbound `request/**` branches (not just an explicit `bill` input) and (c) delivering the
  accepted matches as **one bulk signed PR back** to the asking peer, modifying the line for the address
  it knows (invitation not delivery — one hop, never routing into the ultimate asker).
- **Deferred because:** there is **no second live Atlas** to handshake with yet, so the emit/answer path
  can't be exercised end to end; and it is **coupled** to two existing deferrals — the
  registration-validation check (#4, which must now also cover `atlas/<scope>/<id>` peer PRs and
  `request/<scope>/<id>` bill branches, verifying the commit signature against the peer's `signer`) and
  the **summonable judge** (#5, the `ATLAS_MATCH_CMD` seam that weighs each bill line's constitutional
  fit — nearly necessary once a bill drags in a constitution per line). Wire it when a real peer exists
  and #4/#5 land.
- **No eviction, by construction:** because the bill lives only on a replace-each-cycle branch over an
  empty-on-main queue, the receiver never tracks or evicts a peer's asks — an ask persists only by the
  asker **re-including** it (eviction-by-re-inclusion), spending part of its bounded block size.
- **Bounded to the first hop:** no transitive federation — a peer's peers are not yours. Connections
  beyond the first are explicitly out of scope until there is a model for them.

## 7. Asker-side bill governance — curating one's own on-offer asks

Eviction is handled by re-inclusion (#6): a bill is ephemeral, so the only thing that keeps an ask alive
is the asker putting it back in the next bill, within a bounded block size. That makes the **asker side**
the real point of inspection: *which* of an Atlas's on-offer needs go into a bill, in what priority, and
how the block is sized against a peer's capacity to weigh it. `bin/bill` today does the floor — take the
first `--max` needs in file order — and nothing smarter.

- **Blocks:** a bill that reflects intent rather than file order; fairness across an asker's own needs
  over successive cycles (so a low-priority ask isn't starved or a stale one isn't re-sent forever);
  sizing the block to the friend's judge budget rather than a fixed cap.
- **Sketch (unbuilt):** a selection/priority seam in `bin/bill` (recency, an explicit `priority:` or
  `offer:` field on a need, round-robin across cycles) and a negotiated/observed block size per peer.
  Deferred until the live emit/answer (#6) gives real signal about what a good bill looks like — curation
  is premature before a bill is actually carried and weighed.
- **Note:** this is the asker's own governance of itself; it asks nothing of the friend, who by
  construction (#6) keeps no state to govern.

## 8. The hub geo-fill — the scanner's state, and portability beyond home

The **baked-QR identity** layer is landed as a first step: `bin/widget` (+ the `widget` composite
action) bakes a node's **geo-less locator stem** into a data-filled fragment — a QR that opens this hub
as `atlas.anecdote.channel/?node=<atlas>&home=<scope>` — and `assets/scan.js` is the scanner side, which
**fills the scanner's US state** and redirects to `<atlas>.<state>.anecdote.channel`, or shows the
**missing-in-state** page (never a geo-block — the auto-marketing surface for a scan that found the idea
before the idea reached the scanner's state). This is the Atlas tier of the same locator
[tell bakes](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel/tree/main/.github/actions/widget); a
Tell hands a two-label stem to the Tell hub, an Atlas hands its single `<atlas>` label to the Atlas hub.
The **routing logic** is built and tested (`test/run.sh` [5]/[6]); the geo-fill Worker has landed
proof-grade and the remaining seams (deploy policy, portability) are noted below.

- **The geo source — landed, proof-grade.** `workers/scan-router/` is the first-party fill: a Cloudflare
  Worker on the hub root (`atlas.anecdote.channel/`) that reads `request.cf.regionCode`, maps it through a
  flat US region→slug table, and 302s to `<node>.<state>.anecdote.channel` **before the request reaches
  Pages** — the same Worker tier `workers/piles-gateway` already runs, just on the landing route instead
  of `/piles/`. No SDK and no third party: the only input is the `cf` object the edge already attaches, so
  the scanner's IP never leaves the edge. `assets/scan.js` stays as the static-origin fallback (and the
  missing-in-state page) for when the Worker isn't on the route. Tested in `test/run.sh` [6].
  - **Proof-grade fallback:** a region we can't resolve (no edge geo, a non-US scan, an unmapped state)
    falls back to `colorado` so a scan always lands somewhere live; a resolved state with no subdomain yet
    404s on its own host until it comes online. Good enough to prove the path; not the final policy.
  - **Still needs (not repo code):** the Atlas record flipped to **Proxied** (orange-cloud) so the route
    can intercept (see `DNS.md`), and `wrangler deploy`. Until deployed, `scan.js` + the marketing page
    stand.
  - **Why not a client-side IP-geo call:** it would leak the scanner's IP to a third party, against the
    constellation's coarse/first-party posture (`CONSTITUTION.md`). The region comes from the edge that
    already fronts the domain, not a third party.
- **Portability beyond the home state.** A scan resolves only when the scanner's state **matches** the
  node's home `scope`; an out-of-state scan is missing-in-state, never a guessed `<atlas>.<other-state>`
  subdomain that would 404. A directory that genuinely stands in more than one state ("the idea
  travels") needs a way for `scan.js` (or the Worker) to know **which** states a node resolves in —
  a small per-node portability manifest, or letting the target's own 404 be the missing-in-state page.
  Deferred until a node actually registers in a second state.
- **Mounting in civic-node.** `civic-node`'s build (`antibody.yml`) already renders the **tell** and
  **journal** widgets with a best-effort probe (`if <engine>/.github/actions/widget/action.yml exists`,
  then `uses:` it → `widget/<name>.html`). The Atlas widget is the same shape — add an analogous
  *"Detect / Render this node's Atlas widget"* pair `uses: ./atlas/.github/actions/widget` with
  `out: widget/atlas.html`, then bump the `atlas/` submodule pin. **Deliberately not mounted yet:** the
  fragment may change as these nodes blossom into full static site branches under `publish/`, so the
  producer (this repo) lands first and the consumer (civic-node) waits. The probe pattern means a node
  whose `atlas/` pin predates this action still builds — the mount is safe whenever it's wanted.
