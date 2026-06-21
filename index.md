---
layout: default
title: null
---

# Atlas

Atlas is a **reflection API**: a browser over moderated snapshots ("maps") published by
[anecdote.channel](https://anecdote.channel) data-piles. Each pile keeps its raw answers in a
private sink and emits only a small, coarse, public map — Atlas reflects those maps.

## Reflected piles

{% assign piles = site.data.reflected_piles %}
{% if piles and piles.size > 0 %}
<ul class="pile-index">
  {% for pile in piles %}
  <li>
    <a href="{{ pile.url | relative_url }}">{{ pile.name }}</a>
    {% if pile.updated_at %}<span class="meta">updated {{ pile.updated_at }}</span>{% endif %}
  </li>
  {% endfor %}
</ul>
{% else %}
<p>No piles are currently reflected. Add one to <code>_data/piles.yml</code>.</p>
{% endif %}
