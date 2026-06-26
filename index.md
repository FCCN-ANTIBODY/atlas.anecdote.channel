---
layout: default
title: null
---

# Atlas

Atlas is a **directory of Tells** — the jurisdiction hubs that front data-piles — and a reflecting
gateway for the coarse maps the piles behind them place here. See the [directory of Tells](/tells/)
([`/tells.json`](/tells.json)); a pile is reached *through* its Tell. Each pile keeps its raw answers
in a private sink and emits only a small, coarse, public map — Atlas reflects those maps below.

Atlas builds only a static shell. The map for each pile is fetched **at runtime, per slice**, so a
pile's data update is available passively without rebuilding this site; a freshness badge shows how
recently each slice was published.

Atlas binds itself to one document: its [constitution](/CONSTITUTION.md) — what it will and won't do
with what piles place here.

<div id="atlas">
  <noscript>
    This browser reflects piles at runtime and needs JavaScript. The registry is at
    <a href="/piles.json">/piles.json</a>; each pile's map is a standalone XML document you can open
    directly.
  </noscript>
</div>

<script src="{{ '/assets/atlas.js' | relative_url }}" defer></script>
