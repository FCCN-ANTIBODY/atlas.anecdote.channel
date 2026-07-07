# The hearsay pile — the Atlas as keeper, the keyring, and the tee

Working note for the build of civic-node#91 (the Atlas-owned hearsay pile) and the archivist
tee of #94. The CONSTITUTION attests the conduct ("When a ballot has no owner anywhere…",
"My keyring is public…", "What I keep, I tee…"); this note records the *decisions* and the
wiring so the next context doesn't re-derive them.

## The trigger, end to end

1. **`bin/drop`** keeps every hand-carried ballot content-addressed and floods what it can't
   home (forward-first, the settled law).
2. **`bin/custody`** plans stand-in custody for risers whose *owner is findable* (a fronted
   poll carrying an `age_recipient`). What rises but cannot be sealed degrades to
   `archiveOnly` — until now a dead-end.
3. **`bin/hearsay`** (new) turns that dead-end live: each `archiveOnly` row is a **shadow
   question** — a question known only because we hold answers to it — and becomes a candidate
   to *keep ourselves*. The plan spells out the exact gesture and `needs:"judge"`; honest
   defaults fire nothing.
4. **`hearsay-provision.yml`** (dispatch = the consent) runs data-pile
   `pile-new create --keygen` — the **owner path**, the Computer posture: the identity is
   minted on the runner and becomes the *new pile repo's own* `PILE_AGE_IDENTITY` secret —
   then `bin/hearsay record` appends the public keyring and commits.
5. The pile is **filled over the drop channel** (data-pile `bin/drop-pack` over the archived
   ballots → the pile's `feed/drop`): each fully packaged ballot rides as an opaque,
   self-contained block under its own random age-wrapped key, signed by this Atlas under the
   `data-pile-drop` namespace. The pile never inspects payloads; the envelope discipline is
   what's enforced. No keeper deviations anywhere — encrypted at rest even for public hearsay.
6. **`bin/tee`** loops `_data/antidotes.yml` and forwards everything the door kept to *every*
   listed archivist — dumb, unsharded, unjudged — as loose mail the antidote intake door
   accepts as-is, each send a hash-linked entry in the open `_data/tee-ledger.json`, delivery
   a presumed PR. (Verified against antidote's real `bin/intake-verify`: a tee bundle admits
   whole.)
7. **`bin/match`** runs the mixed model: the keyring unions into the candidates, so shadow
   questions are found when searched, marked `provisioner:"self"` for the judge.

## The key decision — reversible-for-me, opaque-to-you, without new cryptography

The question this build had to answer: an Atlas becomes *spontaneously responsible for a
variable number of keys* (one per hearsay pile). Should it derive them cleverly from a master
secret — reversible for itself, opaque to the public, postable as proof — or is that a new
ideation phase?

**Neither. The property already falls out of the built primitives:**

- **The postable "version of the key" is the age recipient.** It is *derived from* the
  identity, publicly committable, and useless for reading — exactly "proof there is a key and
  it is mine to speak for, usable by no one else." The keyring (`_data/hearsay-piles.yml`)
  publishes it per pile.
- **Proof of possession is a reveal, not a surrender.** data-pile `bin/prove` already lets a
  key-less party verify a revealed block key against the signed manifest (for drop feeds,
  per-block `block_keys` — revealing one block derives nothing about another). Live,
  on-demand, forward-only.
- **Storage is already multi-tenant.** Each pile's identity lives as *that pile repo's own*
  secret, exactly like any other keeper — the Atlas holds no central key store at all, so the
  "variable number" never concentrates anywhere. The keyring is the public *ledger of keeps*,
  not a vault.

**Master-derived keys were considered and rejected**, on three invariants at once: it would be
a keeper deviation (#91's non-negotiable — we operate exactly like any other keeper, so
nothing about the process invites question); it is new key-management cryptography without
cause (#92 invariant 8 — compose `age`/`ssh`/`sha256`, don't invent); and it concentrates
blast radius (one master compromised names *every* pile, where fresh-minted keys name one).
The convenience it buys — re-deriving instead of storing — is already provided by per-repo
secrets. So: **no derivation scheme, and no new ideation phase needed.**

## Lifecycle (the only distinctive operating choice)

Live (collecting; discoverable via the keyring + the matcher) → quiet (~30d without a new
answer — the pile earns retirement by going quiet, never by a clock alone) → **lossless
deflate** to the archive (the tee has been running all along; the deflate is the final
whole-yield flush) → teardown of the mailbox (`prune-pile-history` idiom: archive + reset,
never rewrite) → `status:` on the keyring walks live → deflated → torn-down, so
discoverability outlives the mailbox but not the archive. A fresh drop after teardown spawns
a *new* pile for the same question — same `pile`/`poll` join key on the keyring, merged at
aggregation (the stone skips again).

## Open questions carried forward (from #91, not resolved here)

- The exact dedup key at aggregation (content-id, with question+answer as the histogram
  bucket — the engineering note on #91) — Antidote's to resolve; the tee sends everything.
- The inactivity window's shape (time-only vs activity-shaped) and the deflate/teardown
  automation — the `status` field is ready for it; the gesture is not yet built.
- Whether `provisioner: "self:<id>"` should also stamp the pile repo itself — pile-new
  machine-refuses `--provisioner --keygen` (rightly: a provisioner never holds a key), so the
  self-attestation lives keyring-side for now.
