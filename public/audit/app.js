// UX client untuk form /audit. Validasi di sini hanya untuk pengalaman pengguna;
// validasi yang dipercaya tetap di server (functions/api/audit-lead.js).
(function () {
  'use strict';

  var ENDPOINT = '/api/audit-lead';
  var BIDANG_OPTIONS = [
    'F&B',
    'Fashion & Retail',
    'Jasa & Profesional',
    'Retail & E-commerce',
    'Manufaktur',
    'Lainnya',
  ];
  var IG_RE = /^[A-Za-z0-9._]{1,30}$/;

  var form = document.getElementById('audit-form');
  if (!form) return;

  var els = {
    formCard: document.getElementById('form-card'),
    success: document.getElementById('success-panel'),
    submitBtn: document.getElementById('submit-btn'),
    errorTop: document.getElementById('form-error-top'),
    ig: document.getElementById('ig_username'),
    bidang: document.getElementById('bidang'),
    wa: document.getElementById('whatsapp'),
    challenge: document.getElementById('challenge'),
    consent: document.getElementById('consent'),
    company_url: document.getElementById('company_url'),
    count: document.getElementById('count-challenge'),
  };

  // Peta field -> elemen pesan error & wrapper, agar gampang set/clear.
  var FIELDS = {
    ig_username: { wrap: 'field-ig', msg: 'err-ig' },
    bidang: { wrap: 'field-bidang', msg: 'err-bidang' },
    whatsapp: { wrap: 'field-wa', msg: 'err-wa' },
    consent: { wrap: 'field-consent', msg: 'err-consent' },
  };

  function setError(field, message) {
    var cfg = FIELDS[field];
    if (!cfg) return;
    var wrap = document.getElementById(cfg.wrap);
    var msg = document.getElementById(cfg.msg);
    if (wrap) wrap.classList.add('has-error');
    if (msg) msg.textContent = message;
  }

  function clearErrors() {
    Object.keys(FIELDS).forEach(function (field) {
      var cfg = FIELDS[field];
      var wrap = document.getElementById(cfg.wrap);
      var msg = document.getElementById(cfg.msg);
      if (wrap) wrap.classList.remove('has-error');
      if (msg) msg.textContent = '';
    });
    els.errorTop.classList.remove('show');
    els.errorTop.textContent = '';
  }

  function normalizeIg(v) {
    return (v || '').trim().replace(/^@+/, '').trim();
  }

  function normalizeWa(v) {
    var digits = (v || '').replace(/\D+/g, '');
    if (digits.indexOf('0') === 0) digits = '62' + digits.slice(1);
    return digits;
  }

  // Counter karakter untuk textarea challenge.
  function updateCount() {
    if (!els.challenge || !els.count) return;
    els.count.textContent = els.challenge.value.length + '/500';
  }
  if (els.challenge) {
    els.challenge.addEventListener('input', updateCount);
    updateCount();
  }

  // Saring input WhatsApp ke angka & "+" saja (tampilan), normalisasi saat submit.
  if (els.wa) {
    els.wa.addEventListener('input', function () {
      var cleaned = els.wa.value.replace(/[^\d+\s-]/g, '');
      if (cleaned !== els.wa.value) els.wa.value = cleaned;
    });
  }

  // Validasi sisi-client (mirror server, untuk feedback cepat).
  function validateClient() {
    var errors = {};

    var ig = normalizeIg(els.ig.value);
    if (!ig) errors.ig_username = 'Username Instagram wajib diisi.';
    else if (!IG_RE.test(ig))
      errors.ig_username =
        'Username hanya boleh huruf, angka, titik, dan garis bawah (maksimal 30 karakter).';

    var bidang = els.bidang.value.trim();
    if (!bidang) errors.bidang = 'Bidang usaha wajib dipilih.';
    else if (BIDANG_OPTIONS.indexOf(bidang) === -1) errors.bidang = 'Bidang usaha tidak valid.';

    var wa = normalizeWa(els.wa.value);
    if (!wa) errors.whatsapp = 'Nomor WhatsApp wajib diisi.';
    else if (wa.length < 8 || wa.length > 15) errors.whatsapp = 'Nomor WhatsApp harus 8-15 digit.';

    if (!els.consent.checked) errors.consent = 'Persetujuan wajib dicentang.';

    return errors;
  }

  function showServerErrors(errors) {
    var handled = false;
    Object.keys(errors || {}).forEach(function (field) {
      if (FIELDS[field]) {
        setError(field, errors[field]);
        handled = true;
      }
    });
    // Error umum / field yang tak punya slot khusus.
    if (errors && errors._) {
      els.errorTop.textContent = errors._;
      els.errorTop.classList.add('show');
      handled = true;
    }
    if (!handled) {
      els.errorTop.textContent = 'Ada yang salah dengan data yang dikirim. Periksa lagi, ya.';
      els.errorTop.classList.add('show');
    }
  }

  function focusFirstError() {
    var first = form.querySelector('.has-error input, .has-error select, .has-error textarea');
    if (first && typeof first.focus === 'function') first.focus();
  }

  function showSuccess() {
    els.formCard.hidden = true;
    els.success.hidden = false;
    els.success.focus();
    if (window.scrollTo) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setSubmitting(on) {
    els.submitBtn.disabled = on;
    els.submitBtn.textContent = on ? 'Mengirim...' : 'Minta analisis gratis';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();

    var clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      showServerErrors(clientErrors);
      focusFirstError();
      return;
    }

    var payload = {
      ig_username: normalizeIg(els.ig.value),
      bidang: els.bidang.value.trim(),
      whatsapp: normalizeWa(els.wa.value),
      challenge: els.challenge.value.trim() || null,
      consent: els.consent.checked,
      company_url: els.company_url ? els.company_url.value : '',
    };

    setSubmitting(true);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { status: res.status, data: data };
          });
      })
      .then(function (r) {
        if (r.status === 200 && r.data && r.data.ok) {
          showSuccess();
          return;
        }
        if (r.status === 429) {
          showServerErrors({ _: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' });
        } else if (r.data && r.data.errors) {
          showServerErrors(r.data.errors);
          focusFirstError();
        } else {
          showServerErrors({ _: 'Terjadi kendala. Coba lagi sebentar lagi.' });
        }
        setSubmitting(false);
      })
      .catch(function () {
        showServerErrors({ _: 'Gagal terhubung. Periksa koneksi internet lalu coba lagi.' });
        setSubmitting(false);
      });
  });
})();
