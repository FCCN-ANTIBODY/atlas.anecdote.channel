# Atlas peer-signer material (public only)

Atlas signs its **peer-registration** commit — the PR that lists this Atlas as a peer of
another Atlas (`bin/register-atlas` / `register-peer.yml`) — with an ordinary **SSH signing
key** (`git commit -S`, `gpg.format=ssh`). There is **no GitHub App**: a peer Atlas trusts
this one by pinning this public key's fingerprint as the `signer:` anchor in its
`_data/atlases.yml` entry. The handoff can be confirmed out-of-band / IRL. This mirrors a
Tell's delivery signer (`keys/tell.fpr`) one tier up — a Tell signs its registration with an
Atlas; an Atlas signs its registration as a peer of another Atlas.

## Files (committed; all public)

| File | Purpose |
| --- | --- |
| `atlas.pub` | Atlas's public peer-signing key |
| `atlas.signers` | One allowed-signers line (`atlas <key>`) — a peer copies this verbatim into its own `keys/atlas.signers` |
| `atlas.fpr` | `SHA256:…` fingerprint a peer pins in its `_data/atlases.yml` `signer:` |

`atlas.fpr` ships as a **placeholder** until an operator runs `bin/atlas-bootstrap`; the
peer handshake won't verify against a placeholder.

The **private** key never lives here. It exists only as the repo secret `ATLAS_SIGNER_KEY`,
materialized to a temp file for the single signing call in `register-peer.yml`.

## One-time operator setup

One command does it — generate the key, store the private half as a repo secret, publish the
public signer material, and commit it:

```sh
bin/atlas-bootstrap            # needs gh authenticated for this repo
git push                        # publish the committed public signer material
```

`bin/atlas-bootstrap` generates the SSH signer, sets the `ATLAS_SIGNER_KEY` secret via `gh`,
writes the three public files above via `bin/publish-signer`, and commits them — the private
half lives only in a `umask 077` temp dir and is removed on exit. It refuses to clobber an
existing signer unless `--force` (rotation makes every peer re-pin). On a box without `gh`,
run `bin/atlas-bootstrap --no-secrets`: it prints the secret value once so you can set it by
hand.

## What a peer Atlas does

1. Copy `atlas.signers` here into the peer's `keys/atlas.signers`.
2. Pin `atlas.fpr`'s value as the `signer:` of this Atlas's entry in the peer's
   `_data/atlases.yml`.
3. Confirm the fingerprint over a second channel (in person, signed message, …).

That's the entire trust establishment — no installation, no privileged token.
