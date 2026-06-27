# `scan-router` — deploying the hub geo-fill Worker

[`worker.js`](worker.js) fills a scan's US state at the Atlas hub: a baked locator QR opens
`atlas.anecdote.channel/?node=<stem>&home=<scope>`, this Worker reads the edge geo Cloudflare
already attaches (`request.cf.regionCode`), and **302s** to `<stem>.<state>.anecdote.channel`
before the request reaches Pages. Everything without `?node=` (the directory shell, assets,
`/tells/`, `/piles/*`) falls through to the GitHub Pages origin. See [`worker.js`](worker.js) for
the routing logic and [`../../OPEN-QUESTIONS.md`](../../OPEN-QUESTIONS.md) #8 for the design.

This is the **only step left to make scans resolve live** — the code is merged and tested
(`test/run.sh` [6]); it just isn't on a route yet.

## What it depends on

- **The Atlas host must be Proxied through Cloudflare** (orange-cloud). A Worker route can only
  intercept a proxied record; a grey-cloud (DNS-only) record sends traffic straight to GitHub
  Pages and the Worker never runs. See [`../../DNS.md`](../../DNS.md) → "Cloudflare proxy & TLS".
- **It shares the zone with [`../piles-gateway`](../piles-gateway).** They never overlap: this
  Worker's route is the hub **root** (`atlas.anecdote.channel/`), piles-gateway's is
  `atlas.anecdote.channel/piles/*`. Routes match on path and ignore the query string, so
  `/?node=…` is caught by the root route while `/piles/…` stays with its own Worker.

## Deploy

1. **Confirm the Atlas record is Proxied.** Cloudflare → DNS → the `atlas` CNAME → orange-cloud.
   Only flip it *after* GitHub Pages has issued its cert for `atlas.anecdote.channel` and
   "Enforce HTTPS" is green (per `DNS.md`), and set SSL/TLS mode to **Full (strict)**. If Pages
   ever needs to re-validate the domain, grey-cloud it temporarily.

2. **Deploy from this directory** (the route in [`wrangler.toml`](wrangler.toml) is created on
   deploy):

   ```sh
   cd workers/scan-router
   wrangler deploy
   ```

   `wrangler` needs the account/zone. Set `CLOUDFLARE_ACCOUNT_ID` (and authenticate with
   `wrangler login` or `CLOUDFLARE_API_TOKEN`) — same as piles-gateway.

## Verify

```sh
# explicit ?state= wins — proves the route + redirect without depending on your geo:
curl -sI "https://atlas.anecdote.channel/?node=demo&state=texas" | grep -i location
#   location: https://demo.texas.anecdote.channel/

# real geo fill — from a US connection, lands in your state (or colorado if unresolved):
curl -sI "https://atlas.anecdote.channel/?node=demo" | grep -i location

# no ?node= passes straight through to Pages (the directory still renders, HTTP 200):
curl -sI "https://atlas.anecdote.channel/" | head -1

# the other Worker is untouched:
curl -sI "https://atlas.anecdote.channel/piles/" | grep -i x-atlas-gateway
```

`wrangler tail` streams live requests if a redirect isn't landing where you expect.

## Proof-grade behaviour (by intent — not the final policy)

- A region we **can't resolve** (no edge geo, a non-US scan, a state not in the table) falls
  back to **`colorado`**, so a scan always lands somewhere live.
- A state we **do** resolve but that has **no subdomain yet** 404s on its own host until it
  comes online — visiting another state by hand is fine for now.
- The static-origin fallback ([`../../assets/scan.js`](../../assets/scan.js)) still serves the
  missing-in-state page if the Worker is ever off the route.

## Roll back

Remove the route (Cloudflare → Workers & Pages → this Worker → Triggers/Routes, or delete the
`routes` entry and redeploy). With no route the hub root falls back to Pages + `scan.js` — no
data is lost and nothing else changes.
