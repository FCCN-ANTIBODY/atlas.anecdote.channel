# The structure trace — the name falls from above, the shape rolls up from below

> Status: **naming layer built** (`bin/tree call`, `anecdote.calls/v1`, the cross-check in `buildForest`);
> **roll-up pinned, not yet built**. Companion to [`boundary-canon.md`](boundary-canon.md) ("The above mark")
> and [`atlas-roadmap.md`](atlas-roadmap.md) item 4. Written from the memo that reframed "peer-dump relay"
> into the org-structure trace.

## What a trace actually gives you: a shape, mostly

Tracing the org tree down does **not** hand you a clean labelled chart. It hands you **a shape** — a lattice
of atlases that mostly label themselves with their own internal jargon: a department acronym with a number
after it, the same title with a district number, something an outsider can't parse. **That's fine.** We are
not promising legibility; we are relaying a structure. Opacity is the org's business, not a defect in ours.

## The name falls from above (BUILT)

There are two naming acts, and they are not equal:

- **What a node calls itself** — the up-edge's `child` slug and `as` name (`anecdote.above/v1`). This is a
  **moniker**: self-chosen, possibly funny or circumstantial ("the district-four gossip group"), possibly
  duplicated across nodes, and that is **safe**. It is exactly the kind of self-declaration we already
  distrust everywhere else — an atlas naming its own friends-list entry. Carried for display, **believed by
  nobody.**
- **What a node's superior calls it** — a down-pointing `anecdote.calls/v1` record signed by the superior.
  This is the **authoritative structural name.** A well-run org's chart *falls out of* superiors naming their
  registrants; it does not depend on subordinates picking good names for themselves. "It's not really
  official unless the superior calls them that."

**The cross-check is the whole safety.** A `calls` record names node X **only when its signer is the very
fingerprint X's own up-edge files under** — X's actual parent. Anyone else naming X is an atlas naming a
stranger: ignored, garbage-grade, the same treatment any unsolicited friend-name gets. So a superior is free
to name its subordinates however it likes as it checks them in, different superiors may hold different names,
and none of it can spoof a name onto a node that didn't file under that superior.

Both names ride in the output: the tree **leads with the superior's name**, carries the self-moniker in
parens as adornment (`Archdiocese of the North (aka "diocese-north")`), and marks a node its parent hasn't
named with `*` — self-named only, a shape without a confirmed name. The `calls` record is **leased and
dated** like everything: a superior that stops renewing a name shows it going derelict in place (`[name
derelict]`), never a silent rename.

## The shape rolls up from below (NEXT — not built)

The trace *sounds* like an active, central thing — a dispatcher reaching from the apex and firing a job at
every node in the hierarchy to walk the whole tree live. **It must not be that.** Instead:

> **Every atlas acquires its own immediate subordinates continuously and folds them into the report it
> publishes upward.** The top of the tree reaches down only as far as its immediate registrants — each of
> which already carries its own subtree, because it did the same for its children. The full shape assembles
> **bottom-up, one hop per level**, not by any central live-trace.

This is the roll-up, and it is how "peer-dump relay" actually wants to work:

- Each atlas's published report includes, per immediate subordinate, that subordinate's **own report
  reference** (or a held copy) plus the **name this atlas assigns it** (the `calls` layer above).
- A superior **pulls its immediate registrants' reports** on its own schedule — cron-style, "as often as it
  pleases," constitutional if it wants. No one dispatches it; no one live-traces through it.
- Relayed subtrees stay **grade-labelled**: a subordinate's report is *theirs*, verified and carried, never
  laundered into this atlas's own observations. This atlas signs only its **own assembly** (its ledger over
  what it holds + the names it assigned), exactly as the dump signs its ledger and never the truth of a shape.
- **Additive, one hop.** Holding two atlases' rolled-up reports gives more of the shape, never a
  contradiction — the same merge rule as everything else.

Open threads for the build: where a held subordinate report lives in intake (`_data/` sibling to
`_data/above` / `_data/calls`); whether the roll-up is a new `bin/rollup` or an extension of `bin/tree
build`; and the freshness grading of a relayed subtree (its own heartbeat, carried, distinct from this
atlas's).
