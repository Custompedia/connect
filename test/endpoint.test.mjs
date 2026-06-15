// Uji alur endpoint POST /api/audit-lead tanpa wrangler/jaringan.
// Mengimpor Function asli, lalu menstub global fetch untuk jalur sukses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/audit-lead.js';

function makeRequest(body, headers = {}) {
  return new Request('https://x/api/audit-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const validBody = {
  ig_username: '@kopikenangan',
  bidang: 'F&B',
  whatsapp: '081234567890',
  challenge: 'Engagement turun.',
  consent: true,
  company_url: '',
};

async function call(body, env = {}, headers) {
  const res = await onRequestPost({ request: makeRequest(body, headers), env });
  const data = await res.json();
  return { status: res.status, data };
}

test('honeypot terisi -> 200 diam-diam (tanpa simpan/kirim)', async () => {
  const r = await call({ ...validBody, company_url: 'http://bot' });
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('field invalid -> 400 dengan errors per-field', async () => {
  const r = await call({ ...validBody, ig_username: '', consent: false });
  assert.equal(r.status, 400);
  assert.equal(r.data.ok, false);
  assert.ok(r.data.errors.ig_username);
  assert.ok(r.data.errors.consent);
});

test('rate limit terlampaui -> 429', async () => {
  const blockedKv = {
    get: async () =>
      JSON.stringify({ count: 5, reset: Math.floor(Date.now() / 1000) + 3600 }),
    put: async () => {},
  };
  const r = await call(validBody, { RATE_LIMIT: blockedKv });
  assert.equal(r.status, 429);
  assert.equal(r.data.ok, false);
});

test('valid tanpa konfigurasi simpan/notif -> 502 (lead tidak dianggap sukses)', async () => {
  const r = await call(validBody, {});
  assert.equal(r.status, 502);
  assert.equal(r.data.ok, false);
});

test('valid + Notion & email (fetch distub) -> 200', async () => {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push(String(url));
    return new Response(JSON.stringify({ id: 'page_123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  try {
    const env = {
      NOTION_TOKEN: 't',
      NOTION_AUDIT_DB_ID: 'db',
      RESEND_API_KEY: 'k',
      LEADS_NOTIFY_EMAIL: 'tim@custompedia.id',
    };
    const r = await call(validBody, env);
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.ok(calls.some((u) => u.includes('api.notion.com')), 'memanggil Notion');
    assert.ok(calls.some((u) => u.includes('api.resend.com')), 'memanggil Resend');
  } finally {
    globalThis.fetch = orig;
  }
});
