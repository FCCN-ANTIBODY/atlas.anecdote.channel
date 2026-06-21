# DNS configuration — the `anecdote.channel` constellation

DNS plan for the `*.anecdote.channel` repos on **Cloudflare DNS**, served by **GitHub Pages**.

> This documents the whole constellation but currently lives in the Atlas repo. It can be moved
> to the org `.github` repo if you'd prefer it to sit alongside all nodes.

## Model

Every repo's Pages site is served by GitHub from the **same** host — `fccn-antibody.github.io`.
GitHub routes a request to the correct repo using the domain in that repo's `CNAME` file. So:

- **Subdomains are all identical CNAMEs** to `fccn-antibody.github.io`.
- **Only the apex is special** (needs A/AAAA, or a flattened apex CNAME).
- The existing **MX → hover.com** record stays untouched and coexists with everything below.

## Records

### Apex — `anecdote.channel` (root repo)

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | `@` | `185.199.108.153` | DNS only | Auto |
| A | `@` | `185.199.109.153` | DNS only | Auto |
| A | `@` | `185.199.110.153` | DNS only | Auto |
| A | `@` | `185.199.111.153` | DNS only | Auto |
| AAAA | `@` | `2606:50c0:8000::153` | DNS only | Auto |
| AAAA | `@` | `2606:50c0:8001::153` | DNS only | Auto |
| AAAA | `@` | `2606:50c0:8002::153` | DNS only | Auto |
| AAAA | `@` | `2606:50c0:8003::153` | DNS only | Auto |

### Subdomains — one CNAME each

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| CNAME | `atlas` | `fccn-antibody.github.io` | DNS only | Auto |
| CNAME | `fortcollins` | `fccn-antibody.github.io` | DNS only | Auto |
| CNAME | `loveland` | `fccn-antibody.github.io` | DNS only | Auto |
| CNAME | `antibody` | `fccn-antibody.github.io` | DNS only | Auto |

Each repo keeps its own `CNAME` file (Atlas → `atlas.anecdote.channel`) so GitHub maps host → repo.
Add a new subdomain row whenever a new node repo comes online.

## Deliberate omissions

- **No `www`** — only a convention; nothing here needs it.
- **No wildcard / catch-all** — GitHub Pages won't serve a host unless some repo's `CNAME` file
  claims that exact name, so a `*` record would just resolve to GitHub and 404. List subdomains
  explicitly. (Apex-level URL routing, if ever wanted, is a Cloudflare Worker/redirect concern,
  not a DNS record.)

## Cloudflare proxy & TLS

Keep records **DNS only (grey cloud)** until certs are issued. A proxied record blocks GitHub
from provisioning its Let's Encrypt cert (the ACME challenge hits Cloudflare instead of GitHub).

Sequence:

1. Add the records above as **DNS only**.
2. Per repo: Settings → Pages picks up the custom domain from the `CNAME` file; wait for the
   green check, then enable **Enforce HTTPS**.
3. *Then*, for Cloudflare caching, flip records to **Proxied** and set SSL/TLS mode to
   **Full (strict)** (GitHub serves a valid cert, so strict is correct and avoids redirect
   loops). If GitHub later needs to re-validate a domain, temporarily grey it back.

## Domain verification (recommended)

Protect the constellation from subdomain takeover by verifying at the **org** level:
Organization → Settings → Pages → "Verify a domain" gives a TXT record like
`_github-pages-challenge-fccn-antibody` → `<token>`. Add it in Cloudflare (DNS only); it
coexists with the records above and locks these hostnames to the org.

## Alternative apex (optional)

Instead of the eight A/AAAA records, Cloudflare can host a **CNAME at the apex**
(`@ → fccn-antibody.github.io`) and flatten it automatically; it still coexists with the MX
record and auto-follows any future GitHub IP change. A/AAAA is GitHub's documented path and
unambiguous; the flattened apex CNAME is a tidy single-record-type alternative.
