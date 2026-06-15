// Logika inti penerima submission form audit.
// Dipakai bersama oleh:
//   - worker/index.js            (deploy sebagai Cloudflare Worker + Static Assets)
//   - functions/api/audit-lead.js (deploy sebagai Cloudflare Pages Function)
//
// Data contract (§5):
//   200 { ok: true }                      sukses (atau spam honeypot, diam-diam)
//   400 { ok: false, errors: {field..} }  gagal validasi
//   429 { ok: false, errors: { _ } }      kena rate limit
//   502 { ok: false, errors: { _ } }      gagal simpan & gagal notifikasi

import { validateLead } from './validate.js';
import { checkRateLimit } from './ratelimit.js';
import { verifyTurnstile } from './turnstile.js';
import { saveLeadToNotion } from './notion.js';
import { notifyTeam } from './notify.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function handleAuditLead(request, env) {
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for') ||
    '';

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, errors: { _: 'Format permintaan tidak valid.' } }, 400);
  }

  const result = validateLead(body);

  // Honeypot terisi -> balas 200 diam-diam, JANGAN simpan (jangan beri sinyal ke bot).
  if (result.spam) {
    return json({ ok: true });
  }

  // Rate limit per-IP (default 5/jam).
  const rl = await checkRateLimit(env.RATE_LIMIT, ip || 'unknown', {
    limit: Number(env.RATE_LIMIT_MAX) || 5,
    windowSeconds: 3600,
  });
  if (!rl.allowed) {
    return json(
      { ok: false, errors: { _: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' } },
      429,
    );
  }

  // Turnstile opsional (aktif hanya bila TURNSTILE_SECRET di-set).
  if (env.TURNSTILE_SECRET) {
    const token = body['cf-turnstile-response'] || body.turnstile_token;
    const ts = await verifyTurnstile(env, token, ip);
    if (!ts.ok) {
      return json(
        { ok: false, errors: { _: 'Verifikasi anti-bot gagal. Muat ulang halaman dan coba lagi.' } },
        400,
      );
    }
  }

  // Validasi field.
  if (!result.ok) {
    return json({ ok: false, errors: result.errors }, 400);
  }

  const lead = {
    ...result.data,
    source: 'ig-audit',
    ip: ip || null,
    created_at: new Date().toISOString(),
  };

  // Simpan ke Notion (penyimpanan utama) + notifikasi tim (email/slack/webhook).
  const [saved, notified] = await Promise.all([
    saveLeadToNotion(env, lead),
    notifyTeam(env, lead).catch(() => []),
  ]);

  const storedOk = saved && saved.ok;
  const notifiedOk = Array.isArray(notified) && notified.some((n) => n && n.ok);

  // Jangan sampai lead hilang diam-diam: bila penyimpanan DAN notifikasi sama-sama
  // gagal, kembalikan 502 supaya client menampilkan error dan user bisa mencoba lagi.
  if (!storedOk && !notifiedOk) {
    console.error('audit-lead: gagal simpan & notifikasi', { saved, notified });
    return json(
      { ok: false, errors: { _: 'Terjadi kendala di server. Coba lagi sebentar lagi.' } },
      502,
    );
  }

  if (!storedOk) {
    // Tersimpan via notifikasi (email) tapi Notion gagal -> catat untuk ditindaklanjuti.
    console.warn('audit-lead: Notion gagal, lead terkirim via notifikasi', saved);
  }

  return json({ ok: true });
}
