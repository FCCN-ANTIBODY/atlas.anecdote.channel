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

## Required producer-side changes (not in this repo)

The reference sink (`tiliv/public-notes` PR #2) currently emits `parts/poll/answers.json`
hourly. To satisfy this contract it needs:

1. **Emit the map.** Have `bin/poll-rollup.mjs` (or a small follow-on step) render `map.xml`
   (+ a committed `map.xsl`) from `answers.json` and the poll manifest, published at a stable
   public URL.
2. **Cadence ~10 min.** Change `.github/workflows/poll-rollup.yml` schedule toward
   `*/10 * * * *` (note: Actions cron is best-effort and may drift).
3. **Serve the map cacheably.** Publish at a stable public URL and, ideally, front it with
   Cloudflare so its cache TTL sets per-slice freshness. **No notification to Atlas is required** —
   Atlas fetches the map at runtime, so a data update is picked up passively on the next client
   fetch once the CDN TTL lapses. (A `repository_dispatch: pile-updated` is no longer needed; a
   pile only needs to dispatch if a connector is registering/removing piles out of band.)

## Consumer side (this repo)

Atlas reflects any map matching this schema **at runtime** via `assets/atlas.js`, driven by the
`piles.json` manifest that the build renders from `_data/piles.yml`. The build itself fetches no
data — it only emits the shell + manifest. Adding a pile is just a registry entry pointing `url:`
at its published map (a one-time shell rebuild); ongoing data updates need no rebuild.
