import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLead,
  normalizeIgUsername,
  normalizeWhatsapp,
  sanitizeText,
  BIDANG_OPTIONS,
} from '../lib/validate.js';

function validBody(overrides = {}) {
  return {
    ig_username: '@kopikenangan',
    bidang: 'F&B',
    whatsapp: '0812 3456 7890',
    challenge: 'Susah konsisten posting.',
    consent: true,
    company_url: '',
    ...overrides,
  };
}

test('lead valid lolos & data dinormalisasi', () => {
  const r = validateLead(validBody());
  assert.equal(r.ok, true);
  assert.equal(r.spam, false);
  assert.equal(r.data.ig_username, 'kopikenangan'); // "@" dibuang
  assert.equal(r.data.whatsapp, '6281234567890'); // 0 -> 62, non-digit dibuang
  assert.equal(r.data.bidang, 'F&B');
  assert.equal(r.data.consent, true);
  assert.equal(r.data.challenge, 'Susah konsisten posting.');
});

test('normalizeIgUsername membuang @ dan spasi', () => {
  assert.equal(normalizeIgUsername('  @namabisnis '), 'namabisnis');
  assert.equal(normalizeIgUsername('@@dobel'), 'dobel');
  assert.equal(normalizeIgUsername(123), '');
});

test('normalizeWhatsapp: 0 -> 62, buang tanda baca', () => {
  assert.equal(normalizeWhatsapp('0812-3456-7890'), '6281234567890');
  assert.equal(normalizeWhatsapp('+62 812 3456 7890'), '6281234567890');
  assert.equal(normalizeWhatsapp('62812'), '62812');
});

test('ig_username wajib', () => {
  const r = validateLead(validBody({ ig_username: '   ' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.ig_username);
});

test('ig_username menolak karakter ilegal', () => {
  const r = validateLead(validBody({ ig_username: 'nama bisnis!' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.ig_username);
});

test('ig_username menolak lebih dari 30 karakter', () => {
  const r = validateLead(validBody({ ig_username: 'a'.repeat(31) }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.ig_username);
});

test('bidang harus salah satu opsi', () => {
  const r = validateLead(validBody({ bidang: 'Tidak Ada' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.bidang);
  // sanity: opsi default tersedia
  assert.ok(BIDANG_OPTIONS.includes('Manufaktur'));
});

test('whatsapp terlalu pendek ditolak', () => {
  const r = validateLead(validBody({ whatsapp: '12345' }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.whatsapp);
});

test('whatsapp terlalu panjang ditolak', () => {
  const r = validateLead(validBody({ whatsapp: '0' + '1'.repeat(20) }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.whatsapp);
});

test('consent wajib true', () => {
  const r = validateLead(validBody({ consent: false }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.consent);
});

test('consent menerima string "true"/"on"', () => {
  assert.equal(validateLead(validBody({ consent: 'true' })).ok, true);
  assert.equal(validateLead(validBody({ consent: 'on' })).ok, true);
});

test('challenge opsional -> null bila kosong', () => {
  const r = validateLead(validBody({ challenge: '' }));
  assert.equal(r.ok, true);
  assert.equal(r.data.challenge, null);
});

test('challenge dipotong ke 500 karakter', () => {
  const long = 'x'.repeat(800);
  assert.equal(sanitizeText(long, 500).length, 500);
  const r = validateLead(validBody({ challenge: long }));
  assert.equal(r.data.challenge.length, 500);
});

test('honeypot terisi -> spam true', () => {
  const r = validateLead(validBody({ company_url: 'http://bot.example' }));
  assert.equal(r.spam, true);
});

test('body kosong/aneh tidak melempar error', () => {
  assert.equal(validateLead(undefined).ok, false);
  assert.equal(validateLead(null).ok, false);
  assert.equal(validateLead('bukan objek').ok, false);
});
