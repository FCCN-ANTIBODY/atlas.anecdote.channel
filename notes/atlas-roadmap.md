# What's left for Atlas — the two channels, the org-chart slices, and the road ahead

> Status: **shaping note**, not built. Written at the end of the boundary rounds to jot down what we know
> about Atlas's role and what remains. Companion to [`boundary-canon.md`](boundary-canon.md) (declared /
> met / endorsed / contested; the lease; discovery-is-a-walk; the above mark) and to
> `anecdote.channel/composer/constituency.mjs` (the client that drinks the dump).

## The symmetry: passive registration, active speech (Tell and Atlas)

Two tiers, the same two behaviors, and naming them makes the road legible:

| | **passive** (things register with it) | **active** (it speaks / acts) |
|---|---|---|
| **Tell** | a **mailbox** for everyone on it — piles register, replies collect | states **opinions / anecdotes of its own** when the little community agrees, so they can say a thing in unison (a Tell-op move) |
| **Atlas** | **socializes the Tells to each other** — they register, and their say-so about each other is carried (a behavior Tells already know how to handle, used a new way) | **forms links** — registers with other Atlases, maps its neighbors, and carries the **above** subordinate move; defines its social network **without needing canonical terms** |

The active row is where Atlas still has building to do. The passive row is largely built (registration, the
dump, the lease).

## Two channels of discovery, both on the same consent layer

An Atlas node offers discovery two distinct ways, and keeping them distinct is the design:

1. **Registering at all.** The bare consent gesture — "list me." Its absence is pure privacy (the
   punishment test: nothing happens to the one who doesn't). This is built.
2. **The node acting on the association.** Riding along on the registration to say *more* — here, the
   **above** mark that describes hierarchy. Crucially this is **not a new consent surface**: it enters the
   same way registration did (a PR, signed), and it can be **added later** — the hierarchy adornment is
   just another pull request away, on the layer the node already consented to. So the model holds even if a
   node registers first and only declares its structure months later.

## The above mark as a public, plain-text, full tree

When Atlases carry `above` markers, **each Atlas should check and hydrate them** — walk up to parents, down
to children (the silly little DOM manipulation). The output wants to be, deliberately:

- **A straight-up text artifact discovery hands you.** Atlases are public; this is public.
- **Plain text, the full tree.** It is literally metadata adorning the nodes below it — no reason to hide
  or paginate it.
- **Timestamped at every level of the hierarchy** — each node carries when it was last refreshed. That
  turns the tree into a **heartbeat**: a derelict branch shows its staleness in place, and you can build a
  *heartbeat tracker on a friend node* — if they go derelict you'd lose something, and you'd see it coming.
  Great secondary metadata for graphing later.

The hydration is cheap enough to run **as part of the Atlas's build**, so the structure picture is **free at
check time** — computed when the site rebuilds, ready when anyone comes to look, and rideable alongside the
constitution/peer exchange Atlases already do.

## The org-chart slices are fractured, additive, and never whole — on purpose

Different Atlases will present **different hierarchy org charts for the same things, and there is no
requirement they agree or be whole.** This is not a bug and not even "disagreement" in the contested sense
— it is **partial participation**, which our witnessing-not-authority philosophy already embraces:

- A worldwide church may simply **not submit itself** to a public server listing — like refusing to be a
  followable account. Registering "a fan group about the whole world" and listing yourself there is a
  posture some orgs will never take. So that branch is **absent**, and its absence means nothing bad.
- Meanwhile the **rowdy modernist adherents** of that very org *do* show up and want to announce
  themselves — so they point `above` at the real org **whose own node isn't on this Atlas.** Result:
  **disjoint branches** — a child declaring a parent that isn't here, an edge stretching off-map toward a
  Tell that went and linked its real parent elsewhere.
- The **casual identifiers** — a local group of Christians who feel no power in associating upward — may
  reference "Christianity" as a loose tag and never register on any org hierarchy that way. Technically
  they're that; it's how they identify; it's **not a purity test for anyone else.**

So every org-chart is a **slice with a weird shape that comes with no guarantees.** Slices are **additive**:
holding two Atlases' trees gives you more of the picture, never a contradiction to resolve. The client
merges them the way it merges everything — verify each, union the edges, surface nothing as authoritative.

## What's left to build (the road)

Roughly in dependency order; the first three are **built**:

1. ~~**The `above` field + tree hydration**~~ *(the biggest active-behavior piece)* — **BUILT** (`bin/tree`,
   `bin/tree.mjs`; `test/tree.test.mjs`). A single subordinate mark on the atlas↔atlas registration
   (up-pointing only), plus the build-time walk that emits the public plain-text timestamped full tree.
   Design locked (see boundary-canon.md "The above mark"): **structure is a POSITION not a value** —
   `above: <ref>` is the un-typo-able structural fact; an optional `as:` names the edge for humans (verbatim,
   believed by nobody — "naming your friends-list entry"), evicted out of the primary datum; genuinely
   non-structural custom text, if any, gets its own key the walker ignores. The edge is **leased and dated**
   like a boundary claim, so the heartbeat/dereliction view falls straight out of the renewal timestamps.
2. ~~**The tell-side `anchor` field**~~ — **BUILT** (tell.anecdote.channel `bin/boundaries` `center:`; PR
   merged). Real members graduate from `anchored: null`: a Tell declares its center of mass in `tell.yml`
   and it is signed into the compiled artifact; the dump already observes it against the Atlas's own shape.
3. ~~**The global bundle / atlas-of-atlases index**~~ — **BUILT** (`bin/atlas-index`, `bin/atlas-index.mjs`;
   `test/atlas-index.test.mjs`). The apex as *the reference root most walks start from* (not the registry):
   a signed, leased, catchable `atlases.json`, served exactly like `boundaries.json`, one floor up — it
   hydrates the `_data/atlases.yml` peer directory (what `bin/register-atlas` populates) into the SET of
   neighbor addresses the client's "fetch the world" walks to each peer's `boundaries.json`. Peers are
   **relayed verbatim** (no ranking, no dedupe), the ledger is signed by this Atlas's dump signer (one
   fingerprint for all it publishes), and freshness comes from an optional per-entry `renewed:` date (past
   the window → `expired`; undated → listed with `stale: null`, honest, never dropped). **Two named seams
   remain, small:** (a) `bin/register-atlas` should stamp/refresh `renewed:` on the peer entry so the lease
   is self-maintaining (the PR-as-consent doubling as the renewal heartbeat, the tell-tier pattern one floor
   up); (b) the client's `constituency.mjs` "fetch the world" reads `atlases[].url` — the index now *emits*
   exactly that list; wiring the fetch loop is a thin follow-on when we return to the client.
4. **Peer-dump relay** — when this Atlas holds a peer's ledger, decide what relays (claims always; met-record
   counts as hearsay-graded observations?) and keep it grade-labeled, never laundered into own observations.
5. **Met-record counts in the ledger** — the dump surfacing `met: N` per binding (the artifact exists in
   `anecdote.channel/composer/met.mjs`; the Atlas needs to intake and count them, receipts producible).
6. **Registration-gesture extension** — carrying compiled boundary artifacts + renewals into
   `_data/boundaries/` through the one signed door (right now intake is populated by hand in tests).

## Open questions carried forward

- **Where the subordinate move belongs.** The `above` mark is clearly an Atlas-active behavior, but whether
  the *structural query* (chain hydration) is an Atlas build product, a client walk, or both is not settled.
  (Leaning: Atlas emits the tree at build; the client may also walk raw for trust it computes itself.)
- **Cross-Atlas tree merge semantics.** Additive is the rule, but the *rendering* of a disjoint branch (a
  child whose declared parent is off-map) wants a clear convention so it reads as "reaches off this Atlas,"
  not "broken."
- **Heartbeat thresholds.** The timestamps are facts; deciding "derelict" from them is the judge's dial, as
  everywhere — the tree just stamps.
