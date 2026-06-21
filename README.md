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
                                               │  repository_dispatch: pile-updated
                                               ▼
                                    Atlas rebuild ──▶ GitHub Pages (this site)
```

- **Private sink, public artifacts.** Raw answers never leave the pile's private sink. The
  rollup emits only a small, deliberately *coarse* public map (tiers, not raw counts), so Atlas
  only ever sees approved, low-bandwidth output. **Atlas needs no read token.**
- **The map is the contract.** A self-describing XML document with a linked XSL stylesheet (so
  opening it raw in a browser renders human-readable). See [`CONTRACT.md`](CONTRACT.md).
- **10-minute trickle.** After each rollup the sink fires a cross-repo `repository_dispatch`
  (`event_type: pile-updated`) to this repo, which rebuilds and redeploys.

## This repo

Custom GitHub Pages build (we run our own `jekyll build` in Actions) so we control the Jekyll
version and may add any plugins — including the reflection generator in
[`_plugins/atlas_reflection.rb`](_plugins/atlas_reflection.rb).

| Path | Purpose |
| --- | --- |
| `_data/piles.yml` | Registry of piles to reflect (`url:` and/or `fixture:`) |
| `_plugins/atlas_reflection.rb` | Fetches + parses each map into pages |
| `_fixtures/` | Sample map (`cd04-map.xml` + `map.xsl`) for offline builds |
| `_layouts/`, `index.md`, `assets/` | The browser |
| `.github/workflows/deploy.yml` | Build + deploy, triggered by push / dispatch / pile-updated |

## Register a pile

Add an entry to `_data/piles.yml`:

```yaml
- id: my-poll
  name: "Human-readable name"
  url: "https://raw.githubusercontent.com/owner/pile/main/parts/poll/map.xml"
  fixture: "_fixtures/cd04-map.xml"   # optional offline fallback
```

`url` is fetched first; `fixture` is used if the fetch fails or no URL is set.

## Develop

```sh
bundle install
bin/jekyll serve             # http://127.0.0.1:4000
```

Builds work offline against the committed fixture, so no live sink is required.

## Operations (one-time)

- Set **Settings → Pages → Source** to **GitHub Actions**.
- Point DNS for `atlas.anecdote.channel` at GitHub Pages and set it as the custom domain
  (the `CNAME` file is already committed).
- For private-artifact piles only: add an `ATLAS_PILE_TOKEN` secret (a protected environment
  is recommended). Public piles need nothing.
