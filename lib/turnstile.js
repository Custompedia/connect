// Hook verifikasi Cloudflare Turnstile (anti-bot opsional, §7 spec).
// Nonaktif secara default: bila TURNSTILE_SECRET kosong, langsung lolos.
// Untuk mengaktifkan: set TURNSTILE_SECRET (server) + TURNSTILE_SITE_KEY (widget
// di form), lalu tambahkan widget Turnstile di public/audit/index.html.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'missing-token' };

  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);

  try {
    const res = await fetch(VERIFY_URL, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    return { ok: Boolean(data.success), data };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}
