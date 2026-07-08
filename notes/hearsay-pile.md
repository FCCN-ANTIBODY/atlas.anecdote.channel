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

## Lifecycle (the only distinctive operating choice) — now built as `bin/retire`

Live (collecting; discoverable via the keyring + the matcher) → quiet → **lossless deflate**
to `archived/` at the served root → teardown of the mailbox → `status:` on the keyring walks
live → deflated → torn-down, so discoverability outlives the mailbox but not the archive. A
fresh drop after retirement spawns a *new* tank for the same question — the keyring's
live-filter in custody/hearsay/match makes the stone skip automatically.

Decisions the build took:

- **Quiet is read from the open tee ledger, not from ballot timestamps.** Lateness does not
  exist (#86): an old-`ts` ballot arriving today is activity. What dates an arrival honestly
  is the first tee-ledger entry that forwarded its content-id — since the tee runs "as soon as
  we can", first-send ≈ arrival, and the transparency ledger doubles as the activity clock for
  free. `ATLAS_QUIET_DAYS` unset ⇒ nothing is ever quiet (the honest default); ~30d is the
  suggested policy, set by an operator, and quiet is only ever a *reading* — retirement still
  waits on the judge/consent gesture (`retire-plan.json`, `needs:"judge"`).
- **The default-hold guard is hard (#94).** A tank retires only when every record it holds
  was teed to *every* registered archivist — and with no archivist registered, nothing retires
  at all. `bin/retire deflate` re-verifies this itself: a judge cannot consent past a hole.
  Never evict into a hole.
- **Deflate moves whole.** Ballots move file-for-file from `_data/drop-archive/` to
  `archived/<scope>/<poll>/` — the same content-addressed layout, now served at the root — and
  the report (`archived/reports/<tank>.json`, `atlas.retired-keep/v1`) speaks only **log
  bands** (the antidote heartbeat idiom: `0`, `1-9`, `10-99`…) over answers and log-spaced
  arrival windows. Coarse standing in the open; the raw kept whole beside it, until a flush to
  an archivist's own custody is proven.
- **Teardown is ordered and narrated.** `teardown` refuses before `deflated`, walks the
  keyring, and only *narrates* the remote gesture (prune-pile-history on the pile repo's feed
  branches, then archive the repo) — it never reaches out.
- **Tally for sending; RECEIPT for releasing.** Our tee/flush ledgers prove *we sent*; only the
  archivist's own attested ledger proves *they hold* — and raw leaves `archived/` on nothing
  less. `bin/retire flush` composes the digest-bound `antidote.teleport/v1` per archivist
  (digest = `contentId({seq, prev_digest, commitments})`, the receiving door's own
  re-derivation; the COMMON is the bottle's *declared offer* from the registry — never computed
  here). `bin/retire release` then requires, from **every** registered archivist, a copy of its
  intake ledger that (1) hashes to its attested head, (2) verifies against the signer **pinned**
  in `_data/antidotes.yml`, and (3) carries a custody-IN entry bound by the same digest with
  everything admitted — a queued/refused record blocks release and is re-homed, never silently
  dropped. Verified end-to-end against antidote's real `bin/intake-verify` + `bin/punch`: the
  real attested ledger, verbatim, is the receipt that released the raw. The first registered
  archivist is the `antidote` repo itself — unchartered today (intake queues/refuses) and its
  ledger signer unminted, so the registry honestly blocks exactly the steps that need those
  (release refuses on the unpinned signer; flush skips without a declared offer).

## Open questions carried forward (from #91, not resolved here)

## Many doors, one tank — and the front is the load balancer

The second slice resolved the pile-per-question fork: **questions are the many, addressable
thing; piles are the few, opaque thing; the keyring is the router between them.**

- A keyring row is a **door**: the question, in the open, routing what answers it. Several
  doors may share one tank (`bin/hearsay record` on a kept id joins it, inheriting the tank's
  recipient/repo; mismatches refused, never rewritten). #91's refinement blessed the storage
  half outright ("pile-splitting is arbitrary and should be truly opaque… we owe no one a
  workspace that looks like anything in particular"), and the drop channel makes mixed content
  native: independent per-block keys mean `bin/prove` disclosure is already **per-question out
  of a mixed pile**, which a ratchet feed could never do.
- The door check stays **witness-level**: verified ballot × (pile,poll) matches a listed door.
  It routes; it never judges fitness. A ballot failing it floods onward and archives as ever.
- **`bin/hearsay front`** re-publishes a kept question as the constellation's own
  `anecdote.atlaspoll/v1` — `fronts` = this Atlas, `age_recipient` = the keep's — signed by the
  front signer (`keys/front-signer.pk8`, gitignored; `keys/front.fpr` committed, the
  dump-signer pattern) and held in `_data/atlaspolls.json`. Verified byte-compatible with
  `composer/atlaspoll.mjs`'s own verifier. This is #91's "re-publication of the question" made
  literal, and it turns **every peer Atlas's already-merged custody machinery into the
  distribution tree**: a verifiable fronted poll carrying a recipient is exactly what their
  `bin/custody` needs to seal stand-in piles back toward this keep — no new mechanism, and no
  one gains a key. "Load balancing the tree" collapses into the choice of recipient per front.
- **Self-loop guard**: `bin/custody` now skips questions the keyring keeps live ("kept — a
  hearsay pile I keep answers this"), since our own front would otherwise raise our own kept
  question into a stand-in plan every run.
- **Partition heuristic**: mixing weakens nothing cryptographically, but one repo secret opens
  one tank and teardown is per-branch — so partition by expected **retirement cohort** (the
  plan's join gesture suggests a live tank in the same scope), not by question.

## Open questions carried forward (from #91, not resolved here)

- The exact dedup key at aggregation (content-id, with question+answer as the histogram
  bucket — the engineering note on #91) — Antidote's to resolve; the tee sends everything.
- The inactivity window's shape (time-only vs activity-shaped) and the deflate/teardown
  automation — the `status` field is ready for it; the gesture is not yet built.
- Whether `provisioner: "self:<id>"` should also stamp the pile repo itself — pile-new
  machine-refuses `--provisioner --keygen` (rightly: a provisioner never holds a key), so the
  self-attestation lives keyring-side for now.
