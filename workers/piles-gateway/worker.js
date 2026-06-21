// Atlas piles gateway Worker.
//
// Serves atlas.anecdote.channel/piles/* from the `piles-data` branch of this
// repo — the store that consenting piles place their artifacts into, out-of-band
// of the Pages build. This is what makes Atlas a gateway: the only public surface
// for a pile's data is Atlas's own domain, and a placement never rebuilds the site.
//
// Behaviour:
//   - GET /piles/<path>  → raw `piles-data` content, cached, CORS-open so that
//     cross-origin aggregators (e.g. anecdote.channel) can read it too.
//   - missing on piles-data → fall back to the Pages origin, which serves the
//     committed seed map, so a slice renders before its first placement.

const OWNER = "FCCN-ANTIBODY";
const REPO = "atlas.anecdote.channel";
const DATA_BRANCH = "piles-data";
const CACHE_TTL = 300; // seconds; per-slice freshness within the ~10-min cadence

const TYPES = {
  xml: "application/xml; charset=utf-8",
  xsl: "text/xsl; charset=utf-8",
  json: "application/json; charset=utf-8",
};

function contentType(path) {
  const ext = path.split(".").pop().toLowerCase();
  return TYPES[ext] || "application/octet-stream";
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Only this Worker's concern; anything else is passed to origin (Pages).
    if (!url.pathname.startsWith("/piles/")) return fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const raw =
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${DATA_BRANCH}` +
      url.pathname;

    const placed = await fetch(raw, { cf: { cacheTtl: CACHE_TTL, cacheEverything: true } });

    // Not yet placed on piles-data → serve the committed seed from the origin.
    const resp = placed.status === 404 ? await fetch(request) : placed;

    const headers = new Headers(resp.headers);
    headers.set("Content-Type", contentType(url.pathname));
    headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-Atlas-Gateway", placed.status === 404 ? "seed" : "placed");

    return new Response(resp.body, { status: resp.status, headers });
  },
};
