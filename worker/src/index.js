const ALLOWED_ORIGINS = new Set([
  "https://ileivoivm.github.io",
  // Local dev origins — Vite default 5173 + project preferred 5200.
  // Lets the Share Tower client be exercised end-to-end without deploying.
  "http://localhost:5173",
  "http://localhost:5200",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5200",
]);

const EVENTS = {
  share: "shares",
  view: "views",
};

// IP rate-limit window for production (non-localhost) callers. Lifted from
// 10 minutes → 24 hours to harden against IP-rotation pump attacks; combined
// with the daily decay cron this enforces the「每天 +1，每天 −1」 model.
const LOCK_TTL_SECONDS = 24 * 60 * 60;
const KEY_PART_PATTERN = /^[\p{Letter}\p{Number}_-]+$/u;

// /counts edge cache TTL. Multiple visitors landing within a 60s window share
// one Cache API hit instead of each round-tripping to KV.
const COUNTS_CACHE_TTL = 60;

// All tallies for a city live in a single KV value at `agg:{city}`. Reading
// counts is one KV get instead of (1 list + N gets); writes RMW the same key.
function aggKey(city) { return `agg:${city}`; }

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    try {
      if (!env.CHANGE_TALLY) {
        return jsonResponse(request, { error: "KV binding CHANGE_TALLY is missing" }, 500);
      }

      if (request.method === "POST" && url.pathname === "/tally") {
        return handleTally(request, env);
      }

      if (request.method === "GET" && url.pathname === "/counts") {
        return handleCounts(request, env, url, ctx);
      }

      return jsonResponse(request, { error: "Not found" }, 404);
    } catch (error) {
      return jsonResponse(request, { error: "Internal error", detail: error.message }, 500);
    }
  },

  // Daily decay: every village's (shares, views) tick down by 1; entries that
  // hit (0, 0) are removed from the agg object so dead villages don't bloat
  // the value or render phantom towers.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(decayAllTallies(env));
  },
};

// Load the per-city agg object. If it doesn't exist yet, lazy-migrate from
// any legacy `{city}-{district}-{village}` per-key entries that pre-date the
// agg-key refactor — this is a one-time list+N-get; afterwards reads are 1.
async function loadAgg(env, city) {
  const existing = await env.CHANGE_TALLY.get(aggKey(city), "json");
  if (existing && typeof existing === "object") return existing;

  const prefix = `${city}-`;
  const agg = {};
  let cursor;
  do {
    const page = await env.CHANGE_TALLY.list({ prefix, cursor });
    await Promise.all(page.keys.map(async ({ name }) => {
      // Skip lock keys (they live under `lock:` prefix so this is defensive).
      if (name.startsWith("lock:")) return;
      const value = await env.CHANGE_TALLY.get(name, "json");
      if (!value || typeof value !== "object") return;
      agg[name] = {
        city: value.city ?? parseLegacyKey(name).city,
        district: value.district ?? parseLegacyKey(name).district,
        village: value.village ?? parseLegacyKey(name).village,
        shares: Number.isFinite(value.shares) ? value.shares : 0,
        views: Number.isFinite(value.views) ? value.views : 0,
        lastUpdate: Number.isFinite(value.lastUpdate) ? value.lastUpdate : null,
      };
    }));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  await env.CHANGE_TALLY.put(aggKey(city), JSON.stringify(agg));
  return agg;
}

async function handleTally(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: "Body must be JSON" }, 400);
  }

  const normalized = normalizePayload(payload);
  if (!normalized.ok) {
    return jsonResponse(request, { error: normalized.error }, 400);
  }

  const { city, district, village, event } = normalized.data;
  const fullKey = `${city}-${district}-${village}`;

  // Dev bypass: localhost origins (already restricted to the dev allowlist
  // above) skip the IP rate-limit so a single dev machine can hammer +1 to
  // verify the tally pipeline.
  const origin = request.headers.get("Origin") || "";
  const isDevOrigin = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");

  let lockKey = null;
  if (!isDevOrigin) {
    const ipHash = await getIpHash(request);
    lockKey = `lock:${fullKey}:${ipHash}`;
    const lockExists = await env.CHANGE_TALLY.get(lockKey);
    if (lockExists) {
      const agg = await loadAgg(env, city);
      const current = agg[fullKey] || { city, district, village, shares: 0, views: 0, lastUpdate: null };
      return jsonResponse(request, { key: fullKey, counted: false, reason: "rate_limited", count: current });
    }
  }

  const agg = await loadAgg(env, city);
  const cur = agg[fullKey] || { city, district, village, shares: 0, views: 0 };
  const field = EVENTS[event];
  const next = {
    city,
    district,
    village,
    shares: cur.shares + (field === "shares" ? 1 : 0),
    views: cur.views + (field === "views" ? 1 : 0),
    lastUpdate: Date.now(),
  };
  agg[fullKey] = next;

  await env.CHANGE_TALLY.put(aggKey(city), JSON.stringify(agg));
  if (lockKey) {
    await env.CHANGE_TALLY.put(lockKey, "1", { expirationTtl: LOCK_TTL_SECONDS });
  }

  // Cache invalidation is intentionally skipped: the 60s TTL caps staleness,
  // and the client does an optimistic local +1 so the UI feels instant.
  return jsonResponse(request, { key: fullKey, counted: true, count: next });
}

async function handleCounts(request, env, url, ctx) {
  const city = normalizePart(url.searchParams.get("city") || "");
  if (!city.ok) {
    return jsonResponse(request, { error: "Missing or invalid city" }, 400);
  }

  // Cache key includes origin so each allowed CORS origin gets its own slot
  // (Access-Control-Allow-Origin is request-specific). Synthetic URL keeps
  // the cache namespace separate from the public route.
  const origin = request.headers.get("Origin") || "no-origin";
  const cache = caches.default;
  const cacheKeyUrl = `https://cache.internal/counts/${city.value}?origin=${encodeURIComponent(origin)}`;
  const cacheKey = new Request(cacheKeyUrl, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const agg = await loadAgg(env, city.value);
  const response = jsonResponse(request, { city: city.value, counts: agg });
  response.headers.set("Cache-Control", `public, max-age=${COUNTS_CACHE_TTL}`);

  if (ctx?.waitUntil) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    await cache.put(cacheKey, response.clone());
  }
  return response;
}

async function decayAllTallies(env) {
  if (!env.CHANGE_TALLY) return { processed: 0 };
  let processed = 0;
  let cleared   = 0;
  let cursor;
  do {
    const page = await env.CHANGE_TALLY.list({ prefix: "agg:", cursor });
    for (const { name } of page.keys) {
      const agg = await env.CHANGE_TALLY.get(name, "json");
      if (!agg || typeof agg !== "object") continue;
      let mutated = false;
      for (const [fullKey, value] of Object.entries(agg)) {
        if (!value || typeof value !== "object") continue;
        const shares = Math.max(0, (Number(value.shares) || 0) - 1);
        const views  = Math.max(0, (Number(value.views)  || 0) - 1);
        if (shares === 0 && views === 0) {
          delete agg[fullKey];
          cleared++;
        } else {
          agg[fullKey] = { ...value, shares, views, lastDecay: Date.now() };
        }
        mutated = true;
        processed++;
      }
      if (mutated) {
        await env.CHANGE_TALLY.put(name, JSON.stringify(agg));
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { processed, cleared };
}

function normalizePayload(payload) {
  const city = normalizePart(payload?.city);
  const district = normalizePart(payload?.district);
  const village = normalizePart(payload?.village);
  const event = payload?.event;

  if (!city.ok) return { ok: false, error: "Missing or invalid city" };
  if (!district.ok) return { ok: false, error: "Missing or invalid district" };
  if (!village.ok) return { ok: false, error: "Missing or invalid village" };
  if (!Object.hasOwn(EVENTS, event)) return { ok: false, error: "event must be share or view" };

  return {
    ok: true,
    data: {
      city: city.value,
      district: district.value,
      village: village.value,
      event,
    },
  };
}

function normalizePart(value) {
  if (typeof value !== "string") return { ok: false };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64 || !KEY_PART_PATTERN.test(trimmed)) {
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}

function parseLegacyKey(key) {
  const [city = "", district = "", ...villageParts] = key.split("-");
  return { city, district, village: villageParts.join("-") };
}

async function getIpHash(request) {
  const ip = request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
    || "unknown";
  const encoded = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });

  if (ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function jsonResponse(request, data, status = 200) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers });
}
