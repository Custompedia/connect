// Pages Function: POST /api/audit-lead
// Hanya adapter tipis; logika sebenarnya ada di lib/audit-lead.js supaya
// bisa dipakai bareng entry-point Worker (worker/index.js).
import { handleAuditLead } from '../../lib/audit-lead.js';

export function onRequestPost(context) {
  return handleAuditLead(context.request, context.env);
}
