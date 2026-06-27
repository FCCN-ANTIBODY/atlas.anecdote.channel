# The Atlas contract

Atlas is a **directory of Tells**. A **Tell** is a jurisdiction's hub: it fronts data-piles, collects
their responses, and delivers each pile its encrypted digests (see
[`tell.anecdote.channel`](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel)). Atlas lists Tells
so the public can find them, and through a listed Tell, the piles that **group up behind it**.

This document pins the three interfaces Atlas implements:

1. **Tell ↔ Atlas** — how a Tell registers to be listed, what listing requires of it, and how the
   reports a Tell publishes aggregate upward through Atlas. This is Atlas's primary role and the
   subject of most of this document.
2. **Atlas ↔ Atlas** — how this Atlas peers with another by prior mutual introduction, and the
   reciprocal-discovery deal that follows: a registered peer may *truthfully trigger* this Atlas's
   matcher. The peer handshake is built; the request→match→answer automation is specced (see
   "Peering with another Atlas" below and `OPEN-QUESTIONS.md`).
3. **The coarse public map** a pile *behind a listed Tell* may place onto Atlas, served from Atlas's
   own domain. This is the older "reflection" surface; it is now framed as a property of a pile that
   has already grouped behind a Tell, not a way to register a pile directly.

> Atlas does **not** register data-piles directly, and it never fronts pile data — a pile is reached
> *through* its Tell. The **inbound, full-fidelity, encrypted** channel (collecting responses,
> delivering a pile its digests) belongs entirely to the pile's **Tell**; see
> [`tell.anecdote.channel/CONTRACT.md`](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel/blob/main/CONTRACT.md)
> and the pile's side in
> [`data-pile/CONTRACT.md`](https://github.com/FCCN-ANTIBODY/data-pile/blob/main/CONTRACT.md).

## Registering a Tell (the consent gesture)

A Tell is listed in Atlas by opening a **pull request that appends its entry to
[`_data/tells.yml`](_data/tells.yml)**. Accepting that PR is, for now, the whole of "attestation" — the
same PR-as-consent gesture a pile makes with a Tell, one tier up. No write access to the Tell is ever
requested; trust runs the other way.

**The registration signs the Tell's ownership of its own instance.** The PR is opened on a branch
named for the Tell's identity — **`tell/<scope>/<id>`** (mirroring the `pile/<scope>/<id>` convention
the map substrate already uses) — and its commit is **signed with the Tell's delivery-signer key**
(`TELL_SIGNER_KEY`, whose public fingerprint the Tell publishes at `keys/tell.fpr`). The branch name
carries the **claim** — *which* Tell, in *what* scope, is asking to be listed — and the signature is
the **proof** that the registrant controls that Tell's signer. The entry records that same fingerprint
as `signer:`, so the claim is **anchored in the open**: anyone reading `_data/tells.yml` can confirm the
Tell that registered is the Tell that signs the digests it delivers.

> The **cleanest, canonical** version of this registration paradigm lives in the **Tell** repo
> (`bin/register` + a thin PR-opening workflow); the data-pile carries the *descendent* forms of the
> same idiom (a pile registering with a Tell; a need registering with an Atlas). See
> [`tell.anecdote.channel/CONTRACT.md`](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel/blob/main/CONTRACT.md)
> → "Registering with an Atlas."

A `_data/tells.yml` entry carries:

| Field | Meaning |
| --- | --- |
| `id` | Stable slug for the Tell (also its branch segment: `tell/<scope>/<id>`). |
| `name` | Human-readable label. |
| `url` | The Tell's own domain (where it fronts its piles). |
| `scope` | The jurisdiction / namespace the Tell speaks for. |
| `signer` | The Tell's delivery-signer fingerprint (`keys/tell.fpr`) — the **ownership anchor** the registration branch/commit is signed under. |
| `reports` | Where the Tell publishes the transparency reports Atlas aggregates (e.g. `reports/govern-*`), in the shape its own CONSTITUTION describes. |

## What listing requires

Discoverability is not free. To be listed, a Tell accepts — and Atlas guarantees in return — the
following. (Atlas's half is attested in [`CONSTITUTION.md`](CONSTITUTION.md).)

- **Addressability.** A listed Tell is reachable at a stable `url` and answers for the piles it
  fronts. A pile has no address on its own; what Atlas lists and addresses is the **whole Tell node**.
- **Reporting in a described shape.** Atlas aggregates a Tell's transparency reports upward, so it
  needs them uniform. The chain is constitutional: a **Tell's `CONSTITUTION` describes the transparency
  reports it publishes** (its `reports/govern-…`), and **Atlas's `CONSTITUTION` requires** those
  descriptions to be present and to take the form Atlas aggregates. A Tell that describes no reports
  carves out nothing for Atlas to roll up.
- **Affirmative escalation.** Atlas rolls every report a listed Tell publishes into **all** of the
  constituency aggregations it belongs to — not a chosen few, not only the popular ones. This is the
  promise that makes being listed worth something.
- **An open line, not a strictness gate.** Atlas sets **no threshold** a Tell or a constituency must
  clear to be carried. Every constituency gets a standing line that is aggregated regardless of weight;
  a report on it **earns force as it accumulates**, getting harder for that constituency's real
  representatives to ignore the longer it stands. The line's credibility is earned in the open over
  time, never granted or withheld at the door.

## Peering with another Atlas

Atlas lists Tells; but an Atlas can also know **other Atlases** — friends made by prior mutual
introduction. This Atlas keeps a registry of its peers in [`_data/atlases.yml`](_data/atlases.yml):
the Atlases it may **directly** ask, and that may directly ask it. There is no length limit, but the
reach is **one hop** — a peer's own peers are not yours; there is no chain beyond the first.

**The introduction is the same signed PR-as-consent gesture a Tell makes with an Atlas, one tier up.**
An Atlas lists itself with a peer by opening a PR that appends its entry to the peer's
`_data/atlases.yml`, on a branch named **`atlas/<scope>/<id>`**, its commit **signed with the Atlas's
peer-signer key** (`ATLAS_SIGNER_KEY`, public fingerprint published at `keys/atlas.fpr`). The branch
name carries the **claim** — *which* Atlas, in *what* scope, is asking to peer — the signature is the
**proof**, and the entry's `signer:` is the **open anchor**. The canonical opener is `bin/register-atlas`
(`entry | branch | pr`), wrapped as the `register-peer` composite action and dogfooded by
`register-peer.yml`. Peering is **never self** — the point of a peer is a *different* answerer, so the
gesture refuses to run without a peer that is another Atlas. Listing is **mutual**: each side runs the
gesture against the other, and each keeps the right to drop the other by removing its entry.

An `_data/atlases.yml` entry carries:

| Field | Meaning |
| --- | --- |
| `id` | Stable slug for the peer Atlas (also its branch segment: `atlas/<scope>/<id>`). |
| `name` | Human-readable label. |
| `url` | The peer Atlas's own domain (its directory of Tells). |
| `repo` | The peer's GitHub repo (`owner/name`) — where request/answer PRs are opened. |
| `scope` | The jurisdiction / namespace the peer speaks for. |
| `signer` | The peer's Atlas-signer fingerprint (`keys/atlas.fpr`) — the **ownership anchor** the registration is signed under. |
| `reports` | (optional) Where the peer publishes the aggregate reports it rolls up. |

### Requested search from a peer (the reciprocal deal) — *specced, not yet built*

Being discoverable is not free here either: **by getting you give.** To stand in this peer network is
to accept that a registered peer may **truthfully trigger your matcher** — and "truthfully" is the
whole point. The friend does not get to assert a result; it gets to make *your* matcher run, honestly,
over *your* own piles and Tells. So a requested search is just authenticated input into the **existing**
`bin/match` engine, not a new one, and whatever returns is true because your own judge produced it.

The intended flow, deferred until a real second Atlas exists to exercise it (see `OPEN-QUESTIONS.md`):

1. A peer in your `_data/atlases.yml` puts out a notice — a **signed request** that lands in a
   **separate queue** (a `request/<peer>/<id>` branch or a `_data/requests.yml`), gated to peers whose
   `signer` you already list, and kept **off** your public `/needs.json` board (it is the friend's
   need, not your constituency's).
2. Your matcher reads the queue and runs the same constitutional fit (`ATLAS_MATCH_CMD`) over your own
   candidates — internal search and a peer's requested search are the **same matcher**, two triggers.
3. An accepted match returns to the asking peer as a **signed PR that modifies the line for the address
   it knows** — the invitation-not-delivery rule, one tier up: you never write into the ultimate asker,
   only hand your friend what you found, for it to relay home. **One hop.**

This composes with the deferred registration-validation check (`OPEN-QUESTIONS.md #4`, now also over
`atlas/<scope>/<id>` peer PRs and the new Atlas signer) and the summonable judge (`#5`).

## Piles group behind a Tell — the coarse public map

A pile that has registered with a Tell Atlas lists **may also place a coarse public map** onto Atlas,
served from Atlas's own domain. This is the "reflection" surface: it sits *behind* the pile's Tell in
the directory, and it never registers a pile on its own — the pile is already reached through its Tell.

### The published map (`map.xml` + `map.xsl`)

Each such pile publishes one small XML document per poll, with a linked XSL stylesheet so the raw file
renders human-readably when opened directly — the intentional "map".

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="map.xsl"?>
<map poll-id="cd04-q1" updated-at="2026-06-21T00:00:00Z" version="1">
  <district id="cd04" name="Colorado House District 4"/>
  <question>Should the city expand protected bike lanes on College Avenue?</question>
  <options>
    <option id="a" label="Yes, expand them"><tier>high</tier></option>
    <option id="b" label="No, keep as-is"><tier>low</tier></option>
    <option id="c" label="Only with more study"><tier>med</tier></option>
  </options>
  <totals accepted="247"/>
  <rejected geo="12" sig="3" malformed="1" other="5"/>
  <sampling low="b" mid="c" high="a"/>
</map>
```

| Node / attribute | Meaning | Source in the sink |
| --- | --- | --- |
| `map/@poll-id` | Stable poll identifier | `answers.json` `poll_id` |
| `map/@updated-at` | ISO-8601 snapshot time | `answers.json` `updated_at` |
| `map/@version` | Schema version (`1`) | constant |
| `district/@id`, `@name` | Public district label | poll manifest |
| `question` | Question text | poll manifest |
| `option/@id`, `@label` | Public option labels | poll manifest |
| `option/tier` | `low` / `med` / `high` | `answers.json` `counts_coarse{}` |
| `totals/@accepted` | Accepted response count | `answers.json` `total_accepted` |
| `rejected/@*` | Rejection tallies | `answers.json` `rejected{}` |
| `sampling/@low|mid|high` | Sampled option ids per tier | `answers.json` `sampling{}` |

**Raw per-option vote counts are intentionally never published** — only coarse tiers — to keep the
anti-popularity design intact.

### Gateway placement (private sink → pile release → Atlas)

Atlas never reaches into a pile's repo. A pile that **consents** to be reflected *places* its artifact
onto Atlas, and Atlas serves it from its own domain:

```
 private sink ──▶ rollup (~10 min) ──▶ pile's own release (raw artifact)
                                            │  consented push (pile holds an
                                            ▼  Atlas-scoped placement credential)
                              Atlas: /piles/<id>/map.xml   (Cloudflare-served, cached)
                                            │
                         ┌──────────────────┴───────────────────┐
                         ▼                                       ▼
        Atlas runtime browser (assets/atlas.js)      downstream aggregators
```

What this preserves:

- **Consent / gateway.** The pile pushes; Atlas does not pull. A consenting pile publishes by pushing
  **signed** commits to its **own branch** (`pile/<scope>/<id>`) — and nowhere else.
- **One surface.** The browser and every aggregator read the *same* Atlas-hosted URL — so "the
  aggregator knows exactly where Atlas gets its data."
- **Narrow builds.** Placement is out-of-band of Atlas's Jekyll/Pages build, so N piles each updating
  every ~10 min never trigger N site rebuilds. The build changes only when the shell or a registry
  (`_data/tells.yml`, `_data/piles.yml`) changes.

#### Serving substrate — branch per pile + Cloudflare Worker

Each placing pile owns a self-named, prefixed **branch** in this repo (`pile/<scope>/<id>`) that
behaves as a non-merging parallel namespace. `/piles/<id>/map.xml` is served by a Cloudflare Worker,
**independent of the Pages build**:

- **Store.** The pile's branch holds its artifact at the branch **root** (`map.xml` + `map.xsl`). The
  deploy workflow ignores `pile/**`, so a placement never triggers a site rebuild.
- **Serve.** The Worker (`workers/piles-gateway/`) resolves `id → branch` from the rendered manifest
  (`/piles.json`, anchored by `_data/piles.yml`), fetches the raw artifact from that branch, sets
  `Cache-Control` (per-slice freshness) and `Access-Control-Allow-Origin: *`, and falls back to the
  Pages origin — the committed seed — for unknown or not-yet-placed slices.
- **Custody = signed commits + registry anchor.** A repository **ruleset on `pile/**` requires signed
  commits**; `_data/piles.yml` records each pile's expected `signer` (and the `tell:` it groups behind).
  Trust is anchored by the registry; the signature trail is the audit record. The placement credential
  is `contents:write` authorized for `pile/**` while a ruleset on `main` keeps it off the shell.
- **Placement (the consented push).** The pile checks out its own branch and pushes a signed commit.
  After rendering `map.xml`/`map.xsl`:

  ```sh
  BRANCH=pile/colorado/cd04-q1
  git clone --depth 1 https://github.com/FCCN-ANTIBODY/atlas.anecdote.channel atlas-data
  cd atlas-data
  git switch "$BRANCH" 2>/dev/null || git switch --orphan "$BRANCH"
  cp ../map.xml ../map.xsl .
  git add map.xml map.xsl
  git -c user.signingkey="$KEY" commit -S -m "place cd04-q1 $(date -u +%FT%TZ)"
  git push origin "$BRANCH"
  ```

  A committed seed at `/piles/<id>/map.xml` renders the slice for local dev (no Worker) and in
  production until the branch's first placement.

> **Audit / discovery.** `git ls-remote --heads origin 'pile/*'` enumerates every slice; prefix
> scoping (`pile/colorado/**`) enumerates a scope subtree. History is retained as a signed audit log;
> `prune-pile-history.yml` periodically archives a branch's old chain and resets the live ref lean.

### Consumer side (this repo)

Atlas reflects any map matching this schema **at runtime** via `assets/atlas.js`, driven by the
`piles.json` manifest the build renders from `_data/piles.yml`. Each registry entry carries a `map:`
path on Atlas's **own** domain and the `tell:` it groups behind; the client fetches the map path
same-origin. The build fetches no data — it only emits the shell + manifests (`/tells.json`,
`/piles.json`, `/needs.json`). Adding or removing a Tell or a pile rebuilds the shell once; ongoing
data updates need no rebuild.

## Inbound digests are a Tell's job, not Atlas's

The directory above (and the coarse map a pile places behind its Tell) is Atlas's whole role. The
**inbound** channel — collecting responses and delivering a pile its full-fidelity, encrypted digests —
belongs to the pile's **Tell**, not to Atlas. Atlas only **indexes** Tells (see
[`_data/tells.yml`](_data/tells.yml)) and reflects the coarse maps the piles behind them place here. A
pile is reached *through* its Tell.
