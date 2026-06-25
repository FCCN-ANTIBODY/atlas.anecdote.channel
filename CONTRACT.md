# The map contract

This document defines the interface between a **data-pile** (the producer) and **Atlas** /
other connectors (the consumers). Atlas implements the consumer side; the producer side is
specified here for the pile/sink repos (e.g. the `tiliv/public-notes` pattern and the
civic-node repos).

> This section covers the **outbound, coarse, public** map a pile *places onto* Atlas. Atlas also
> runs an **inbound, full-fidelity, encrypted** channel — where Atlas *publishes* per-pile digests
> that a pile *pulls* — described in [Inbound digest channel](#the-inbound-digest-channel-atlas--pile)
> below and mirrored, from the pile's side, in the data-pile template:
> [`data-pile/CONTRACT.md`](https://github.com/FCCN-ANTIBODY/data-pile/blob/main/CONTRACT.md).

## The published map (`map.xml` + `map.xsl`)

Each pile publishes one small XML document per poll, with a linked XSL stylesheet so the raw
file renders human-readably when opened directly — the intentional "map".

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

### Fields

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

**Raw per-option vote counts are intentionally never published** — only coarse tiers — to keep
the anti-popularity design intact.

## Gateway placement (private sink → pile release → Atlas)

Atlas never reaches into a pile's repo. Instead, a pile that **consents** to be reflected
*places* its artifact onto Atlas, and Atlas serves it from its own domain:

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

- **Consent / gateway.** The pile pushes; Atlas does not pull. A consenting pile publishes by
  pushing **signed** commits to its **own branch** (`pile/<scope>/<id>`) — and nowhere else. Atlas's
  half of this — that it serves only what a pile placed and honors any terms riding with it — is
  attested in [`CONSTITUTION.md`](CONSTITUTION.md).
- **One surface.** The browser and every aggregator read the *same* Atlas-hosted URL — so
  "the aggregator knows exactly where Atlas gets its data."
- **Narrow builds.** Placement is out-of-band of Atlas's Jekyll/Pages build, so N piles each
  updating every ~10 min never trigger N site rebuilds. The build changes only when the shell
  or the registry (`_data/piles.yml`) changes.

### Serving substrate — branch per pile + Cloudflare Worker

Each pile owns a self-named, prefixed **branch** in this repo (`pile/<scope>/<id>`) that behaves
as a non-merging parallel namespace. `/piles/<id>/map.xml` is served by a Cloudflare Worker,
**independent of the Pages build**:

- **Store.** The pile's branch holds its artifact at the branch **root** (`map.xml` + `map.xsl`).
  The deploy workflow ignores `pile/**`, so a placement never triggers a site rebuild — builds
  stay narrow even with N piles each pushing every ~10 min.
- **Serve.** The Worker (`workers/piles-gateway/`) resolves `id → branch` from the rendered
  manifest (`/piles.json`, anchored by `_data/piles.yml`), fetches the raw artifact from that
  branch, sets `Cache-Control` (per-slice freshness) and `Access-Control-Allow-Origin: *` (so
  cross-origin aggregators can read it), and falls back to the Pages origin — the committed seed —
  for unknown or not-yet-placed slices.
- **Custody = signed commits + registry anchor.** A repository **ruleset on `pile/**` requires
  signed commits**; `_data/piles.yml` records each pile's expected `signer`. Trust is anchored by
  the registry (which branch + signer is legitimate for a slice); the signature trail is the audit
  record. Isolation of "only this pile pushes its branch" is by convention — a fine-grained token
  cannot be branch-scoped, so the placement credential is `contents:write` authorized for `pile/**`
  while a ruleset on `main` keeps it off the shell. (Hardening paths: a gateway signature-verifier
  that checks the signer against the registry, or per-pile GitHub Apps for true per-branch ACLs.)
- **Placement (the consented push).** The pile checks out its own branch and pushes a signed
  commit — the git-native form of "a branch only it is allowed to push." After rendering
  `map.xml`/`map.xsl`:

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

  No `repository_dispatch` to Atlas is needed — the runtime browser picks up new data on its next
  fetch once the CDN TTL lapses. A committed seed at `/piles/<id>/map.xml` renders the slice for
  local dev (no Worker) and in production until the branch's first placement.

> **Audit / discovery.** `git ls-remote --heads origin 'pile/*'` enumerates every slice; prefix
> scoping (`pile/colorado/**`) enumerates a scope subtree. History is retained as a signed audit
> log; `prune-pile-history.yml` periodically archives a branch's old chain to `archive/<branch>@…`
> and resets the live ref lean (without rewriting signed commits in place).

### Producer-side checklist (lives in the pile repos, not here)

1. **Emit the map.** Render `map.xml` (+ `map.xsl`) from `answers.json` and the poll manifest.
2. **Cadence ~10 min.** Roll up on roughly the cadence you want slices to refresh at.
3. **Place onto Atlas.** After the rollup, push a **signed** commit (`map.xml`/`map.xsl` at the
   branch root) to the pile's own `pile/<scope>/<id>` branch with the Atlas-granted credential.

## Consumer side (this repo)

Atlas reflects any map matching this schema **at runtime** via `assets/atlas.js`, driven by the
`piles.json` manifest the build renders from `_data/piles.yml`. Each registry entry carries a
`map:` path on Atlas's **own** domain; the client fetches that path same-origin. The build
fetches no data — it only emits the shell + manifest. Adding or removing a pile rebuilds the
shell once; ongoing data updates need no rebuild.

## The inbound digest channel (Atlas → pile)

The map above is the *outbound, coarse, public* surface a pile places onto Atlas. The **inbound**
channel is its mirror: the *full-fidelity, encrypted* digests Atlas produces for a pile. The pile's
side — crypto model (forward hash ratchet, `age`-wrapped seed, signed hash-linked manifest), owner
decrypt, and provable disclosure — is specified in
[`data-pile/CONTRACT.md`](https://github.com/FCCN-ANTIBODY/data-pile/blob/main/CONTRACT.md). This
section pins **Atlas's half**.

### Same gateway rule, mirrored — Atlas publishes, the pile pulls

The outbound rule is "Atlas never reaches into a pile; the pile places onto Atlas." Inbound is the
exact inversion of *who reaches*: **Atlas never reaches into a pile here either** — it publishes each
pile's encrypted digests on its **own** surface and the pile pulls them. This is what keeps the
architecture replicable and app-free: there is **no GitHub App, no cross-repo token, no central
write credential** that would make the operator the global writer/signer for every pile.

- **Store.** Atlas writes each pile's chain to a `feed/<scope>/<id>` branch in **this** repo —
  parallel to the outbound `pile/<scope>/<id>` namespace, and like it a non-merging append-only
  signed log that the deploy build ignores. Atlas writes it with the built-in `GITHUB_TOKEN`; nothing
  cross-repo is involved. `bin/deliver` produces the chain; `deliver.yml` commits it (via a temp
  index + `commit-tree`, so `main` is never touched), and `prune-pile-history.yml` bounds it.
- **Serve.** The `piles-gateway` Worker serves `/piles/<id>/feed/<file>` from that branch's `inbox/`,
  CORS-open and cached, exactly as it serves `/piles/<id>/map.xml` for the outbound map. The payload
  is encrypted, so open serving leaks nothing.
- **Pull.** The pile's `ingest` workflow fetches `/piles/<id>/feed/*`, verifies the signed manifest
  against the Atlas signer it pinned, and persists the blocks into its own repo. No credential —
  the encryption and the signature, not the transport, are what make it safe.

### Two Atlas keys, both ordinary primitives (no app)

- **`ATLAS_SIGNER_KEY`** — an SSH signing key. Atlas signs every manifest head with
  `ssh-keygen -Y sign -n data-pile`, the *same primitive* the outbound side already uses for
  `pile/**` commits. The **public** half is committed under `keys/` (`atlas.pub` / `atlas.signers` /
  `atlas.fpr`, produced by `bin/publish-signer`); a pile pins it **by hand**, confirmed
  out-of-band / IRL — the entire trust handoff. The signed manifest is the integrity anchor: it
  travels with the data, so the untrusted public-fetch transport cannot weaken it.
- **`ATLAS_SEED_IDENTITY`** — a single `age` identity (secret; no committed half). It lets Atlas
  resume each pile's one-way ratchet across deliveries without per-pile secrets: at genesis Atlas
  draws `K_0` and writes both `inbox/seed.age` (wrapped to the pile, for the owner) and
  `inbox/seed.atlas.age` (wrapped to Atlas); later runs unwrap Atlas's copy, replay to the head, and
  append. Losing it only prevents *extending* a chain — it never touches the owner's decrypt path.

### What Atlas guarantees a pile (the producer obligations)

Each delivery on `feed/<scope>/<id>` MUST: `age`-encrypt every block to the pile's registered
`age_recipient`; hash every block into the signed `manifest.json` chain with a `ratchet_pub`
commitment; sign the manifest head with the key whose fingerprint the pile pinned; and stay reachable
at `/piles/<id>/feed/*`. The pile's `bin/verify` rejects anything else and fails closed.

What each block *contains* is Atlas's own concern, isolated to one pluggable seam: `deliver.yml`
runs a **rollup hook** — `bin/rollup <id> [scope]` by default, or whatever `ATLAS_ROLLUP_CMD` points
at — once per window and seals its stdout as that window's block. `bin/rollup` ships as a reference
that emits a small provenance-stamped JSON record; an operator replaces it (or overrides the env) with
the real source. Empty output means "nothing new this window" and the pile is skipped (no empty
block). Everything downstream of the hook — encrypt, chain, sign, publish — is fixed production code.
