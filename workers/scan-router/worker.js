// Atlas scan-router Worker — the hub geo-fill.
//
// Fronts the Atlas hub root. A baked locator QR opens the hub with a GEO-LESS stem:
//
//     https://atlas.anecdote.channel/?node=<stem>&home=<scope>
//
// This Worker fills the SCANNER's US state from the edge geo Cloudflare already attaches to
// the request (request.cf) — no SDK, no third party, no IP ever leaving the edge — and 302s to
// the per-state host:
//
//     <stem>.<state>.anecdote.channel
//
// It is the server-side counterpart to assets/scan.js: when this Worker is on the route it
// redirects before the request reaches Pages, so a real scan resolves; when it is absent the
// request falls through to Pages and scan.js renders the missing-in-state page instead. Same
// route discipline as workers/piles-gateway — intercept one concern, pass everything else
// (the directory shell, assets) straight through to the GitHub Pages origin.
//
// PROOF-GRADE, by intent: a region we can't resolve (no edge geo, a non-US scan, or a state
// not in the table below) falls back to a default scope so a scan always lands somewhere live.
// A US state we DO resolve but that has no subdomain yet will 404 on its own host until it
// comes online — that is the honest "fill the scanner's state" behaviour, and visiting another
// state by hand is fine for now.

const APEX = "anecdote.channel";
const DEFAULT_STATE = "colorado"; // where an unresolved scan lands for the proof

// cf.regionCode is the ISO-3166-2 subdivision part (e.g. "CO"); cf.region is the full name
// ("Colorado"). We key on the code and keep the map flat and readable — one line per state, a
// human can scan it and see exactly what resolves where.
const STATE_BY_CODE = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california",
  CO: "colorado", CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia",
  HI: "hawaii", ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine", MD: "maryland",
  MA: "massachusetts", MI: "michigan", MN: "minnesota", MS: "mississippi", MO: "missouri",
  MT: "montana", NE: "nebraska", NV: "nevada", NH: "new-hampshire", NJ: "new-jersey",
  NM: "new-mexico", NY: "new-york", NC: "north-carolina", ND: "north-dakota", OH: "ohio",
  OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode-island", SC: "south-carolina",
  SD: "south-dakota", TN: "tennessee", TX: "texas", UT: "utah", VT: "vermont",
  VA: "virginia", WA: "washington", WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
  DC: "district-of-columbia",
};

// One clean DNS label, lowercased. Anything else -> "" so a junk value can't build a host.
const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export function label(raw) {
  const s = String(raw == null ? "" : raw).trim().toLowerCase().replace(/\s+/g, "-");
  return LABEL.test(s) ? s : "";
}

// The baked stem may be multi-label (a journal's <journal>.<atlas>); every label must be clean.
export function stem(raw) {
  const s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return "";
  return s.split(".").every((l) => LABEL.test(l)) ? s : "";
}

// Resolve the scanner's state slug: explicit ?state= (testing / a pinned scan) wins, then the
// edge's US region, then the default. (Named export so test/run.sh can exercise the table +
// fallback without a Cloudflare runtime.)
export function fillState(searchParams, cf) {
  const override = label(searchParams.get("state"));
  if (override) return override;
  const us = cf && cf.country === "US" ? STATE_BY_CODE[String(cf.regionCode || "").toUpperCase()] : "";
  return us || DEFAULT_STATE;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const node = stem(url.searchParams.get("node"));

    // Not a scan landing (the directory homepage, a crawler, anything without ?node=): hands off
    // to the Pages origin untouched. The Worker only owns the geo-fill.
    if (!node) return fetch(request);

    const state = fillState(url.searchParams, request.cf);
    const target = `https://${node}.${state}.${APEX}/`;
    return Response.redirect(target, 302);
  },
};
