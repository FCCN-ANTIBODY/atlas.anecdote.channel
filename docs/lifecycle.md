# Lifecycle: an Atlas from bootstrap to a directory that rotates

This note describes the **whole life of an Atlas** — how it comes to hold its peer-signer, how Tells
come to be listed and piles reflected, what its matcher does on the hour, and how structure grows on
top of the directory. It is **doc-only**; it names how the existing pieces compose — and, in the table
at the end, which pieces are **scaffolds or awaiting their route**, so the vestigial is checkable
rather than asserted. The form follows
[`data-pile/docs/lifecycle.md`](https://github.com/FCCN-ANTIBODY/data-pile/blob/main/docs/lifecycle.md)
and the Tell's
[`docs/lifecycle.md`](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel/blob/main/docs/lifecycle.md).

## What an Atlas holds — and never holds

A directory of Tells and a reflecting gateway for the coarse maps piles consent to place; a build that
is deliberately **data-free** (shell + manifests, reflection at runtime). It holds **no key that
decrypts anyone's data** and needs **no read token** — a pile is reached *through* its Tell
([`CONTRACT.md`](../CONTRACT.md), [`README.md`](../README.md)).

## The states

- **Bootstrapped.** The operator mints the Atlas's peer-signer (`bin/atlas-bootstrap`,
  `bin/publish-signer`; public half committed under `keys/`), fills `atlas.yml` — the identity it
  presents when registering with a peer.
- **Listing.** Tells register by **PR-as-consent** onto `_data/tells.yml` — a `tell/<scope>/<id>`
  branch whose signed commit proves the claim its name carries; the merge is the consent
  ([`CONTRACT.md`](../CONTRACT.md) → "Registering a Tell"). Validation of that PR is manual today
  (┄ civic-node
  [`OPEN-QUESTIONS.md` §B](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md)).
- **Reflecting.** A consenting pile places its coarse `map.xml` and the gateway serves it from this
  domain at `/piles/<id>/…`; the browser fetches per-slice at runtime, so data updates need no
  rebuild ([`CONTRACT.md`](../CONTRACT.md) → Gateway placement).
- **Matching.** `bin/match` runs hourly over the needs board against the listed piles/Tells and
  publishes `matches.json`; honest by default — with no `ATLAS_MATCH_CMD` judge, nothing matches.
  The asker pulls; Atlas never writes into an asker.
- **Peering.** `bin/register-atlas` — the registration gesture one tier up (`atlas/<scope>/<id>`
  branch, `ATLAS_SIGNER_KEY`-signed) — lists this Atlas with a peer, and **by getting you give**:
  a peer's bill may trigger your matcher as yours may theirs. The live cross-repo bill emit/answer
  is deferred (┄ §D).
- **Tracing structure.** Above the flat directory: `bin/atlas-index` (the atlas-of-atlases index),
  `bin/tree` (name falls from above, shape rolls up from below), `bin/dump` — the naming layer is
  built; the roll-up and the met-record/`above` machinery are **shaping notes, not law**
  ([`notes/`](../notes/), indexed from the [`README`](../README.md)).
- **Rotating.** `prune-pile-history.yml` archives pile branches intact and resets the live refs —
  the same nothing-thrown-away rotation the Tell uses.

## The scaffolds and the not-yet-routed

| Artifact | Status | What closes it | See |
| --- | --- | --- | --- |
| `workers/scan-router` | **built, not routed** — the one step left to make locator scans resolve live; needs the orange-cloud + SSL Full (strict) ordering | deploying it on the hub root route | its `README.md`; [`tls-acm.md`](https://github.com/FCCN-ANTIBODY/anecdote.channel/blob/main/docs/tls-acm.md); ┄ §H |
| `piles/<id>/` seed maps | **placeholders** — served until a pile's first signed placement | first placement per slice | [`README.md`](../README.md) |
| bill emit / answer (`request-search`, `answer-bills` actions) | **scaffold** — assemble and report, no cross-repo write | the live bill, behind the judge | [`CONTRACT.md`](../CONTRACT.md) → the bill; ┄ §D, §A |
| `_data/requests.yml` | **empty on `main` forever, by design** — bills are examined on-branch | — (working as intended) | its header comment |
| `bin/register-atlas` | **live**, but a deliberate one-tier-up **clone** of tell `bin/register`; the `ty()` YAML reader is duplicated verbatim into `bin/bill` | idiom unification — inventoried at civic-node [`OPEN-QUESTIONS.md` §B](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md) | atlas `AGENTS.md`; ┄ §B |
| `ATLAS_MATCH_CMD` judge seam | **scaffold** — honest default matches nothing | the summonable judge | ┄ §A |
| the aggregator (reports → constituency rollups) | **unbuilt** — attested in `CONSTITUTION.md`, contract pinned | the reporting-law layer | ┄ §C |

Registration validation (branch/signature backing the claimed `signer`) is manual at every tier —
that, the unification above, and what the offline origin substitutes for the PR gesture are one
family: civic-node
[`OPEN-QUESTIONS.md` §B / §P](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md)
and [`docs/TENANCY.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/docs/TENANCY.md).
