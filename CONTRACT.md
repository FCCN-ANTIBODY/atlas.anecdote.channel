# The map contract

This document defines the interface between a **data-pile** (the producer) and **Atlas** /
other connectors (the consumers). Atlas implements the consumer side; the producer side is
specified here for the pile/sink repos (e.g. the `tiliv/public-notes` pattern and the
civic-node repos).

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

- **Consent / gateway.** The pile pushes; Atlas does not pull. Only a pile holding an
  Atlas-granted placement credential can publish, and only to its own `/piles/<id>/` path.
- **One surface.** The browser and every aggregator read the *same* Atlas-hosted URL — so
  "the aggregator knows exactly where Atlas gets its data."
- **Narrow builds.** Placement is out-of-band of Atlas's Jekyll/Pages build, so N piles each
  updating every ~10 min never trigger N site rebuilds. The build changes only when the shell
  or the registry (`_data/piles.yml`) changes.

### Serving substrate

`/piles/<id>/map.xml` is served by Cloudflare from a store that placement writes to,
**independent of the Pages build**. Recommended: a Cloudflare Pages Function backed by an R2
bucket — the pile `PUT`s `piles/<id>/map.xml` into R2 with a scoped token, and the Function
serves it with an explicit `Cache-Control`. Lower-infra alternative: a dedicated `piles-data`
branch the pile commits to, fronted by a Cloudflare Worker. (Substrate is the one open wiring
decision; the consumer contract above is identical either way.) A committed seed at
`/piles/<id>/map.xml` in this repo renders the slice for local dev and before first placement.

### Producer-side checklist (lives in the pile repos, not here)

1. **Emit the map.** Render `map.xml` (+ `map.xsl`) from `answers.json` and the poll manifest.
2. **Cadence ~10 min.** Roll up on roughly the cadence you want slices to refresh at.
3. **Place onto Atlas.** After the rollup, push `map.xml`/`map.xsl` to Atlas's store at
   `piles/<id>/…` with the Atlas-granted placement credential. No `repository_dispatch` to
   Atlas is needed — the runtime browser picks up new data on its next fetch once the CDN TTL
   lapses.

## Consumer side (this repo)

Atlas reflects any map matching this schema **at runtime** via `assets/atlas.js`, driven by the
`piles.json` manifest the build renders from `_data/piles.yml`. Each registry entry carries a
`map:` path on Atlas's **own** domain; the client fetches that path same-origin. The build
fetches no data — it only emits the shell + manifest. Adding or removing a pile rebuilds the
shell once; ongoing data updates need no rebuild.
