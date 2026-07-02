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

## Open questions

- **The met-record wire shape.** A presence-graduated scan of a Tell-minted token — which existing
  artifact carries it? (A witness record whose claim mentions the token's `kid`? A poll answer with a
  presence grade attached?) It should fall out of `presence.mjs` + `qr-mint`, not grow new crypto.
- **Freshness windows.** How stale can a met-record be before a binding decays from MET back to
  DECLARED? Likely the judge's dial, not the ledger's — the ledger just timestamps.
- **Withdrawal and the dent.** A Tell un-claiming a boundary is a pile-ending-shaped act
  (`docs/anti-signature.md`): is a withdrawn claim *deleted* from the ledger (an absence) or *dented*
  (an artifact)? The ledger keeps the dented form, presumably.
- **Peer dumps.** When this Atlas holds a peer's ledger, do met-record counts relay (as hearsay-graded
  observations) or only the claims themselves?
- **Small-N privacy.** Met-records are presence artifacts; publishing `met: 47` is fine, producing all
  47 on demand may identify bodies. The consent surface from the presence note applies to the Atlas's
  receipts too — likely: counts public, receipts disclosed only under the same rules a Tell's reports
  already follow (small-N suppression at the edge).
