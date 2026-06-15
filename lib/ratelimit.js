// Rate limit per-IP sederhana berbasis Cloudflare Workers KV (fixed window).
// Dipakai endpoint /api/audit-lead untuk menahan spam (mis. maksimal 5/jam/IP).

// kv: KV namespace binding (env.RATE_LIMIT). Bila tidak ada (dev tanpa KV),
// fail-open supaya pengembangan lokal tetap jalan.
export async function checkRateLimit(kv, key, opts = {}) {
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 5;
  const windowSeconds = Number(opts.windowSeconds) > 0 ? Number(opts.windowSeconds) : 3600;

  if (!kv || typeof kv.get !== 'function') {
    return { allowed: true, remaining: limit, skipped: true };
  }

  const k = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);
  let count = 0;
  let reset = now + windowSeconds;

  const raw = await kv.get(k);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      count = Number(parsed.count) || 0;
      reset = Number(parsed.reset) || reset;
      if (reset <= now) {
        count = 0;
        reset = now + windowSeconds;
      }
    } catch {
      count = 0;
      reset = now + windowSeconds;
    }
  }

  if (count >= limit) {
    return { allowed: false, remaining: 0, reset };
  }

  count += 1;
  const ttl = Math.max(1, reset - now);
  await kv.put(k, JSON.stringify({ count, reset }), { expirationTtl: ttl });
  return { allowed: true, remaining: Math.max(0, limit - count), reset };
}
