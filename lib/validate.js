// Validasi & normalisasi lead "Audit Socmed Gratis".
// Modul ini sengaja PURE (tanpa dependensi Cloudflare/Notion) supaya bisa
// diuji langsung dengan `node --test`. Lihat test/validate.test.mjs.

// Opsi bidang usaha (harus identik dengan opsi di form & di Notion DB).
export const BIDANG_OPTIONS = [
  'F&B',
  'Fashion & Retail',
  'Jasa & Profesional',
  'Retail & E-commerce',
  'Manufaktur',
  'Lainnya',
];

// Username IG: huruf, angka, titik, garis bawah. Maksimal 30 karakter.
const IG_USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;

// Buang "@" di depan dan spasi. Tidak mengubah huruf besar/kecil.
export function normalizeIgUsername(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^@+/, '').trim();
}

// Normalisasi nomor WhatsApp: buang semua non-digit, lalu awalan lokal 0 -> 62.
export function normalizeWhatsapp(raw) {
  if (typeof raw !== 'string') return '';
  let digits = raw.replace(/\D+/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  return digits;
}

// Sanitasi teks bebas: buang karakter kontrol (C0 + DEL) tapi pertahankan
// tab/newline/carriage-return, lalu trim & potong ke maxLen.
export function sanitizeText(raw, maxLen) {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const ch of raw) {
    const c = ch.codePointAt(0);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) continue;
    out += ch;
  }
  out = out.trim();
  if (typeof maxLen === 'number' && out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

// Anggap consent true untuk beberapa bentuk yang mungkin dikirim client.
function isConsentTrue(v) {
  return v === true || v === 'true' || v === 'on' || v === 1 || v === '1';
}

// Validasi penuh di server. Mengembalikan { ok, spam, errors, data }.
// - spam: honeypot terisi -> caller balas 200 diam-diam, JANGAN simpan.
// - errors: pesan per-field (Bahasa Indonesia) untuk respons 400.
// - data: nilai bersih siap simpan (hanya valid bila ok === true).
export function validateLead(body) {
  const errors = {};
  const data = {};
  const src = body && typeof body === 'object' ? body : {};

  // Honeypot anti-bot: field tersembunyi `company_url` harus tetap kosong.
  const honeypot = typeof src.company_url === 'string' ? src.company_url.trim() : '';
  const spam = honeypot.length > 0;

  // ig_username
  const ig = normalizeIgUsername(src.ig_username);
  if (!ig) {
    errors.ig_username = 'Username Instagram wajib diisi.';
  } else if (!IG_USERNAME_RE.test(ig)) {
    errors.ig_username =
      'Username hanya boleh huruf, angka, titik, dan garis bawah (maksimal 30 karakter).';
  } else {
    data.ig_username = ig;
  }

  // bidang
  const bidang = typeof src.bidang === 'string' ? src.bidang.trim() : '';
  if (!bidang) {
    errors.bidang = 'Bidang usaha wajib dipilih.';
  } else if (!BIDANG_OPTIONS.includes(bidang)) {
    errors.bidang = 'Bidang usaha tidak valid.';
  } else {
    data.bidang = bidang;
  }

  // whatsapp
  const wa = normalizeWhatsapp(src.whatsapp);
  if (!wa) {
    errors.whatsapp = 'Nomor WhatsApp wajib diisi.';
  } else if (wa.length < 8 || wa.length > 15) {
    errors.whatsapp = 'Nomor WhatsApp harus 8-15 digit.';
  } else {
    data.whatsapp = wa;
  }

  // challenge (opsional, maksimal 500 karakter)
  const challenge = sanitizeText(src.challenge ?? '', 500);
  data.challenge = challenge.length ? challenge : null;

  // consent (wajib true)
  if (!isConsentTrue(src.consent)) {
    errors.consent = 'Persetujuan wajib dicentang.';
  } else {
    data.consent = true;
  }

  return { ok: Object.keys(errors).length === 0, spam, errors, data };
}
