# Custompedia Connect — Landing "Audit Socmed Gratis"

Halaman publik `/audit` untuk menangkap lead dari kampanye Instagram "AUDIT".
Penonton komen "AUDIT" di Reels → dapat auto-DM (CreatorFlow, di luar repo ini)
berisi link ke halaman ini → isi form → lead masuk ke Notion + tim dapat email →
tim analisis manual → hubungi via WhatsApp.

Dibangun sebagai **Cloudflare Pages (statis) + Pages Functions (serverless)**.

## Struktur

```
public/                 # SATU-SATUNYA folder yang disajikan publik
  _redirects            #   / -> /audit
  audit/
    index.html          #   halaman /audit (mobile-first, tanpa emoji)
    styles.css          #   style terisolasi (token brand cream/gold)
    app.js              #   UX client: validasi ringan, counter, submit
functions/
  api/
    audit-lead.js       # POST /api/audit-lead (endpoint penerima lead)
lib/                    # logika server (di-bundle ke Functions, tidak disajikan publik)
  validate.js           #   validasi & normalisasi (PURE, diuji unit)
  ratelimit.js          #   rate limit per-IP (Workers KV)
  notion.js             #   simpan lead ke Notion
  notify.js             #   notifikasi tim (email Resend; Slack/webhook opsional)
  turnstile.js          #   hook anti-bot Turnstile (opsional)
test/
  validate.test.mjs     # unit test validasi (node --test, tanpa dependensi)
wrangler.toml           # konfigurasi Pages + binding KV
.dev.vars.example       # contoh environment variables (salin ke .dev.vars)
```

## Menjalankan lokal

Prasyarat: Node 18+.

```bash
npm install                 # pasang wrangler (untuk dev/deploy)
cp .dev.vars.example .dev.vars   # lalu isi nilainya
npm run dev                 # wrangler pages dev -> buka http://localhost:8788/audit
```

Catatan dev:
- Tanpa `.dev.vars` halaman tetap jalan, tapi submission tidak tersimpan/terkirim
  (Notion & email dilewati). Validasi, honeypot, dan rate limit tetap aktif.
- KV rate limit disimulasikan lokal oleh wrangler.

## Test

```bash
npm test
```

Menguji semua aturan validasi & normalisasi (§6): username IG, normalisasi
WhatsApp `0`→`62`, batas panjang, consent wajib, honeypot, potong challenge 500.

## Environment variables

Semua secret lewat env (tidak ada yang hardcode). Lokal: `.dev.vars`.
Produksi: Cloudflare Pages → Settings → Environment variables (Encrypt).

| Variable | Wajib | Keterangan |
|---|---|---|
| `NOTION_TOKEN` | ya* | Token internal integration Notion |
| `NOTION_AUDIT_DB_ID` | ya* | ID database "Audit Leads (IG)" |
| `RESEND_API_KEY` | ya* | API key Resend untuk email notifikasi |
| `LEADS_NOTIFY_EMAIL` | ya* | Tujuan email lead (boleh dipisah koma) |
| `LEADS_FROM_EMAIL` | tidak | Alamat pengirim (default `onboarding@resend.dev`) |
| `SLACK_WEBHOOK_URL` | tidak | Aktifkan notifikasi Slack |
| `LEADS_WEBHOOK_URL` | tidak | Kirim lead mentah (JSON) ke endpoint lain |
| `TURNSTILE_SITE_KEY` | tidak | Aktifkan widget Turnstile di form |
| `TURNSTILE_SECRET` | tidak | Aktifkan verifikasi Turnstile di server |
| `RATE_LIMIT_MAX` | tidak | Maks submission/IP/jam (default 5) |

\* Minimal salah satu jalur "simpan" (Notion) **atau** "notifikasi" (email) harus
aktif. Bila keduanya gagal saat submit, endpoint balas `502` supaya lead tidak
hilang diam-diam.

Binding non-secret: **KV namespace `RATE_LIMIT`** (lihat `wrangler.toml`).

## Setup Notion (penyimpanan lead)

1. Buat **internal integration**: https://www.notion.so/my-integrations →
   salin token → isi `NOTION_TOKEN`.
2. Buka database **"Audit Leads (IG)"** → menu `...` → **Connections** →
   tambahkan integration tadi (wajib, agar API boleh menulis).
3. Salin **Database ID** dari URL database → isi `NOTION_AUDIT_DB_ID`.

Skema database (nama properti harus persis seperti ini — dipakai `lib/notion.js`):

| Properti | Tipe | Catatan |
|---|---|---|
| `Lead` | Title | berisi `@username` |
| `Bidang` | Select | F&B, Fashion & Retail, Jasa & Profesional, Retail & E-commerce, Manufaktur, Lainnya |
| `WhatsApp` | Phone | sudah dinormalisasi (62...) |
| `Challenge` | Text | opsional |
| `Consent` | Checkbox | |
| `Source` | Select | default `ig-audit` |
| `Status` | Select | Baru / Diproses / Dihubungi / Selesai (untuk triase tim) |
| `IP` | Text | opsional (rate-limit/forensik; pertimbangan privasi) |
| `Created` | Created time | otomatis |

## Deploy ke Cloudflare Pages

1. Buat KV namespace dan tempel id-nya ke `wrangler.toml`:
   ```bash
   npx wrangler kv namespace create RATE_LIMIT
   ```
2. Hubungkan repo ke Cloudflare Pages, atau deploy manual:
   ```bash
   npm run deploy
   ```
   Build command: *(kosong)*. Output directory: `public`.
3. Set semua environment variables (tabel di atas) di dashboard Pages.
4. Pastikan binding KV `RATE_LIMIT` terpasang di Settings → Functions → KV.

## Integrasi ke portal.custompedia.id

Lead disimpan di database Notion "Audit Leads (IG)" sebagai sumber data tunggal.
Untuk menampilkannya di dashboard `portal.custompedia.id`, portal cukup membaca
database tersebut (via Notion API). Alternatif: set `LEADS_WEBHOOK_URL` ke
endpoint intake portal — setiap lead valid juga akan di-`POST` (JSON) ke sana.

## Anti-spam & privasi

- **Honeypot** `company_url` (tersembunyi) → bila terisi, balas `200` diam-diam,
  tidak disimpan.
- **Rate limit** per-IP via KV (default 5/jam).
- **Turnstile** (opsional) — aktifkan dengan mengisi `TURNSTILE_*` dan menambah
  widget di form.
- IP pengirim disimpan opsional untuk rate-limit/forensik. Tinjau kebutuhan
  privasi sebelum menyimpan jangka panjang.

## Di luar scope (sesuai spec)

Tanpa login, tanpa verifikasi follow, tanpa analisis otomatis/AI, tanpa
pembayaran. Sisi auto-DM (komen "AUDIT" → kirim link) dikonfigurasi di
CreatorFlow, terpisah dari repo ini.
