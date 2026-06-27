# Roadmap — Atlas

Where this is going, and why today's shape is a way-station. `CONSTITUTION.md` binds what Atlas
does *now*; this file is the direction, so an agent reading the code doesn't mistake a scaffold for
the destination. The unsolved mechanisms each phase depends on are tracked in the workspace's
[`OPEN-QUESTIONS.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md).

## The principle: a directory earns trust in the open

A directory is only worth what it can be held to. Today, listing is consent by human merge and
aggregation is attested but unbuilt; the direction is to make listing **trustless** (the claim checks
itself), make judgement **summonable** (fitness, not just ownership, at the consent junction), and make
aggregation **real** (the reports a Tell publishes actually roll up). Each step is written into the law
before it runs, and each is exercised against a *real* second node rather than designed in the abstract.

## Phase A — the listed directory (today)

Atlas lists Tells by **signed PR-as-consent**: a Tell opens a `tell/<scope>/<id>` branch, signs the
commit with its delivery-signer key, and a human merges. The matcher (`bin/match`) runs self-hosted over
this Atlas's own needs, piles, and Tells, with the `ATLAS_MATCH_CMD` judge seam honest-by-default
(accepts nothing unset). The peer handshake is built (`bin/register-atlas`, `register-peer`), and the
coarse-map reflection is live (branch-per-pile + Worker). The trust surface is deliberately small while
the constitutions and the judge settle: consent is a merge, in the open.

## Phase B — trustless listing and live federation

The Phase-B tooling pass lands four coupled pieces **together**, because the registry shape, the
matcher, and the judge must move as one and be exercised against a real second Atlas/Tell:

- **Registration validation** — a PR check that the branch matches the entry's `id`/`scope` and the
  commit signature matches the claimed `signer`, extended to cover `atlas/<scope>/<id>` peer PRs and
  `request/<scope>/<id>` bill branches (so listing is trustless, not merely merged).
- **Matcher addressing** — `bin/match` resolving a candidate's Tell by the pile's own `tell:` field
  rather than scope-first, correct once a scope holds more than one Tell.
- **The summonable judge** — fitness (not just ownership) rendered at the consent junction; the
  `ATLAS_MATCH_CMD` seam generalized into the registration path, judge-when-it-can / human-when-it-can't.
- **The live cross-Atlas bill** — `request-search` actually emitting the signed bill branch to a peer,
  and `answer-bills` reading inbound `request/**` branches and returning the bulk signed answer PR. One
  hop, invitation not delivery.

## Phase C — aggregation upward

Once real listed Tells publish transparency reports, the **aggregator** lands: a scheduled job that
pulls each Tell's described `reports`, validates the shape its CONSTITUTION promised, and rolls them into
constituency reports — affirmative escalation made concrete. **Standing** follows: a coarse,
per-constituency credibility tally derived from how long a line has stood and how much it has gathered,
surfaced without raw per-respondent counts.

## What this means for today's code

- Human-merge registration and the empty-on-`main` request queue are **Phase-A** shapes, not endpoints.
  A change should move toward trustless, self-checking listing — never deepen reliance on the merge being
  the only gate.
- The `ATLAS_MATCH_CMD` seam is the judge's first home; keep it honest-by-default so an unconfigured
  Atlas accepts nothing rather than faking a match.
- The `reports` description a Tell carries is the durable contract aggregation will consume; treat it as
  load-bearing even though the rollup isn't built.

## Open mechanisms

Tracked in [`OPEN-QUESTIONS.md`](https://github.com/FCCN-ANTIBODY/civic-node/blob/main/OPEN-QUESTIONS.md):
the summonable judge (**A**), registration validation and idiom unification (**B**), aggregation and
standing (**C**), the live cross-Atlas bill (**D**), matcher addressing (**E**), and the hub geo-fill and
widget mounting (**H**).
