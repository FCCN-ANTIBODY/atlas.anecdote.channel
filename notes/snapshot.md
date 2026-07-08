# The signed snapshot — "real at one time" (civic-node#71)

The decision record for `bin/snapshot`, per the issue's ask. The law it builds to is
CONSTITUTION.md → *"My record is one record, reachable or not"* — never past it.

## The signing target: an attested envelope over inline content

Of the two candidates (a layout-envelope over the registry files vs signing a git-enough tree
hash), the snapshot signs **one Ed25519 attested envelope over the registries' inline content**
(`atlas.snapshot/v1`): each file rides **verbatim** with its own content-id (`defaultHash` over
its bytes), and the envelope carries the stamped `at`. Reasons:

- **Content-bound, not code-bound** — the memo's steer. The signature proves *these exact bytes
  were this Atlas's record at that moment*; a carried copy is usable and checkable with nothing
  but the attest core (browser WebCrypto included — the offline origin verifies with
  `composer/sign.mjs` as-is, no git machinery required).
- **The tree hash is not lost** — it is a *derived address*, not a second signature: when the
  offline origin lands the carried files in repo-world (#73, git-enough), the tree oid it
  computes over the same bytes is stable and needs no extra attestation to be useful. Signing
  the envelope makes the tree hash checkable; signing only a tree hash would make the envelope
  unnecessary but strand every verifier that lacks git-enough.
- **Absence is named.** A registry the Atlas doesn't have (no `matches.json` yet, say) is listed
  in `absent`, inside the signature — a snapshot never silently narrows the record.

## The signer: the ledger signer, no new key class

The same identity that already attests the dump and the atlas-of-atlases index
(`keys/dump-signer.pk8`, gitignored; public fingerprint at `keys/dump.fpr`). One identity family
for every signed public surface this Atlas publishes. Verify-from-anyone / trust-decides-action:
`ok` = signature + every content-id check out; `trusted` = the signer is one you pinned.

## Ingest: staleness honest, never regressing, canon pinned on first contact

A carried copy is kept at `_data/snapshots/<atlas-id>.json` with **both** dates — `stamped_at`
(the claim inside the signature) and `accepted_at` (when this device took it) — so staleness is
always visible, never hidden. Two refusals guard the keep:

- **Never silently replace newer with older** — an offered snapshot stamped earlier than the
  kept one is refused (`compare` orders two copies of one canon by their stamped dates; equal
  stamps are a no-op).
- **A new canon is a decision, not an ingest** — a snapshot for the same atlas id signed by a
  *different* key never replaces the kept one (trust-on-first-contact; swapping canons is the
  operator's explicit act: remove the kept copy, then ingest with the new pin).

Timestamps remain claims, signed — liveness stays an observed claim (VISION.md); the snapshot
proves what was said and when it was stamped, never that the Atlas is up now.

## What rides

The declared default set (`DEFAULT_FILES`): every `_data/*.yml` registry (tells, piles, needs,
atlases, requests, hearsay-piles, antidotes), the open ledgers (`tee-ledger.json`,
`flush-ledger.json`), and the derived public surfaces (`matches.json`, `atlases.json`,
`boundaries.json`) — present-only, absents named. `ATLAS_SNAPSHOT_FILES` overrides.

## Couples

civic-node #72 (the sneakernet carries `snapshot.json`), #73 (the offline frontend ingests +
renders it), anecdote.channel#87 (the kept copy is the `atlas.snapshot` storage-manifest kind),
OPEN-QUESTIONS §M/§N (liveness as an observed claim).
