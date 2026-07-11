# Orientation

This repository is one **Atlas**: a directory of Tells meant to be copied — a directory, a
gateway, a witness; never an authority, never an owner. It lists the Tells that front data-piles so
the public can find them, reflects the deliberately coarse maps piles consent to place, and
forwards what arrives at its drop door. It holds no key that decrypts anyone's data; a pile is
reached *through* its Tell.

## Where the truth is, in reading order

1. **Demos before docs.** The constellation's capability index is the demo shelf in
   [`anecdote.channel`](https://github.com/FCCN-ANTIBODY/anecdote.channel) (`composer/*-demo.html`,
   `viewer/`, `git-enough/`, `reducer/demo.mjs` — its `AGENTS.md` carries the table). Before
   designing a capability, look for its demo: if the need category is represented, the machinery
   exists — compose it. This repo's own executable truth is `test/run.sh` and the tools in `bin/`.
2. **Open issues are urgent** — a live problem with the current implementation, ahead of the
   deferred backlog. Roadmapping does *not* live in issues; it lives in the documents
   (`ROADMAP.md`, `docs/atlas-roadmap.md`, civic-node `VISION.md`), and design writing is moving
   back into repo files, off the public issue surface.
3. **The deferred half lives in one place** — civic-node
   [`OPEN-QUESTIONS.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md).
   Record a deferral there rather than threading a caveat through the law or the spec.
4. **The law, then the wire.** `CONSTITUTION.md` binds what Atlas does; `CONTRACT.md` pins the
   wire; `docs/` holds the shaping notes (drop door, hearsay pile, snapshots, boundaries).

## The offline origin is the destination

Capability is migrating off GitHub and down to the operator's device — the anecdote.channel PWA,
where signing happens (the device is the second factor). The workflows and composite actions here
are being **kept as a declarative definition of the pipeline** — a configuration input an operator
or the offline origin can read and mirror — not as the presumed runtime. Support them; don't
deepen reliance on them. Whether or not GitHub holds the secrets to run a workflow, the offline
origin does.

## Invariants — violate these and you're building the wrong system

1. **Neighbors, not a graph.** No central authority; one hop, no transitive reach; even the state
   is just an Atlas. "Above" is a position, not an apex.
2. **Verify-from-anyone; trust decides *action*, not *admission*.** Verify the bytes for anyone; a
   local friend/lineage list gates whether you act.
3. **Witness, not judge.** An Atlas attests that something *arrived* and is *signed*; it never
   rules on genuine/fit and never blocks. Fitness is judged downstream against a pile's own
   constitution.
4. **Sign ≠ decrypt.** An Atlas may sign what it delivers while holding no key that decrypts a
   pile — load-bearing for stand-in custody.
5. **Honest defaults fire nothing.** `ATLAS_MATCH_CMD` unset ⇒ `needs-judgment`; custody
   `mass=Infinity` ⇒ nothing rises; every plan is `needs:"judge"`. Automation stays opt-in.
6. **Attest before you run.** New conduct goes into `CONSTITUTION.md` in plain words first (the
   text-only attestation PR merged before `bin/drop` existed — that order is the rule).
7. **Content-id is the join key.** The vendored core byte-mirrors anecdote's `composer/sign.mjs`,
   so an Atlas's `contentId` equals a ballot's `ballotId`. Don't invent a second hash.
8. **No new cryptography without cause.** Ed25519 (vendored), `age`, `ssh-keygen -Y`, `sha256`.
   Compose.

## Where intuition goes wrong here

- **Data-free build; reflection at runtime.** The Jekyll build emits a static shell + small
  manifests; the browser fetches each pile's map at runtime. Don't move data consumption back into
  the build — build-per-update doesn't scale.
- **Coarse on purpose; the line, not the gate.** Tiers, never raw per-respondent counts; no
  strictness threshold a constituency must clear. Don't reintroduce a gate or a raw-count surface.
- **Signed branches + a registry anchor are the spine.** Every gesture — a Tell listing itself, an
  Atlas peering, a pile placing a map — is a signed PR on an identity-named branch
  (`tell/…`, `atlas/…`, `pile/…`) anchored in `_data/*.yml`. Mirror this idiom; don't add machinery.
- **Aggregation is not Atlas's job.** Cross-scope rollup belongs to the Antidote cascade; Atlas
  keeps only the live coarse gauge of its own scope, and inbound digests belong to the pile's Tell.

## Built here — reuse, don't rebuild

`bin/drop.mjs` (the forward-first door: verify → dedup → turnIn/shrugQuellBack/floodOnward +
content-addressed archive), `bin/custody.mjs` (plan-only, judge-gated stand-in-custody),
`bin/match` (the matcher; `ATLAS_MATCH_CMD` ejected seam), `bin/atlas-index.mjs`/`bin/dump.mjs`
(vendored attestation core + signed ledgers), `.github/actions/prune-pile-history` (lossless
archive-and-reset teardown), `workers/piles-gateway/` (serves placed maps off `pile/**` branches).

House test style: node stdlib, real crypto, `test/run.sh` — ssh-optional by design, so it runs on
a constrained box; CI exercises the signature leg. Keep dependencies near zero.
