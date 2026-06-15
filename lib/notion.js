// Simpan lead ke database Notion "Audit Leads (IG)" via REST API.
// Token & DB id diambil dari environment (JANGAN hardcode):
//   - NOTION_TOKEN        : token internal integration Notion
//   - NOTION_AUDIT_DB_ID  : id database "Audit Leads (IG)"
//
// Nama properti di bawah HARUS identik dengan skema database di Notion.

const NOTION_API = 'https://api.notion.com/v1/pages';
const NOTION_VERSION = '2022-06-28';

export async function saveLeadToNotion(env, lead) {
  const token = env.NOTION_TOKEN;
  const dbId = env.NOTION_AUDIT_DB_ID;

  // Bila belum dikonfigurasi, jangan gagal keras — biar notifikasi email tetap
  // jadi cadangan. Caller yang memutuskan apakah ini fatal.
  if (!token || !dbId) {
    return { ok: false, skipped: true, reason: 'NOTION_TOKEN/NOTION_AUDIT_DB_ID belum di-set' };
  }

  const properties = {
    Lead: { title: [{ text: { content: `@${lead.ig_username}` } }] },
    Bidang: { select: { name: lead.bidang } },
    WhatsApp: { phone_number: lead.whatsapp },
    Consent: { checkbox: Boolean(lead.consent) },
    Source: { select: { name: lead.source || 'ig-audit' } },
    Status: { select: { name: 'Baru' } },
  };

  if (lead.challenge) {
    properties.Challenge = { rich_text: [{ text: { content: lead.challenge.slice(0, 2000) } }] };
  }
  if (lead.ip) {
    properties.IP = { rich_text: [{ text: { content: String(lead.ip).slice(0, 100) } }] };
  }

  let res;
  try {
    res = await fetch(NOTION_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: dbId }, properties }),
    });
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, status: res.status, detail: detail.slice(0, 500) };
  }

  const json = await res.json().catch(() => ({}));
  return { ok: true, id: json.id };
}
