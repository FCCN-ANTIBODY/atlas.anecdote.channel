// Atlas runtime reflection.
//
// The build emits only the static shell + piles.json (the registry manifest).
// This script does the reflecting in the browser: read the manifest, then fetch
// each pile's XML "map" per-slice and render it as it resolves. Because data is
// fetched at runtime, a pile's ~10-minute data update never rebuilds the site —
// freshness is governed by each map's CDN/Cloudflare cache TTL, and a staleness
// badge surfaces how old each slice is.
//
// Atlas is a GATEWAY: every map is fetched from Atlas's OWN domain (the `map`
// path the gateway places it at), never from a pile's repo. That keeps the
// browser — and downstream aggregators — reading a single, consented, Atlas-
// hosted surface. The XML parse mirrors the old build-time Ruby generator
// field-for-field; only the consumption moved from REXML (build) to DOMParser
// (runtime).

(function () {
  "use strict";

  var STALE_AFTER_MS = 30 * 60 * 1000; // older than this => "stale" badge

  // --- fetch -------------------------------------------------------------

  function getText(url) {
    return fetch(url, { headers: { Accept: "application/xml" } }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
      return r.text();
    });
  }

  // Fetch the pile's map from its Atlas-hosted path (same-origin). The gateway
  // is responsible for placing fresh data there; a committed seed lives at the
  // same path so a slice still renders before/without live placement.
  function fetchMap(pile) {
    if (!pile.map) return Promise.reject(new Error("no map path for " + pile.id));
    return getText(pile.map);
  }

  // --- parse (mirrors atlas_reflection.rb#parse_map) ---------------------

  function parseMap(xmlText, entry) {
    var doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("malformed XML");
    var root = doc.documentElement;
    if (!root || root.nodeName !== "map") throw new Error("missing <map> root element");

    var options = [].map.call(root.querySelectorAll("options > option"), function (o) {
      var tier = o.querySelector("tier");
      return {
        id: o.getAttribute("id"),
        label: o.getAttribute("label"),
        tier: tier ? (tier.textContent || "").trim() : null,
      };
    });

    var district = root.querySelector("district");
    var rejected = root.querySelector("rejected");
    var totals = root.querySelector("totals");
    var question = root.querySelector("question");

    return {
      id: entry.id,
      name: entry.name || root.getAttribute("poll-id"),
      poll_id: root.getAttribute("poll-id"),
      updated_at: root.getAttribute("updated-at"),
      version: root.getAttribute("version"),
      district: district
        ? { id: district.getAttribute("id"), name: district.getAttribute("name") }
        : null,
      question: question ? (question.textContent || "").trim() : null,
      options: options,
      accepted: totals ? totals.getAttribute("accepted") : null,
      rejected: rejected
        ? {
            geo: rejected.getAttribute("geo"),
            sig: rejected.getAttribute("sig"),
            malformed: rejected.getAttribute("malformed"),
            other: rejected.getAttribute("other"),
          }
        : null,
      url: "?pile=" + encodeURIComponent(entry.id),
    };
  }

  // --- staleness ---------------------------------------------------------

  function ageMs(iso) {
    var t = Date.parse(iso);
    return isNaN(t) ? null : Date.now() - t;
  }

  function relativeAge(iso) {
    var ms = ageMs(iso);
    if (ms === null) return "";
    var min = Math.round(ms / 60000);
    if (min < 1) return "just now";
    if (min < 60) return min + "m ago";
    var hr = Math.round(min / 60);
    if (hr < 24) return hr + "h ago";
    return Math.round(hr / 24) + "d ago";
  }

  function freshnessBadge(iso) {
    var ms = ageMs(iso);
    if (ms === null) return "";
    var stale = ms > STALE_AFTER_MS;
    return (
      '<span class="freshness ' +
      (stale ? "is-stale" : "is-fresh") +
      '" title="updated ' +
      escapeAttr(iso || "") +
      '">' +
      (stale ? "stale" : "fresh") +
      "</span>"
    );
  }

  // --- render ------------------------------------------------------------

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
  function escAttr(s) {
    return esc(s).replace(/"/g, "&quot;");
  }
  var escapeAttr = escAttr;

  function optionsList(pile) {
    return (
      '<ul class="options">' +
      pile.options
        .map(function (o) {
          return (
            "<li><span class=\"label\">" +
            esc(o.label) +
            '</span><span class="tier tier-' +
            esc(o.tier) +
            '">' +
            esc(o.tier) +
            "</span></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function renderCardInto(li, pile) {
    li.innerHTML =
      '<a href="?pile=' +
      escAttr(encodeURIComponent(pile.id)) +
      '">' +
      esc(pile.name) +
      "</a>" +
      '<span class="meta">' +
      (pile.district ? esc(pile.district.name) + " · " : "") +
      "updated " +
      esc(relativeAge(pile.updated_at)) +
      " " +
      freshnessBadge(pile.updated_at) +
      "</span>";
  }

  function renderDetail(root, pile) {
    root.innerHTML =
      '<article class="pile">' +
      '<p class="crumb"><a href="./">← all piles</a></p>' +
      "<h1>" +
      esc(pile.question || pile.name) +
      "</h1>" +
      '<p class="meta">' +
      (pile.district ? esc(pile.district.name) + " · " : "") +
      "poll <code>" +
      esc(pile.poll_id) +
      "</code>" +
      (pile.updated_at
        ? " · updated " + esc(relativeAge(pile.updated_at)) + " " + freshnessBadge(pile.updated_at)
        : "") +
      "</p>" +
      "<h2>Options</h2>" +
      optionsList(pile) +
      '<p class="note">Tiers (low / med / high) are intentionally coarse — Atlas reflects relative ' +
      "standing, not raw vote counts.</p>" +
      "<h2>Totals</h2><p><strong>" +
      esc(pile.accepted) +
      "</strong> accepted responses.</p>" +
      (pile.rejected
        ? "<h2>Rejected</h2><ul class=\"rejected\">" +
          "<li>geo: " + esc(pile.rejected.geo) + "</li>" +
          "<li>signature: " + esc(pile.rejected.sig) + "</li>" +
          "<li>malformed: " + esc(pile.rejected.malformed) + "</li>" +
          "<li>other: " + esc(pile.rejected.other) + "</li></ul>"
        : "") +
      "</article>";
  }

  function renderError(el, msg) {
    el.innerHTML = '<span class="meta error">' + esc(msg) + "</span>";
  }

  // --- views -------------------------------------------------------------

  function showIndex(root, manifest) {
    if (!manifest.length) {
      root.innerHTML = "<p>No piles are registered. Add one to <code>_data/piles.yml</code>.</p>";
      return;
    }
    var list = document.createElement("ul");
    list.className = "pile-index";
    root.innerHTML = "<h2>Reflected piles</h2>";
    root.appendChild(list);

    // One <li> per pile, filled as its slice resolves (progressive, per-slice).
    manifest.forEach(function (entry) {
      var li = document.createElement("li");
      li.className = "loading";
      li.innerHTML = '<span class="meta">' + esc(entry.name) + " — loading…</span>";
      list.appendChild(li);

      fetchMap(entry)
        .then(function (xml) {
          renderCardInto(li, parseMap(xml, entry));
          li.className = "";
        })
        .catch(function (e) {
          renderError(li, entry.name + " — unavailable (" + e.message + ")");
          li.className = "error";
        });
    });
  }

  function showDetail(root, manifest, id) {
    var entry = manifest.filter(function (p) { return p.id === id; })[0];
    if (!entry) {
      root.innerHTML = '<p class="crumb"><a href="./">← all piles</a></p><p>Unknown pile.</p>';
      return;
    }
    root.innerHTML = '<p class="crumb"><a href="./">← all piles</a></p><p class="meta">Loading…</p>';
    fetchMap(entry)
      .then(function (xml) { renderDetail(root, parseMap(xml, entry)); })
      .catch(function (e) { renderError(root, "Could not load " + entry.name + ": " + e.message); });
  }

  // --- boot --------------------------------------------------------------

  function init() {
    var root = document.getElementById("atlas");
    if (!root) return;
    var id = new URLSearchParams(window.location.search).get("pile");

    getText("/piles.json")
      .then(function (t) { return JSON.parse(t); })
      .then(function (manifest) {
        if (id) showDetail(root, manifest, id);
        else showIndex(root, manifest);
      })
      .catch(function (e) { renderError(root, "Could not load registry: " + e.message); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
