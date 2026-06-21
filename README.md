# atlas.anecdote.channel

**Atlas** is a *reflection API* — a static data browser that reflects moderated snapshots
("maps") published by [anecdote.channel](https://anecdote.channel) **data-piles**.

It is one connector in a constellation of `*.anecdote.channel` repos: "Civic Node" repos
(e.g. `fortcollins`, `loveland`) are data-piles; connectors (`atlas`, `antibody`) consume them.
By convention the repo name is the DNS name served via GitHub Pages custom domain
(`atlas.anecdote.channel`); Cloudflare will later front it for caching-header control.

## Atlas's constitution

Atlas governs itself by a single document, [`CONSTITUTION.md`](CONSTITUTION.md), served live at
[`/CONSTITUTION.md`](https://atlas.anecdote.channel/CONSTITUTION.md). It is Atlas's whole law — what
it wants and what it attests it will do. The text is mutable and meant to be re-fetched: a
remembered copy does not bind. Atlas attests only to conduct it performs **today**; new conduct is
written there first, before it happens.

## How data flows

```
 respondents ──▶ private sink ──▶ rollup (~10 min) ──▶ pile's own release
                 (moderation)                                │ consented push
                                                             ▼ (pile → Atlas)
                                         Atlas: /piles/<id>/map.xml  (Cloudflare-served)
                                                             │
                                        ┌────────────────────┴───────────────┐
                                        ▼                                     ▼
                          runtime browser (per-slice fetch)        downstream aggregators
```

- **Private sink, public artifacts.** Raw answers never leave the pile's private sink. The
  rollup emits only a small, deliberately *coarse* public map (tiers, not raw counts), so Atlas
  only ever sees approved, low-bandwidth output. **Atlas needs no read token.**
- **Atlas is a gateway.** A pile that *consents* to be reflected **places** its artifact onto
  Atlas; Atlas serves it from its own domain at `/piles/<id>/map.xml`. The browser and any
  aggregator only ever read Atlas — never a pile's repo. See [`CONTRACT.md`](CONTRACT.md).
- **The map is the contract.** A self-describing XML document with a linked XSL stylesheet (so
  opening it raw in a browser renders human-readable).
- **Runtime-driven, per slice.** Atlas builds only a static shell + a small `piles.json` registry.
  The browser fetches each pile's Atlas-hosted map **at runtime**, so a pile's ~10-minute data
  update is available **passively, without rebuilding this site**. Freshness follows the map's
  Cloudflare cache TTL, and a per-slice badge surfaces how stale a slice is.

> **Why not rebuild?** With many piles each updating every ~10 min, build-per-update doesn't scale —
> deploys serialize and contend for free CI. Moving data consumption to runtime decouples build
> cadence from data cadence entirely. (The GitHub Releases API was considered for out-of-band
> artifacts but declined for now: unauthenticated listing is rate-limited and `api.github.com`
> offers no cache control. GitHub remains the Pages source for the shell only.)

## This repo

Custom GitHub Pages build (we run our own `jekyll build` in Actions) so we control the Jekyll
version and toolchain. The build is intentionally **data-free**: it emits the shell and the
manifest; the reflecting happens in the browser at runtime.

| Path | Purpose |
| --- | --- |
| `_data/piles.yml` | Registry of piles to reflect (`id`, `name`, `level`, Atlas-hosted `map:` path) |
| `piles.json` | Build-time manifest rendered from the registry; read by the client |
| `assets/atlas.js` | Runtime client: fetch each Atlas-hosted map → parse XML → render slice + freshness |
| `piles/<id>/` | Committed seed map (`map.xml` + `map.xsl`) served until the gateway places live data |
| `_layouts/`, `index.md`, `assets/atlas.css` | The shell |
| `.github/workflows/deploy.yml` | Build + deploy, triggered by push / manual only |

## Register a pile

Add an entry to `_data/piles.yml` (a registry change, so a one-time build picks it up):

```yaml
- id: my-poll
  name: "Human-readable name"
  level: district
  map: "/piles/my-poll/map.xml"   # Atlas-hosted path the gateway places data at
```

Commit a seed map at that path so the slice renders before first placement. The client always
fetches the Atlas-hosted `map` path same-origin; the consenting pile keeps it fresh by placing
data there out-of-band (see [`CONTRACT.md`](CONTRACT.md) → Gateway placement). Adding or removing
a pile rebuilds the shell once; ongoing **data** updates need no rebuild.

## Develop

```sh
bundle install
bin/jekyll serve             # http://127.0.0.1:4000
```

The site renders offline against the committed seed maps under `piles/`, so no live sink is required.

## Operations (one-time)

- Set **Settings → Pages → Source** to **GitHub Actions** (serves the shell).
- Point DNS for `atlas.anecdote.channel` at GitHub Pages and set it as the custom domain
  (the `CNAME` file is already committed). See [`DNS.md`](DNS.md).
- Stand up the gateway (see [`CONTRACT.md`](CONTRACT.md) → Serving substrate):
  - Deploy the Worker in `workers/piles-gateway/` (`wrangler deploy`) so it serves `/piles/*`.
  - Add a repository **ruleset on `pile/**`** that **requires signed commits**, and a ruleset on
    **`main`** restricting pushes so placement credentials can't touch the shell.
  - For each consenting pile: register its `branch` + `signer` in `_data/piles.yml`, and issue it a
    `contents:write` credential authorized for `pile/**`. Each pile creates its own branch on first
    signed push — there is no shared data branch to pre-create.

  Cloudflare's cache TTL on `/piles/*` sets per-slice freshness; the runtime client and its
  staleness badge follow whatever the edge serves.
