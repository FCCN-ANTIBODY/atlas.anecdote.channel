# Gate inbox — where items and resolutions arrive (PR-as-consent)

The gate admits into a public Atlas by a **quorum of constituents' proof-of-work**, not a judge. Two
kinds of thing arrive here by pull request (the merge is the append):

- `items/<id>.json` — a signed **gate item** (`anecdote.gate-item/v1`): a need / poll-ad / anecdote seeking
  entry, carrying the `text` the label-reducer reads.
- `resolutions/<id>.json` — a signed **gate resolution** (`anecdote.gate-resolution/v1`): a constituent's
  reducer verdict on an item, carrying their **constituency + recency proof** (a witnessed presence claim or
  a fresh membership). One per resolver per item.

`bin/gate` (run by `.github/workflows/gate.yml`) folds these into `_data/gate-queue.json`, admits items that
reach quorum (published to `/admitted.json`, which the asker pulls), expires items past decay, and clears
what it consumed. The tick logic lives in `anecdote.channel/composer/gate-tick.mjs`; the Atlas holds no key
and summons no judge — "I judge none of them; that reading belongs downstream."
