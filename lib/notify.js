// Notifikasi tim saat ada lead baru. Dibuat PLUGGABLE: default email (Resend),
// dan opsional Slack / webhook generik bila env-nya diisi. Mudah diganti nanti.
//
// Env yang dipakai:
//   - RESEND_API_KEY, LEADS_NOTIFY_EMAIL, LEADS_FROM_EMAIL  (email)
//   - SLACK_WEBHOOK_URL                                     (opsional)
//   - LEADS_WEBHOOK_URL                                     (opsional)

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainSummary(lead) {
  return [
    `Username IG : @${lead.ig_username}`,
    `Bidang      : ${lead.bidang}`,
    `WhatsApp    : ${lead.whatsapp} (wa.me/${lead.whatsapp})`,
    `Tantangan   : ${lead.challenge || '-'}`,
    `Persetujuan : ${lead.consent ? 'Ya' : 'Tidak'}`,
    `Sumber      : ${lead.source || 'ig-audit'}`,
    `Waktu       : ${lead.created_at}`,
  ].join('\n');
}

async function sendEmailResend(env, lead) {
  const subject = `Lead Audit baru: @${lead.ig_username}`;
  const wa = lead.whatsapp;
  const rows = [
    ['Username IG', `@${lead.ig_username}`],
    ['Bidang', lead.bidang],
    ['WhatsApp', `<a href="https://wa.me/${encodeURIComponent(wa)}">${escapeHtml(wa)}</a>`],
    ['Tantangan', lead.challenge ? escapeHtml(lead.challenge) : '-'],
    ['Sumber', lead.source || 'ig-audit'],
    ['Waktu', escapeHtml(lead.created_at)],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#6B6256;white-space:nowrap">${k}</td>` +
        `<td style="padding:6px 12px;color:#221E18">${v}</td></tr>`,
    )
    .join('');
  const html =
    `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px">` +
    `<h2 style="margin:0 0 12px">Lead Audit baru</h2>` +
    `<table style="border-collapse:collapse">${rows}</table></div>`;

  const to = String(env.LEADS_NOTIFY_EMAIL)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.LEADS_FROM_EMAIL || 'Custompedia Leads <onboarding@resend.dev>',
      to,
      subject,
      text: plainSummary(lead),
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { channel: 'email', ok: false, status: res.status, detail: detail.slice(0, 500) };
  }
  return { channel: 'email', ok: true };
}

async function sendSlack(env, lead) {
  const text =
    `*Lead Audit baru: @${lead.ig_username}*\n` +
    `Bidang: ${lead.bidang}\n` +
    `WhatsApp: ${lead.whatsapp} (https://wa.me/${lead.whatsapp})\n` +
    `Tantangan: ${lead.challenge || '-'}\n` +
    `Waktu: ${lead.created_at}`;
  const res = await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return { channel: 'slack', ok: res.ok, status: res.status };
}

async function sendWebhook(env, lead) {
  const res = await fetch(env.LEADS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  });
  return { channel: 'webhook', ok: res.ok, status: res.status };
}

// Kirim ke semua channel yang dikonfigurasi. Tiap channel dibungkus try/catch
// supaya kegagalan satu channel tidak menjatuhkan yang lain.
export async function notifyTeam(env, lead) {
  const tasks = [];
  if (env.RESEND_API_KEY && env.LEADS_NOTIFY_EMAIL) tasks.push(sendEmailResend(env, lead));
  if (env.SLACK_WEBHOOK_URL) tasks.push(sendSlack(env, lead));
  if (env.LEADS_WEBHOOK_URL) tasks.push(sendWebhook(env, lead));

  const settled = await Promise.allSettled(tasks);
  return settled.map((s) =>
    s.status === 'fulfilled' ? s.value : { ok: false, error: String(s.reason) },
  );
}
