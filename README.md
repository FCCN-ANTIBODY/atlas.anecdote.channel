# atlas.anecdote.channel

**Atlas** is a **directory of Tells** — and a reflecting gateway for the coarse maps the piles behind
them place here. A [**Tell**](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel) is a
jurisdiction's hub that fronts data-piles; Atlas lists the Tells (see [`_data/tells.yml`](_data/tells.yml),
surfaced at [`/tells`](https://atlas.anecdote.channel/tells/) and `/tells.json`) so the public can find
them, and through a listed Tell, the piles that **group up behind it**.

It is one connector in a constellation of `*.anecdote.channel` repos: "Civic Node" repos
(e.g. `fortcollins`, `loveland`) are data-piles, each fronted by a Tell; connectors (`atlas`,
`antibody`) consume them. By convention the repo name is the DNS name served via GitHub Pages custom
domain (`atlas.anecdote.channel`); Cloudflare will later front it for caching-header control.

Atlas **does not register data-piles directly**, and it never fronts pile data. Collecting responses
and delivering a pile its full-fidelity encrypted digests is a **Tell's** job — Atlas lists Tells and
reflects the coarse public maps the piles behind them place here. A pile is reached *through* its Tell.

The why-shaped map is [`AGENTS.md`](AGENTS.md); the binding law is [`CONSTITUTION.md`](CONSTITUTION.md);
the wire-level spec is [`CONTRACT.md`](CONTRACT.md); where this is going is [`ROADMAP.md`](ROADMAP.md).
What's deferred for the whole constellation lives in one place, the workspace's
[`OPEN-QUESTIONS.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md). The poll
lifecycle walked end to end — where Atlas's directory + reporting role sits in it —
is [`civic-node/docs/PIPELINE.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/docs/PIPELINE.md).

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
| `_data/tells.yml` | **Registry of Tells this Atlas lists** (`id`, `name`, `url`, `scope`, `signer`, `reports`) |
| `tells.json` | Build-time manifest of listed Tells; the public directory in machine form |
| `tells.md` | The `/tells` directory page rendered from the registry |
| `_data/piles.yml` | Registry of piles that group behind a listed Tell (`id`, `name`, `level`, `tell:`, `map:` path) |
| `piles.json` | Build-time manifest rendered from the pile registry; read by the client + gateway |
| `assets/atlas.js` | Runtime client: fetch each Atlas-hosted map → parse XML → render slice + freshness |
| `piles/<id>/` | Committed seed map (`map.xml` + `map.xsl`) served until the gateway places live data |
| `_layouts/`, `index.md`, `assets/atlas.css` | The shell |
| `.github/workflows/deploy.yml` | Build + deploy, triggered by push / manual only |

## Register a Tell

Atlas lists **Tells**, not piles. A Tell is listed by opening a PR that appends its entry to
`_data/tells.yml` — the consent gesture. The PR is opened on a **`tell/<scope>/<id>`** branch and its
commit is **signed with the Tell's delivery-signer key**, so the branch name claims the Tell's identity
and the signature proves ownership of it; the entry records that signer fingerprint as the open anchor
(see [`CONTRACT.md`](CONTRACT.md) → "Registering a Tell"). The canonical tooling for opening this PR
lives in the [Tell repo](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel) (`bin/register`).

```yaml
- id: my-tell
  name: "Human-readable name"
  url: "https://my-tell.example"
  scope: district
  signer: "SHA256:…"            # the Tell's keys/tell.fpr — the ownership anchor
  reports: "reports/govern-*"    # where it publishes the transparency reports Atlas aggregates
```

To be listed is to accept addressability, reporting in the shape Atlas aggregates, affirmative
escalation into all constituency aggregations, and the open line (see
[`CONSTITUTION.md`](CONSTITUTION.md)). Adding or removing a Tell rebuilds the shell once.

## Group a pile behind a Tell

A pile reached through a listed Tell may *also* place a coarse public map. Add an entry to
`_data/piles.yml` (a registry change, so a one-time build picks it up) naming the Tell it groups behind:

```yaml
- id: my-poll
  name: "Human-readable name"
  level: district
  tell: my-tell                  # the Tell this pile is reached through
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
