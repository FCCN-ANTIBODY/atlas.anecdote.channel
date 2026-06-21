// Atlas piles gateway Worker.
//
// Serves atlas.anecdote.channel/piles/<id>/<file> from the pile's OWN branch —
// a self-named, prefixed ref (pile/<scope>/<id>) the consenting pile pushes
// signed commits to, out-of-band of the Pages build. This is what makes Atlas a
// gateway: the only public surface for a pile's data is Atlas's own domain, and
// a placement never rebuilds the site.
//
// Resolution:
//   1. parse /piles/<id>/<file> from the request path
//   2. read the rendered manifest (/piles.json on the Pages origin) to map
//      id -> backing branch (the registry _data/piles.yml is the trust anchor)
//   3. fetch raw <branch>/<file>, cached, CORS-open so cross-origin aggregators
//      (e.g. anecdote.channel) can read it too
//   4. unknown id / not-yet-placed -> fall back to the Pages origin, which serves
//      the committed seed map so a slice renders before its first placement

const OWNER = "FCCN-ANTIBODY";
const REPO = "atlas.anecdote.channel";
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

// The rendered registry (Liquid emits it; the raw repo file is just a template),
// so it must come from the Pages origin, not raw.githubusercontent.
async function loadManifest(origin) {
  try {
    const r = await fetch(`${origin}/piles.json`, {
      cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
    });
    return r.ok ? await r.json() : [];
  } catch (_) {
    return [];
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Only this Worker's concern; anything else (incl. /piles.json) hits origin.
    if (!url.pathname.startsWith("/piles/")) return fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // /piles/<id>/<file> — the pile writes <file> (map.xml / map.xsl) at its
    // branch root, so <file> maps straight onto the raw path within the branch.
    const rest = url.pathname.slice("/piles/".length);
    const slash = rest.indexOf("/");
    const id = slash === -1 ? rest : rest.slice(0, slash);
    const file = slash === -1 ? "" : rest.slice(slash + 1);

    const entry = (await loadManifest(url.origin)).find((p) => p.id === id);

    let placed = null;
    if (entry && entry.branch && file) {
      const raw =
        `https://raw.githubusercontent.com/${OWNER}/${REPO}/` +
        `${entry.branch}/${file}`;
      placed = await fetch(raw, { cf: { cacheTtl: CACHE_TTL, cacheEverything: true } });
    }

    // Placed data wins; otherwise serve the committed seed from the origin.
    const usePlaced = placed && placed.ok;
    const resp = usePlaced ? placed : await fetch(request);

    const headers = new Headers(resp.headers);
    headers.set("Content-Type", contentType(url.pathname));
    headers.set("Cache-Control", `public, max-age=${CACHE_TTL}`);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-Atlas-Gateway", usePlaced ? "placed" : "seed");

    return new Response(resp.body, { status: resp.status, headers });
  },
};
