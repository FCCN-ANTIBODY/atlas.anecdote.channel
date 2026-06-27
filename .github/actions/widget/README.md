# `widget` — render this node's data-filled Atlas fragment from its own identity

A composite GitHub Action that renders the **data-filled** Atlas widget fragment into the
**calling node's** workspace. It is the live counterpart to the baked baseline at
[`widget/public.html`](../../../widget/public.html): that file is a static, **dataless** shell
a node picks up by bumping this submodule's pin; this action renders the **same fragment
contract** (same `anecdote-widget` classes, same dormant `anecdote:widget:` postMessage API —
a host can't tell which build it got) **from the node's on-disk identity**, so it carries the
node's own Atlas locator QR. The bundled `bin/widget` is the **code**; the node's `atlas.yml`
is the **data** — so any node that drops this in renders a locator to **its own** Atlas, never
the template's.

## A geo-less stem handed to a hub

The QR this bakes is a **stateless locator** that hands a **geo-less stem** to a **shared
hub**, the same posture as
[tell's widget](https://github.com/fccn-antibody/tell.anecdote.channel/tree/main/.github/actions/widget)
— the contrast there is the tier, not the mechanism. A Tell's stem is two labels
(`<tell>.<atlas>`) pointed at the Tell hub; an **Atlas is the top of its own jurisdiction
tree**, so its stem is the single `<atlas>` label pointed at the **Atlas** hub:

```
<hub>/?node=<atlas>&home=<scope>
```

The hub fills the **scanner's** US state and redirects to:

```
<atlas>.<state>.anecdote.channel
```

Scanned in the node's home state (`scope`) it resolves; scanned elsewhere the hub returns its
**missing-in-state** page (no geo-blocking — see [`assets/scan.js`](../../../assets/scan.js))
until the directory has gone portable. `home` is carried so the hub can name where the
directory does resolve. Contrast journal's widget, whose QR is a **first-party direct
locator** with no hub and no redirect — a journal is the node's own self-hosted record, while
an Atlas, like a Tell, is reached through the shared geo-fill hub.

qrencode bakes the QR as **inline SVG** at build time — no runtime JS, no external request.
Without qrencode the fragment degrades to a plain text link, so a node build never breaks.

## Use it

In your node's site build (the workspace mounts this engine at `atlas/`, the same
submodule-path convention as `./atlas/.github/actions/register-peer`), render the fragment
before the site build that includes it:

```yaml
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive
      - name: Render this node's Atlas widget
        uses: ./atlas/.github/actions/widget   # reads atlas.yml -> widget/atlas.html
      - name: Build
        # ... the node's own site build, which serves widget/atlas.html
```

`civic-node` already renders the tell and journal widgets this exact way (a best-effort probe
for `<engine>/.github/actions/widget/action.yml`, then `uses:` it). Adding the Atlas widget is
the same shape — see **"Mounting in civic-node"** in
[`OPEN-QUESTIONS.md`](../../../OPEN-QUESTIONS.md); it is **deliberately not mounted yet**.

The fragment is written as a **self-contained static file** served at `/widget/atlas.html` —
it stays out of the engine-managed `_includes/`, so the node build never couples to the
engine's include resolution. A host embeds it the way the baseline is meant to be embedded:
load it in an `<iframe>` (the dormant `anecdote:widget:` postMessage API exists exactly for
that cross-frame handshake) or include the served file verbatim into a host page.

## Inputs

| input | default | meaning |
| --- | --- | --- |
| `atlas` | *(read from `identity`)* | Atlas moniker (the `<atlas>` host label); falls back to `id:` in the identity file |
| `scope` | *(read from `identity`)* | home state/jurisdiction (the geo the hub fills); falls back to `scope:` in the identity file |
| `identity` | `atlas.yml` | path in the calling workspace to the node's Atlas identity file (provides `id` + `scope`) |
| `hub` | `https://atlas.anecdote.channel` | the shared hub the locator QR targets; it fills geo state and redirects |
| `out` | `widget/atlas.html` | path in the calling workspace to write the fragment to (a self-contained static file, served at that path) |
| `install-qrencode` | `true` | apt-install qrencode (set `false` if already present) |

It **fails closed**: with no identity file and no explicit `atlas`/`scope` it refuses rather
than render the wrong node — the same contract as tell's `widget` and the `register-peer`
action.
