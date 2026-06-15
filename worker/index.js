// Entry-point Cloudflare Worker (Workers + Static Assets).
// Aset statis di `public/` disajikan otomatis oleh binding ASSETS (lihat
// wrangler.toml). Worker ini hanya menangani rute non-aset:
//   - POST /api/audit-lead  -> handler lead (lib/audit-lead.js)
//   - GET  /                -> redirect ke /audit
//   - lainnya               -> coba aset, kalau tidak ada -> 404
import { handleAuditLead } from '../lib/audit-lead.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/audit-lead') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'POST' },
        });
      }
      return handleAuditLead(request, env);
    }

    if (url.pathname === '/') {
      return Response.redirect(new URL('/audit', url).toString(), 302);
    }

    // Fallback aset (umumnya aset sudah disajikan sebelum Worker dipanggil).
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
