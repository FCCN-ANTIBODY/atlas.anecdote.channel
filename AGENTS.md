# Orientation

This repository is one **Atlas**: a directory of Tells meant to be copied. The README and
`CONTRACT.md` cover *what* this is and *how* the wire works; `CONSTITUTION.md` is the binding
law; `ROADMAP.md` is where this is going. This file is the why-shaped map — the ideas
underneath that the others won't lead with.

## The thrust

- **A directory, not an owner.** Atlas lists the **Tells** that front data-piles, and through them
  the piles that group up behind them, so the public can find them. It never registers a pile
  directly, never fronts pile data, and holds no key that decrypts anyone's data. A pile is reached
  *through* its Tell. Keep that direction straight: Atlas indexes and reflects; it does not collect.
- **Coarse on purpose; the line, not the gate.** Atlas reflects only the deliberately *coarse* maps a
  pile consents to place (tiers, never raw per-respondent counts), and it sets **no strictness
  threshold** a constituency must clear. Instead it keeps an **open line** to every constituency,
  aggregated regardless of weight; a report earns force as it accumulates, in the open, over time. The
  anti-popularity posture is the whole point — don't reintroduce a gate or a raw-count surface.
- **Aggregation is the promise that makes listing mean something.** To be listed is to be addressable
  and to **describe the transparency reports you publish**, because Atlas escalates affirmatively —
  every report rolls into **all** the constituency aggregations it belongs to, not a chosen few.
- **Replicable, and reciprocal among peers.** Fork it and stay a compatible Atlas. Peering is
  *by getting you give*: a listed peer may **truthfully trigger your matcher** — one hop, by mutual
  signed-PR consent, never a chain beyond the first, never a reach into anyone's repo.

## The shape of the code

- **Data-free build; reflection at runtime.** The Jekyll/Pages build emits only a static shell + small
  manifests (`/tells.json`, `/piles.json`, `/needs.json`). The browser fetches each pile's
  Atlas-hosted map **at runtime** (`assets/atlas.js`), so a pile's ~10-minute data update needs no site
  rebuild. Build-per-update doesn't scale; don't move data consumption back into the build.
- **Branch-per-pile, served off the build.** A consenting pile *places* its map by pushing **signed**
  commits to its own `pile/<scope>/<id>` branch; a Cloudflare Worker (`workers/piles-gateway/`) serves
  `/piles/<id>/map.xml` from that branch, independent of Pages. The deploy ignores `pile/**`. Custody is
  signed commits + the registry anchor in `_data/piles.yml`.
- **Signed branches + a registry anchor are the spine.** Every gesture — a Tell listing itself, an
  Atlas peering, a pile placing a map — is a signed PR on an identity-named branch
  (`tell/…`, `atlas/…`, `pile/…`) whose `signer` fingerprint is recorded in the open. The branch names
  the claim; the signature proves it; the registry entry anchors it.

## The constellation (pile ↔ Tell ↔ Atlas)

- **Atlas is the reporting-law layer, at the top.** A pile registers *to a Tell*; a Tell registers
  *to Atlas(es)*; an Atlas peers *with other Atlases*, one tier up again (`bin/register-atlas` mirrors
  the Tell's `bin/register`). Atlas lists Tells and aggregates what they report; it is reached for
  discovery, never for data.
- **The pile is the principal; the Tell is its agent; Atlas is the law above them.** Constitutions bind
  each layer in the open and constrain the next: a pile's constitution delegates to a Tell's; an Atlas's
  constitution requires a Tell's to describe its transparency reports. Copyable constitutions are the
  point — a few sound ones let one careful operator serve many.
- **Inbound digests are never Atlas's job.** Collecting responses and delivering a pile its encrypted
  digests belongs entirely to the pile's **Tell** (see
  [`tell.anecdote.channel`](https://github.com/FCCN-ANTIBODY/tell.anecdote.channel) and
  [`data-pile`](https://github.com/FCCN-ANTIBODY/data-pile)). Atlas only indexes Tells and reflects the
  coarse maps the piles behind them place.

## Working here

- **Mirror the constellation's idioms.** Signed branches + a registry anchor, PR-as-consent, data-free
  build, runtime reflection. Prefer the patterns already in the sibling repos (`tell`, `data-pile`) over
  new machinery, and keep dependencies near zero.
- **Read the law, then the spec.** `CONSTITUTION.md` binds what Atlas does; `CONTRACT.md` pins the wire;
  `ROADMAP.md` holds where this is going. What's deferred for the whole constellation — including
  Atlas's Phase-B tooling, the summonable judge, and the live peering half — lives in one place, the
  workspace's
  [`OPEN-QUESTIONS.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md). Record
  a deferral there rather than threading a caveat through the law or the spec.
