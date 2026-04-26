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

const LOCK_TTL_SECONDS = 10 * 60;
const KEY_PART_PATTERN = /^[\p{Letter}\p{Number}_-]+$/u;

export default {
  async fetch(request, env) {
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
        return handleCounts(request, env, url);
      }

      return jsonResponse(request, { error: "Not found" }, 404);
    } catch (error) {
      return jsonResponse(request, { error: "Internal error", detail: error.message }, 500);
    }
  },
};

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
  const key = tallyKey(city, district, village);

  // Dev bypass: when the request comes from a localhost origin (already
  // restricted to the dev allowlist above), skip the IP rate-limit so a
  // single dev machine can hammer +1 to verify the tally pipeline. Production
  // origins still go through the 10-min IP lock.
  const origin = request.headers.get("Origin") || "";
  const isDevOrigin = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");

  let lockKey = null;
  if (!isDevOrigin) {
    const ipHash = await getIpHash(request);
    lockKey = `lock:${key}:${ipHash}`;
    const lockExists = await env.CHANGE_TALLY.get(lockKey);
    if (lockExists) {
      const current = await readCount(env.CHANGE_TALLY, key);
      return jsonResponse(request, { key, counted: false, reason: "rate_limited", count: current });
    }
  }

  const current = await readCount(env.CHANGE_TALLY, key);
  const field = EVENTS[event];
  const next = {
    city,
    district,
    village,
    shares: current.shares + (field === "shares" ? 1 : 0),
    views: current.views + (field === "views" ? 1 : 0),
    lastUpdate: Date.now(),
  };

  await env.CHANGE_TALLY.put(key, JSON.stringify(next));
  if (lockKey) {
    await env.CHANGE_TALLY.put(lockKey, "1", { expirationTtl: LOCK_TTL_SECONDS });
  }

  return jsonResponse(request, { key, counted: true, count: next });
}

async function handleCounts(request, env, url) {
  const city = normalizePart(url.searchParams.get("city") || "");
  if (!city.ok) {
    return jsonResponse(request, { error: "Missing or invalid city" }, 400);
  }

  const prefix = `${city.value}-`;
  const counts = {};
  let cursor;

  do {
    const page = await env.CHANGE_TALLY.list({ prefix, cursor });
    await Promise.all(page.keys.map(async ({ name }) => {
      const value = await readCount(env.CHANGE_TALLY, name);
      counts[name] = value;
    }));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return jsonResponse(request, { city: city.value, counts });
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

function tallyKey(city, district, village) {
  return `${city}-${district}-${village}`;
}

async function readCount(kv, key) {
  const value = await kv.get(key, "json");
  return {
    city: value?.city ?? parseKey(key).city,
    district: value?.district ?? parseKey(key).district,
    village: value?.village ?? parseKey(key).village,
    shares: Number.isFinite(value?.shares) ? value.shares : 0,
    views: Number.isFinite(value?.views) ? value.views : 0,
    lastUpdate: Number.isFinite(value?.lastUpdate) ? value.lastUpdate : null,
  };
}

function parseKey(key) {
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
