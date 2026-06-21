# atlas.anecdote.channel

**Atlas** is a *reflection API* — a static data browser that reflects moderated snapshots
("maps") published by [anecdote.channel](https://anecdote.channel) **data-piles**.

It is one connector in a constellation of `*.anecdote.channel` repos: "Civic Node" repos
(e.g. `fortcollins`, `loveland`) are data-piles; connectors (`atlas`, `antibody`) consume them.
By convention the repo name is the DNS name served via GitHub Pages custom domain
(`atlas.anecdote.channel`); Cloudflare will later front it for caching-header control.

## How data flows

```
 respondents ──▶ private sink issue ──▶ rollup (with sink token, ~10 min)
                 (moderation isolation)        │
                                               ▼
                                  public XML+XSL map  (the contract artifact)
                                               │  (CDN / Cloudflare cache TTL)
                                               ▼
                     browser fetches each map per-slice ──▶ Atlas (static shell)
```

- **Private sink, public artifacts.** Raw answers never leave the pile's private sink. The
  rollup emits only a small, deliberately *coarse* public map (tiers, not raw counts), so Atlas
  only ever sees approved, low-bandwidth output. **Atlas needs no read token.**
- **The map is the contract.** A self-describing XML document with a linked XSL stylesheet (so
  opening it raw in a browser renders human-readable). See [`CONTRACT.md`](CONTRACT.md).
- **Runtime-driven, per slice.** Atlas builds only a static shell + a small `piles.json` registry.
  The browser fetches each pile's map **at runtime**, so a pile's ~10-minute data update is
  available **passively, without rebuilding this site**. Freshness is governed by each map's
  CDN/Cloudflare cache TTL, and a per-slice badge surfaces how stale a slice is.

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
| `_data/piles.yml` | Registry of piles to reflect (`url:` and/or `fixture:`) |
| `piles.json` | Build-time manifest rendered from the registry; read by the client |
| `assets/atlas.js` | Runtime client: fetch → parse XML → render each slice + freshness |
| `samples/` | Served sample map (`cd04-map.xml` + `map.xsl`) for offline / pre-sink fallback |
| `_layouts/`, `index.md`, `assets/atlas.css` | The shell |
| `.github/workflows/deploy.yml` | Build + deploy, triggered by push / manual only |

## Register a pile

Add an entry to `_data/piles.yml` (a registry change, so a one-time build picks it up):

```yaml
- id: my-poll
  name: "Human-readable name"
  url: "https://raw.githubusercontent.com/owner/pile/main/parts/poll/map.xml"
  fixture: "/samples/cd04-map.xml"   # optional offline fallback (a served path)
```

The client fetches `url` first; `fixture` is used if the fetch fails or no URL is set. Adding or
removing a pile rebuilds the shell once; ongoing **data** updates need no rebuild.

## Develop

```sh
bundle install
bin/jekyll serve             # http://127.0.0.1:4000
```

The site renders offline against the served sample map, so no live sink is required.

## Operations (one-time)

- Set **Settings → Pages → Source** to **GitHub Actions**.
- Point DNS for `atlas.anecdote.channel` at GitHub Pages and set it as the custom domain
  (the `CNAME` file is already committed).
- For caching control, front each pile's map URL with Cloudflare and set its cache TTL to the
  desired per-slice freshness; the runtime client and its staleness badge follow whatever the CDN
  serves. Public piles need no token.
