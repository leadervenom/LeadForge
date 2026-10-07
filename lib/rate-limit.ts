const buckets = new Map<string, { count: number; reset: number }>();

/**
 * Fixed-window in-memory limiter. It is per instance only, which is enough for a basic
 * abuse guard: Fluid Compute reuses instances, so bursts still get caught.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  b.count++;
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "local"
  );
}

/** Returns a 429 response when over the limit, otherwise null. */
export function limited(req: Request, name: string, limit: number, windowMs = 60_000) {
  const r = rateLimit(`${name}:${clientIp(req)}`, limit, windowMs);
  if (r.ok) return null;
  return Response.json(
    { error: `Too many requests. Try again in ${r.retryAfter}s.` },
    { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
  );
}
