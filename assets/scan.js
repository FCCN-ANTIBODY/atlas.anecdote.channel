// Atlas hub-fill landing — the scanner side of the baked locator QR.
//
// A node's data-filled widget (atlas/bin/widget) bakes a QR carrying a GEO-LESS stem:
//
//     https://atlas.anecdote.channel/?node=<atlas>&home=<scope>
//
// This script runs on that landing. It fills the SCANNER's US state and sends the scan on to
// the per-state directory host:
//
//     <node>.<state>.anecdote.channel
//
// It only acts when a `node` is present — a plain visit to atlas.anecdote.channel is the
// directory homepage (assets/atlas.js renders it), untouched. When this DOES take over it
// removes #atlas first, so atlas.js no-ops (its init bails when #atlas is gone) and the
// directory never flashes behind a scan.
//
// Resolution is loose BY DESIGN — we never geo-block this layer. The scan resolves only when
// the scanner's state is known AND matches the node's home `scope`; anything else (state
// unknown, or an out-of-state scan) lands on the missing-in-state page rather than a guessed
// subdomain that would 404. That page is the auto-marketing surface for a scan that found the
// idea before the idea reached the scanner's state.
//
// Where the scanner's state comes from: today it arrives explicitly (`?state=`, e.g. used in
// testing or injected at the edge) or via `window.__ANECDOTE_GEO_STATE` (a global a geo edge
// snippet may set). The first-party production fill — a Cloudflare Worker on the apex reading
// `request.cf.regionCode` and 302-ing before the request ever reaches Pages — is the documented
// next step (OPEN-QUESTIONS). Until it is wired, real scans land on the missing-in-state page,
// which is exactly the marketing default we want.

(function () {
  "use strict";

  var LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/; // one DNS label, lowercased

  // The constellation's registrable apex is the last two labels of whatever host this hub is
  // served from (atlas.anecdote.channel -> anecdote.channel), so the same script fills
  // correctly on any *.anecdote.channel hub.
  function deriveApex(hostname) {
    var parts = String(hostname || "").split(".").filter(Boolean);
    return parts.slice(-2).join(".");
  }

  // Normalize a US-state token to the lowercase DNS label used as the <state> segment. Loose:
  // trims, lowercases, spaces -> hyphens. Returns "" for anything that can't be one clean DNS
  // label, so a junk value can never build a host.
  function stateSlug(raw) {
    var s = String(raw == null ? "" : raw).trim().toLowerCase().replace(/\s+/g, "-");
    return LABEL.test(s) ? s : "";
  }

  // The baked stem the QR carries. A stem may be multi-label (a journal's <journal>.<atlas>);
  // every label must be a clean DNS label or the whole stem is rejected.
  function nodeStem(raw) {
    var s = String(raw == null ? "" : raw).trim().toLowerCase();
    if (!s) return "";
    var labels = s.split(".");
    for (var i = 0; i < labels.length; i++) {
      if (!LABEL.test(labels[i])) return "";
    }
    return s;
  }

  // The resolved per-state host URL a scan redirects to: <stem>.<state>.<apex>/
  function buildTarget(opts) {
    var stem = nodeStem(opts.node);
    var state = stateSlug(opts.state);
    var apex = opts.apex;
    var proto = opts.protocol || "https:";
    if (!stem || !state || !apex) return null;
    return proto + "//" + stem + "." + state + "." + apex + "/";
  }

  // Decide where a scan goes:
  //   {action:"none"}                       not a scan landing (no usable node) -> directory
  //   {action:"redirect", url}              state resolves to the node's home -> send it on
  //   {action:"missing", node, home, state} unknown/out-of-state -> the marketing page
  // Redirect only when the scanner's state matches the node's home `scope` (or no home was
  // carried). Portability — a directory resolving in more than its home state — is a later step
  // (OPEN-QUESTIONS); until then an out-of-state scan is missing-in-state, never a 404 guess.
  function route(opts) {
    var stem = nodeStem(opts.node);
    if (!stem) return { action: "none" };
    var home = stateSlug(opts.home);
    var state = stateSlug(opts.state);
    if (state && (state === home || !home)) {
      var url = buildTarget({ node: stem, state: state, apex: opts.apex, protocol: opts.protocol });
      if (url) return { action: "redirect", url: url };
    }
    return { action: "missing", node: stem, home: home, state: state };
  }

  var api = {
    deriveApex: deriveApex,
    stateSlug: stateSlug,
    nodeStem: nodeStem,
    buildTarget: buildTarget,
    route: route,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api; // test hook (node)
  if (typeof window !== "undefined") window.atlasScan = api;                  // test hook (browser)

  // --- browser behavior --------------------------------------------------
  if (typeof document === "undefined" || typeof window === "undefined") return;

  function params() {
    var out = {};
    function take(src) {
      try { new URLSearchParams(src).forEach(function (v, k) { if (!(k in out)) out[k] = v; }); } catch (e) {}
    }
    take(location.search);
    take((location.hash || "").replace(/^#/, ""));
    return out;
  }

  function detectState(cfg) {
    if (cfg.state) return cfg.state;
    return typeof window.__ANECDOTE_GEO_STATE === "string" ? window.__ANECDOTE_GEO_STATE : "";
  }

  function esc(s) {
    return String(s).replace(/[<&>"]/g, function (c) {
      return { "<": "&lt;", "&": "&amp;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function titleize(slug) {
    return String(slug || "").split("-").map(function (w) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(" ");
  }

  function renderMissing(r) {
    var apex = deriveApex(location.hostname);
    var mount = document.getElementById("scan");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "scan";
      (document.querySelector("main") || document.body).appendChild(mount);
    }
    mount.hidden = false;

    var homeHost = r.home ? r.node + "." + r.home + "." + apex : null;
    var where = r.state ? "in " + titleize(r.state) : "where you are";
    var html =
      '<section class="scan-miss">' +
      '<p class="scan-miss__kicker">Missing in-state scan</p>' +
      '<h1 class="scan-miss__head">This directory isn’t standing ' + esc(where) + ' — yet.</h1>';

    if (homeHost) {
      html +=
        '<p class="scan-miss__lede">You scanned <code>' + esc(r.node) + '</code>, a directory that ' +
        'currently resolves in <strong>' + esc(titleize(r.home)) + '</strong>. The code carries no ' +
        'state of its own — this hub fills the scanner’s, and yours doesn’t place you there.</p>' +
        '<p class="scan-miss__cta"><a href="https://' + esc(homeHost) + '/">Open it where it lives → ' +
        esc(homeHost) + '</a></p>';
    } else {
      html +=
        '<p class="scan-miss__lede">You scanned <code>' + esc(r.node) + '</code>. The code carries no ' +
        'state of its own — this hub fills the scanner’s — and we couldn’t place ' +
        'you in one, so there’s nowhere in-state to send you yet.</p>';
    }

    html +=
      '<p class="scan-miss__note">Nothing here is geo-blocked. When this directory travels to your ' +
      'state, the same code resolves there too. In the meantime, the canonical directory is below.</p>' +
      '<p class="scan-miss__more"><a href="/">Browse the reference Atlas →</a></p>' +
      '</section>';

    mount.innerHTML = html;
  }

  function boot() {
    var cfg = params();
    if (!nodeStem(cfg.node)) return; // ordinary directory visit — leave #atlas for atlas.js

    // Hub-fill mode: take the page over so the directory never flashes behind a scan.
    var dir = document.getElementById("atlas");
    if (dir && dir.parentNode) dir.parentNode.removeChild(dir);

    var r = route({
      node: cfg.node,
      home: cfg.home,
      state: detectState(cfg),
      apex: deriveApex(location.hostname),
      protocol: location.protocol,
    });
    if (r.action === "redirect") { location.replace(r.url); return; }
    renderMissing(r);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
