# Atlas delivery-signer material (public only)

Atlas signs every inbound digest manifest it produces (`bin/deliver`) with an
ordinary **SSH signing key** — `ssh-keygen -Y sign`, the same primitive the
outbound side already uses for `pile/**` commits. There is **no GitHub App**: a
pile trusts Atlas by pinning this public key, and the pile's `bin/verify` checks
each delivery against it. The handoff can be confirmed out-of-band / IRL.

## Files (committed; all public)

| File | Purpose |
| --- | --- |
| `atlas.pub` | Atlas's public delivery-signing key |
| `atlas.signers` | One allowed-signers line (`atlas <key>`) — a pile copies this verbatim into its own `keys/atlas.signers` |
| `atlas.fpr` | `SHA256:…` fingerprint a pile pins in `pile.yml` `signer:` |

The **private** key never lives here. It exists only as the repo secret
`ATLAS_SIGNER_KEY`, materialized to a temp file for the single signing call in
`deliver.yml`.

## One-time operator setup

```sh
ssh-keygen -t ed25519 -C atlas-delivery-signer -f atlas-signer   # private + .pub
gh secret set ATLAS_SIGNER_KEY < atlas-signer                    # private -> CI secret
bin/publish-signer atlas-signer.pub                              # writes the 3 files above
git add keys/atlas.pub keys/atlas.signers keys/atlas.fpr && git commit && git push
shred -u atlas-signer                                            # keep only the .pub + secret
```

A second Atlas-side `age` identity, `ATLAS_SEED_IDENTITY`, is also stored as a
secret (not represented here — it has no public half worth committing). It lets
Atlas resume the per-pile ratchet across deliveries without per-pile secrets; see
`bin/deliver`.

## What a pile owner does

1. Copy `atlas.signers` here into the pile's `keys/atlas.signers`.
2. Pin `atlas.fpr`'s value into the pile's `pile.yml` `sources[].signer`.
3. Confirm the fingerprint over a second channel (in person, signed message, …).

That's the entire trust establishment — no installation, no privileged token.
