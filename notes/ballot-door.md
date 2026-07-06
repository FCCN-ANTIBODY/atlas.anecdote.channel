# The ballot drop door — how hand-carried ballots arrive at an Atlas

> Status: **shaping note, not built.** Attested in `CONSTITUTION.md` ("I accept hand-carried
> ballots at one signed door, and I judge none of them"). The ballot counterpart of the signed
> registration intake (`notes/boundary-canon.md` → "one door, always signed"). Design home:
> civic-node **#86** (this drop door), **#87** (the Atlas-fronted poll + network-addressed ballot),
> **#88** (the aggregation "place above" / Antidote).

## The stance: witness, not judge

A ballot is **signed, not encrypted** (`anecdote.channel/composer/ballot.mjs` — `answer` is a
plaintext field; `signBallot` = attest, not encrypt). Its signature makes it *provable and
attributable*; it does not hide the answer. So an Atlas can read and count — what it **cannot** do
is prove the *genuineness of the contact*, and it never rules on fitness. Abuse resistance lives
downstream (the cost of fabricating commingled proximity, and a pile's own constitution reading the
timeline), never at this door. We never block: the carrier learns the outcome at turn-in (the
👍/👎 the Tell's `finalize` writes back).

`by` — who handed the ballot over — is **provenance, never authority.**

## The three-branch table

When a hand-carried ballot arrives (verify-from-anyone; the resolver is `stillLive` over the
listings/quells I know):

1. **Known live door** → ingest and route: turn it in to the Tell it names (`turnInSubmission` →
   `tell.submission/v1`), or stage it for routing.
2. **Quelled, or past its close date** → the efficient shrug: do **not** ingest; hand the quell back
   to the carrier, who prunes and spreads it.
3. **Unknown, no quell** → forward one hop to the peer Atlases I list (never a reach beyond the
   first) **and** keep it, content-addressed, at `_data/drop-archive/<scope>/<poll>/<ballotId>.json`.
   Free forwarding, no custody. **Never dropped.**

**Dedup is arrival behavior.** Copies converge by `ballotId` *as they arrive* — not an after-the-fact
pass over a prior timeline. "Tried to reach the archive N times" is just the live convergence.

## Custody — the gated exception (Slice 3; depends on #87)

Only when **all** hold do I stand up a stand-in ballot-box pile:
1. I hold the poll object — the **Atlas-fronted QR** (#87);
2. `stillLive` says **no live door**;
3. **mass** (ballots for one poll accumulate) **or scope-fit** (the poll's scope falls in a boundary
   I claim).

Then, as **attested provisioner** (`data-pile` `bin/pile-new --provisioner <me>` →
`provisioner`/`provisioner_spec`), I stand up a pile **sealed to the poll owner's age recipient**,
and I **sign** the delivery manifest into it — *sign ≠ decrypt; I hold no key that opens it.*
Reversible: a fresher truly-signed listing `supersededBy`s the stand-in. Adoptable by the owner when
reached. **Never unattended** — only on a consent gesture (PR) or a judge I have named; the honest
default is off.

### The recipient dependency (load-bearing)

A stand-in pile must be sealed to *someone's* age key, and `data-pile` **forbids the provisioner from
ever holding it** (`--provisioner` is incompatible with `--keygen`; the recipient is minted on the
owner's device). But the owner is exactly who is **unreachable** — that is why the ballot is orphaned.
So custody **requires the fronted poll (#87) to carry the owner's age recipient.** Absent that, this
door degrades to **archive-only** — signed ballots held at `drop-archive/`, never a sealed pile —
until a home or a recipient appears. This should be folded into #87's artifact shape.

## Not a judge of shapes

Mirrors `boundary-canon.md`: relay verbatim, record my own first-person observation (that it
*arrived*), sign the set (the carrier's layout tile, `transfer.packLayout`). **One signed door, no
side doors.** Where the money touches this (entitlements paid by government at pickup, not funds I
hold) lives in civic-node #88's payout model, not at the door itself.
