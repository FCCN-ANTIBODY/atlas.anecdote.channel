# How Atlas canonizes boundary claims — declared, met, endorsed, contested

> Status: **shaping note**, not built. This works the question the tell-side notes leave open
> (`tell.anecdote.channel/notes/boundary-declaration.md` settles how a Tell *declares* a boundary;
> `notes/reporting-locus-rethink.md` settles what a boundary *is*): **what does Atlas do with the
> declarations, and what is actually being asserted when an Atlas says the shapes it holds?**
> Companion to `anecdote.channel/docs/presence.md` (the person-side proof this note leans on).

## The problem, plainly

With **people** we solved constituency by making them **prove it by going**: bisect + in-place scan +
witness. A **Tell is a git server running in the cloud.** It cannot go anywhere. So how does Atlas
distinguish the boundaries a Tell **claims** — speaks for, stands behind — from ones it merely
**endorses** or mentions? What stops "claiming a boundary" from being free?

## A server can't go — but a server can be met

The category error to avoid: a Tell's boundary claim is **not** "I am located in S." Servers are located
in a data center; nobody cares. The claim is **relational**: *"I am the hub FOR S — the mailbox a
population of bodies in S groups up behind."* Relational claims are proven by the **other party**.

A Tell already holds something unforgeable: its **mintable secrets**. A poll QR's token is minted from a
secret only the Tell has (`tok = HMAC(pile secret, …)` — qr-mint). So:

> **A server proves presence through its secrets being exercised in place.** When a person with a
> graduated presence proof (bisected into S, witnessed — `presence.mjs` + `bisect.mjs`) scans a
> Tell-minted token *inside S*, the Tell has been **met** in S: its unforgeable material was exercised
> at a place and moment a body can prove. The scan-record — the person's placement, the token's `kid`,
> countersigned — is a **met-record**: the server's footprint, left by someone else's foot.

This is the person-side proof, inverted, exactly as the presence note's witness inverts: people prove
themselves by scanning what's there; a Tell proves itself by **being what's scanned**. Met-records
accumulate, and — the judge's shape, again — the strong signal is not any one record but the Tell's
**standing ability to be met on demand**: fresh corroboration whenever asked. A Tell that claims a
shape it doesn't serve can fabricate a met-record only by fabricating a body that can pass the
presence bar, and must keep fabricating forever.

## The ladder a binding climbs

A (Tell, boundary) binding is always in exactly one of these grades, and the grade is **computable from
artifacts**, never granted:

1. **DECLARED** — the Tell signed "I speak for S" (the `boundaries/` + `tell.yml` declaration, carried
   by the signed registration gesture). First-person, costless, honest. Every binding starts here and
   *stays* here until bodies say otherwise.
2. **MET** — N presence-graduated met-records exist for this binding, fresh within some window. This is
   the server's "going." It is a **count with receipts**, not a checkbox: the artifacts are held and
   producible, and anyone can re-verify every signature in them.
3. **ENDORSED** — some *other* party signed "T speaks for S": another Tell, a peer Atlas, a person.
   Cheap, second-person, no in-place evidence. An endorsement never substitutes for a met-record; it is
   provenance about *reputation*, not *presence*.
4. **CONTESTED** — an overlapping or conflicting claim exists (two Tells claim S; a body of met-records
   contradicts a declaration). Carried and flagged, **never resolved by Atlas** — contested-by-construction,
   exactly as the reporting-locus model demands.

"Claim" is a verb only a Tell's own key can perform (grade 1). "Met" is a verb only constituents can
perform (grade 2). Atlas can perform **neither** — which is the point.

## What an Atlas actually asserts when it says the shapes it holds

Three things, and **none of them is the truth of a shape**:

1. **The relay, verbatim.** "This signed claim arrived through the registration door; here are its exact
   bytes, its signer, its content hash." Anyone can re-verify the Tell's signature — Atlas adds zero
   truth by holding it, and asserts none.
2. **Its own observations, first-person.** "As of T, I hold 47 met-records for this binding, 2
   endorsements, 1 open contest." Countable facts about artifacts it can produce on demand — signed by
   the Atlas *as observations*. The Atlas never writes `corroborated: true`; it writes `met: 47` and
   can show all 47.
3. **The set, signed.** "These, and no others, are the boundary claims I hold — version V, moment T."
   The canon is a **ledger, not a verdict**. Mechanically admitted (well-formed, signed, registered
   Tell, not withdrawn), grades carried per-member, contests included.

So: **an Atlas is a witness of documents, not a judge of shapes.** Its authority is exactly the
authority of its ledger discipline — completeness (a dropped contest is detectable, because claims are
signed and portable to any other Atlas), verbatim-ness, and its signature over the set. Authority over
*shapes* stays where the merged model put it: **emergent from convergence** — computed by any judge,
from any copy of the ledger, without asking Atlas's opinion.

And the set-signature already has a shape in the system: it is the carrier's **layout tile**
(`transfer.packLayout` — the "physical checksum" that attests *membership*, not member-truth). The
Atlas dump is a signed layout over attested-boundary transfers. A phone that catches the dump — over
the gravel, in a room, from a peer — holds the same canon the Atlas serves, checkable to the byte.

## Where Atlas gets boundaries: one door, always signed

Only through the **registration gesture** — the `tell/<scope>/<id>` PR whose commit the Tell's signer
key signs, extended to carry the `boundaries/` declaration (the boundary-declaration note's option
**(b)**: an explicit content hash per boundary in `tell.yml`; that hash is the same `boundaryId` the
client bisect stack computes and the same hash a presence claim carries — one identifier, all layers).

No side doors: a government shapefile enters by a **Tell asserting it** with `basis: official-import` —
the provenance tag rides, the door stays one. A peer Atlas's ledger enters as **relay-of-relay**,
grade-labeled hearsay, never laundered into this Atlas's own observations.

**Format reconciliation** (recorded, small): the tell-side authoring form is pure `.geojson` + meta in
`tell.yml`; the client bisect stack (`composer/bisect.mjs`) verifies self-contained signed
`anecdote.boundary/v1` objects. These are the same atom in two dress codes — a build step (Tell-side,
at declaration time) compiles authoring form → attested boundary object under the Tell's signature, and
`tell.yml`'s per-boundary hash pins the compiled artifact. The dump ships the compiled form; the repo
keeps the editable one.

## Renewal: the listing is a lease, and the state positions smooth away

The ladder above quietly wanted a pile of stored state (listed / delisted / pruned / derelict), and an
Atlas operator *can* prune registrants — but **we can't make a Tell do anything**, so pruning is a
judgment Atlas shouldn't be the one making. The smoothing move:

> If joining is one threshold for disclosing boundaries, it is the kind of thing an Atlas can verify an
> attestation about — and then require the assertion be **renewed**. If a Tell can't renew, the Atlas has
> good reason not to list the binding anymore, **even if the Tell is still attached.**

So a boundary listing is a **lease**, not a fact:

- **Renewal is cheap and mechanical**: the Tell re-signs its assertion — the same boundary content hash,
  a fresh date. Verifying the renewal is exactly the attestation an Atlas *can* check (a signature over
  known bytes), requiring no judgment at all.
- **"Listed" becomes a computed property, not a stored one**: *a fresh renewal exists.* The ledger is
  append-only, dated, signed artifacts; DECLARED / MET / ENDORSED / CONTESTED / listed are all **views**
  over it, recomputable by anyone from any copy. No state positions to add, dispute, or desync.
- **The derelict Tell resolves itself.** Its claims quietly age out of the *current* canon while history
  keeps them; nobody prunes, nobody is compelled, no authority declares dereliction. And an upstart,
  non-derelict Tell claiming the same shape simply climbs MET while the stale binding decays —
  **upstaging is emergent**, not adjudicated.
- **Two orthogonal liveness axes, both decaying honestly**: *renewal proves the KEY is alive; met proves
  the SERVICE is real.* A walked-away operator fails renewal. A zombie auto-renewer with no constituents
  fails met. Neither failure needs anyone to say so.
- **Walking away deliberately is the dent** (`docs/anti-signature.md`'s pile-ending): a signed withdrawal
  is an *artifact* the ledger keeps in dented form; silent dereliction is an *absence* that decay handles.
  Both endings are legible; neither requires Atlas's opinion.

And the property the met-record made concrete (composer/met.mjs): **the operator's own location never
appears in any artifact** — the token's signature, the body's placement, the binder's signature. A
missing server owner was never the authority anything rests on; there is nothing resting on them to go
missing from.

## The hard boundary: the aggressive alternative

A Tell may declare a boundary **hard**: joining requires the joiner to **do the proof themselves** — a
met-record presented at the door (the same artifact Atlas counts as corroboration; one artifact, two
consumers). A soft boundary admits anyone and lets presence merely *grade* participation; a hard one
gates membership on demonstrated presence. Hard/soft is the **Tell's declaration** (a flag on the
boundary entry, relayed verbatim like everything else) — Atlas never enforces it, but a hard-boundary
Tell whose met-counts are zero is telling on itself in a way any judge can read.

## Same referent, different bytes — lineage, not disagreement

Two Tells reporting "the same" boundary will almost certainly differ **byte-wise** at some point — and
usually **without trying to disagree**. We post-processed our Colorado-4 shape, so it will never hash or
sign the same as the source we took it from. Content hashes make this divergence *visible*; without more,
they make it *illegible* — an observer can't tell honest lineage from a quiet contest.

The fix is a relation on the declaration, signed like everything else:

- **`derives`** — *"this shape comes from that one, on purpose."* Cites the source (its content hash /
  fingerprint, and attribution), and indicates the processing. The honesty bar is deliberately reachable:
  **we may not be able to assert totally *what* we did to it, but we can indicate that we did something
  to it on purpose.** Same stance as `basis[]` — declared, not believed; the tag is provenance, the
  weight is the judge's.

With `derives`, two different-bytes shapes of the same referent read as a **family**, not a fight.

## Disagreeing in the open — represented, never resolved

The question worth hammering flat: **does the system represent disagreement at all, or is it entirely
inferred by users?** The trap in "inferred": geometry comparison is exactly the class of judgment the
system CANNOT make (below), so inferred disagreement is unreliable disagreement. The answer: the system
represents **intent**, never verdicts —

- **`disputes`** — *"my shape intentionally differs from that one."* The explicit trying-to-disagree bit,
  citing the disputed boundary's hash and (optionally) grounds. Two Tells disagreeing in the open are two
  signed `disputes` assertions anyone can read; CONTESTED in the ladder is now **computed from dispute
  assertions**, not from overlap detection the system can't trust itself to do.

Without `disputes`, post-processing divergence and deliberate contest are indistinguishable at the byte
level. With it, silence has meaning too: different bytes + no `derives` + no `disputes` is its own honest
signal — *unexplained divergence* — which a judge weighs accordingly.

## The bad continents — no recourse, by design

There are whole classes of problem here that nothing in the system can validate or repair: all the
counties of Colorado fit together and leave fifteen square feet of open space in a corner of the state —
the puzzle pieces don't meet, like bad continents. **There is no in-system recourse, and that is a design
position, not a gap**: any machinery that could *force* a boundary to change would be the authority we
have everywhere declined to create. Even if the whole network agrees someone's boundary ought to change,
all anyone can *do* is let people jump from one Tell to another — which is mildly painful if you leave
history behind, and gestures at a **Tell genealogy** we are deliberately not designing yet, because we
don't know who the hell the authority would be.

What the system CAN do is make the network's opinion cheap to express and cheap to adopt:

## Hosting the boundary you wish they had

The key active ingredient: if there is a network-agreed issue and they want it fixed, **Tells can start
hosting the boundaries they wish other people had.**

- **`proposes`** — a boundary published *for a referent the publisher does not claim*: "the shape I wish
  you had," citing the current claim it would replace. It is not a claim (the proposer gathers no
  met-records for it — it isn't their constituency); it is a signed, hosted, catchable artifact of the
  network's opinion.
- **Adoption closes the loop with no new machinery**: the claim-holder, persuaded, re-signs a proposal as
  their own claim — `derives` citing the proposal. Convergence of many Tells' `proposes` on one shape is
  exactly the emergent-authority signal the merged model already trusts; the fifteen square feet gets
  fixed the day its owner adopts the shape the neighbors have been hosting, and not one minute before,
  and nobody made them.

This folds cleanly into the disagreement scenario — a `proposes` is a constructive `disputes`: same
divergence, plus the shape you'd prefer. Three relations, one grammar: **derives** (family), **disputes**
(contest), **proposes** (wish). All signed, all relayed verbatim by Atlas, all views over the same ledger.

## Open questions

- ~~**The met-record wire shape.**~~ Built: `composer/met.mjs` — the token verbatim (public material),
  the binder's own presence claim, three signatures, zero secrets to re-verify, no new crypto.
- **Renewal cadence.** How long a lease runs before a binding needs re-signing (and whether MET freshness
  and renewal freshness share a clock or deliberately don't). Likely the judge's dial, not the ledger's —
  the ledger just timestamps.
- **Withdrawal and the dent.** A Tell un-claiming a boundary is a pile-ending-shaped act
  (`docs/anti-signature.md`): is a withdrawn claim *deleted* from the ledger (an absence) or *dented*
  (an artifact)? The ledger keeps the dented form, presumably.
- **Peer dumps.** When this Atlas holds a peer's ledger, do met-record counts relay (as hearsay-graded
  observations) or only the claims themselves?
- **Tell genealogy.** Jumping Tells means leaving history behind; a successor relation (this Tell
  continues that one) would ease it — parked deliberately until it's clear who, if anyone, could
  authoritatively assert succession. (It may be nobody, and the answer may be the same grammar again:
  a signed claim of succession, met-corroborated by the constituents who followed.)
- **Proposal hygiene.** Can `proposes` be spammed (a thousand hostile wishes for someone's referent)?
  Probably fine — proposals are cheap to ignore and carry their proposer's signature — but the dump
  builder may want them in a separate section of the layout so the canon of CLAIMS stays legible.
- **Small-N privacy.** Met-records are presence artifacts; publishing `met: 47` is fine, producing all
  47 on demand may identify bodies. The consent surface from the presence note applies to the Atlas's
  receipts too — likely: counts public, receipts disclosed only under the same rules a Tell's reports
  already follow (small-N suppression at the edge).

## The punishment test — a named design instrument

Every mechanism at this layer gets one question before it ships: **what happens to the one who
doesn't?** If the answer is "nothing — they're quiet," the mechanism passes. Registration-as-consent
passes. Renewal passes (a lapsed lease ages out; nobody is summoned). A compulsory global registry
fails it instantly: the first non-registrant becomes a deviant, and **not registering must never be
deviance — it is a mark of privacy. You're not doing anything socially wrong. You're just being.**

## Discovery is a walk, not a registry

The anxiety was one word: which atlases is every Tell *supposed* to know. "Supposed" imports an
authority that exists nowhere else in the constellation. The declared form the system already speaks:
**which atlases does this node know** — published, like everything else it publishes. A Tell's
registrations are public gestures; an Atlas's peers live in `_data/atlases.yml`. Those edges form a
**web of directories** — the friend list, one tier up — and discovery is walking that web from wherever
you stand: the apex you installed from, a peer's peer, a dump a friend poured across a table. You keep
what verifies; grades ride along (your roots vs. walked hearsay); the judge weighs provenance as always.

The system promises **reachability from your roots — never completeness**. Completeness was never
promised anywhere: authority emerges from convergence among *whoever showed up*.

Plural atlases for one subject (several Colorado atlases — highly probable) are the same non-problem as
plural boundary claims: same referent, different ledgers, merged by any client that holds both, contests
surfaced, convergence computed. "**The** Colorado atlas" is a convention communities may converge on;
the architecture permits it and refuses to enforce it.

The apex, settled: its knowledge of the SAN list makes it **the reference root most walks start from**,
not the registry — a courier of signed dumps it didn't sign (the firmware-offer lesson: courier ≠
author). Registering there is "I'd like strangers who start from that root to find me": a consent
gesture with a concrete, optional benefit, whose absence is just quiet. More roots arrive over the
gravel, from friends, from rooms. Nothing anywhere counts the ones who stayed quiet. The non-temporary
form of the apex is already sketched in this repo: the peer-Atlas registry, served exactly like
`boundaries.json` — an **atlas-of-atlases dump**, same lease, same ledger discipline, one floor up.

## The above mark — structure knits itself from below

The affiliation vocabulary problem, inverted. Trying to give the registration PR a term-set that
describes every conceivable localized hierarchy "in the blandest way possible" is the entity-system
trap: **there is no way to canonically model anything at all. Not a chance.** So the schema carries one
structural term and lets the people do the modeling:

- **`above`** — the atlas-to-atlas registration may carry a single subordinate mark: *this atlas files
  itself under that one.* Up-pointing only. **Structure is a POSITION, not a value.** The structural
  fact *is* the `above` field — its presence plus a parent reference is the edge. There is no
  `relation: "above"` free-string to misspell into or out of structure, and no magic sentinel to forge:
  you cannot *accidentally type* into a schema key, so the tree-walker trusts exactly one thing and it is
  un-typo-able by construction. This is the whole guard against the custom-declaration risk (below).
- **`as` — naming your friends-list entry.** A single optional human name for the edge — "diocese,"
  "parent label," "the genre we split from" — carried **verbatim, believed by nobody, queried by nothing
  for structure.** It is adornment on the edge, exactly like the `label` on a friend-list entry. It can
  never be mistaken for structure because it lives in a different slot; the *type specifier is evicted
  out of the primary datum*, which stays the bare, signed, up-pointing edge.

  > **The custom-declaration risk, and why position beats value.** The temptation is to let the same
  > channel carry free "custom declarations." Don't — if structure is a value someone types, structure is
  > unreliable three ways: the tree-walker can't tell an edge from a note (so it ingests noise as
  > hierarchy, or reintroduces an allowlist — the vocabulary trap we rejected); a reader must *decode from
  > culture* to know why an edge exists (fine for a browsing human, fatal for a machine building the
  > heartbeat tree); and vanity/squat edges render as real subordination. Position fixes all three: the
  > edge is a key, the name is adornment, and anything that is genuinely *not* structure gets its own
  > clearly-non-structural key (a `note`/`tags` slot the walker ignores) — never the `above` field. It is
  > fine for people to tell us what a relationship means to them; it is not fine for that telling to be
  > load-bearing.
- **The edge is LEASED and DATED — this is the heartbeat.** An `above` mark is a signed assertion with a
  fresh timestamp, re-signed to stay alive, exactly like a boundary claim's renewal. That timestamp *is*
  what the heartbeat tree reads at every level: a stale edge shows its dereliction in place, no extra
  machinery. (So the tree build rests directly on the lease we already have.)
- **Peers are welcome to register** as they already do; but *structure* queries are the silly little
  DOM walk: step up to the parent, down to the children. From any node the whole chain hydrates — and
  the rich picture is emergent, not encoded: you can *see for yourself* that mixed kinds of peers all
  report to one ideological node, without any vocabulary having said so.
- **Up-pointing is the right polarity.** A worldwide church does *nothing at all* and followers attach
  themselves under it. The subordinate mark is the right people consenting — **a leader has no power if
  there are no followers; the power of the follower is literally showing up for something else.** The
  structure knits itself from below, by consent, which is the only authority this system recognizes
  anywhere.
- **The labeler stays orthogonal**: the label-reducer's vocabulary (the one set of labels in the
  ecosystem) tags *subjects* — find-by-topic. `above` encodes *structure* — find-by-chain. A node can
  have either, both, or neither.
- **The walk is free at check time**: the chain hydration can run as part of an Atlas's build (and ride
  the peer exchange alongside constitutions), so the structure picture costs nothing when someone comes
  to look.
- **Non-canon is normal.** A community may list itself obliquely, under several things, "not so pure as
  the canonical channel" — or not at all, a private discussion group with no discoverability. The
  punishment test holds: the unattached node loses only findability-by-chain, which is what it chose.

## The dump-fetch is a location probe — fetch the world, find yourself locally

Pulling "the Colorado list" is not sensitive-content private; it is a **location probe wielded
constantly**, and half of a standing credential ("together with your signature, it says I was here when
I did that"). The strongest countermeasure is already licensed by verify-from-anyone: **never ask a
regional server a regional question.** The client pulls the *global bundle* (dumps are small; the apex's
natural artifact), caches it in the shell, and bisects on-device. The fetch reveals membership in
"people who use anecdote," nothing more; the gravel and friends cover even that.

And the judge's grading hook is countable, not geometric: a presence claim already carries which
boundary hash and which method; **ambiguity = how many shapes contain you, and whether competing
proposals/disputes for the same referent disagree about containing you.** "Under the claim I'm inside;
under the rival proposal I'm not" — the pinpointing grade, computed from artifacts, no slivers involved.

## `bounded` → `anchored` (the demotion, recorded)

The center of mass confessed: it was doing directory work, not geometry work, and membership's honest
form is the **declared filing** — you are in an Atlas's intake because you registered there. The
declared point survives as the **anchor** ("where you'd knock"), and the dump records
`anchored: true/false/null` as an **observation, never a gate**: `false` is a *description* (normal for
a watershed), `null` is honest absence. The anchor does more work talking about the exception than a
membership rule ever did leaving the false of the rule ambiguous. Implemented in `bin/dump.mjs`.
