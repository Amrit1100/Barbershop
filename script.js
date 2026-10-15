(function () {
  var $ = function (s) { return document.querySelector(s); };
  var modal = $('#booking-modal'), opener = null;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var sel = { date: null, time: null };

  function fmtTime(m) {
    var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'pm' : 'am';
    return ((h + 11) % 12 + 1) + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  function fmtDate(d) {
    return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function renderCal() {
    $('#cal-title').textContent = view.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
    $('#cal-prev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
    var g = $('#cal-grid'); g.innerHTML = '';
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(function (d) {
      var s = document.createElement('span'); s.className = 'dow'; s.textContent = d; g.appendChild(s);
    });
    for (var i = 0; i < view.getDay(); i++) g.appendChild(document.createElement('span'));
    var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (var n = 1; n <= days; n++) {
      var d = new Date(view.getFullYear(), view.getMonth(), n);
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cal-day' + (+d === +today ? ' today' : '');
      b.textContent = n; b.disabled = d < today;
      b.setAttribute('aria-label', fmtDate(d));
      b.setAttribute('aria-pressed', sel.date && +sel.date === +d ? 'true' : 'false');
      b.addEventListener('click', pickDate.bind(null, d));
      g.appendChild(b);
    }
  }

  function pickDate(d) {
    sel.date = d; sel.time = null; clearErr('date'); renderCal(); renderSlots();
  }

  var slotReq = 0, lastSlots = [];

  function drawSlots() {
    var box = $('#slots'); box.innerHTML = '';
    if (!lastSlots.length) {
      box.innerHTML = '<p class="hint">No times left on this day. Please pick another date.</p>'; return;
    }
    lastSlots.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'slot'; b.textContent = s.label;
      b.setAttribute('aria-pressed', sel.time === s.time ? 'true' : 'false');
      b.addEventListener('click', function () { sel.time = s.time; clearErr('time'); drawSlots(); });
      box.appendChild(b);
    });
  }

  // Asks the server which slots are free on the chosen day and shows only those.
  function renderSlots() {
    var box = $('#slots');
    if (!sel.date) { box.innerHTML = '<p class="hint">Pick a date to see open times.</p>'; return; }
    $('#slots-label').textContent = 'Available times on ' + fmtDate(sel.date);
    box.innerHTML = '<p class="hint">Checking availability...</p>';
    var req = ++slotReq;
    fetch('/api/availability?date=' + toISO(sel.date))
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error); return d; }); })
      .then(function (d) { if (req === slotReq) { lastSlots = d.slots; drawSlots(); } })
      .catch(function () {
        if (req === slotReq) box.innerHTML = '<p class="hint">Could not load times. Check your connection and pick the date again.</p>';
      });
  }

  function setErr(k, msg) {
    var e = $('#e-' + k); e.textContent = msg;
    var i = $('#b-' + k); if (i) i.classList.add('invalid');
  }
  function clearErr(k) {
    var e = $('#e-' + k); if (e) e.textContent = '';
    var i = $('#b-' + k); if (i) i.classList.remove('invalid');
  }

  function openModal(btn) {
    opener = btn; sel = { date: null, time: null };
    ['b-name', 'b-email', 'b-phone'].forEach(function (id) { $('#' + id).value = ''; });
    document.querySelectorAll('input[name="pay"]').forEach(function (r) { r.checked = false; });
    ['name', 'email', 'phone', 'date', 'time', 'pay'].forEach(clearErr);
    $('#pay-note').textContent = ''; $('#slots-label').textContent = 'Available times';
    $('#booking-body').hidden = false; $('#booking-done').hidden = true;
    renderCal(); renderSlots();
    modal.hidden = false; document.body.classList.add('modal-open');
    $('#b-name').focus();
  }
  function closeModal() {
    modal.hidden = true; document.body.classList.remove('modal-open');
    if (opener) opener.focus();
  }

  function confirmBooking() {
    var name = $('#b-name').value.trim(), email = $('#b-email').value.trim(), phone = $('#b-phone').value.trim();
    var pay = document.querySelector('input[name="pay"]:checked'), ok = true, first = null;
    ['name', 'email', 'phone', 'date', 'time', 'pay'].forEach(clearErr);
    function bad(k, msg) { setErr(k, msg); ok = false; if (!first) first = $('#e-' + k); }
    if (!name) bad('name', 'Enter your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad('email', 'Enter a valid email, like alex@example.com.');
    if (phone.replace(/\D/g, '').length < 10) bad('phone', 'Enter a phone number with at least 10 digits.');
    if (!sel.date) bad('date', 'Choose a date.');
    else if (sel.time === null) bad('time', 'Choose a time.');
    if (!pay) bad('pay', 'Choose a payment option.');
    if (!ok) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }

    var btn = $('#confirm-btn'); btn.disabled = true; btn.textContent = 'Booking...';
    fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, email: email, phone: phone, date: toISO(sel.date), time: sel.time, payment: pay.value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (res) {
        if (!res.ok) {
          if (res.status === 409 || res.status === 400) { sel.time = null; setErr('time', res.d.error); renderSlots(); }
          else $('#e-pay').textContent = res.d.error;
          return;
        }
        $('#done-text').textContent = 'Thanks, ' + name.split(' ')[0] + '. We have you down for ' + res.d.when +
          '. Payment: ' + pay.value.toLowerCase() + '. A confirmation email is on its way to ' + email + '.';
        $('#booking-body').hidden = true; $('#booking-done').hidden = false;
        modal.querySelector('.modal-panel').scrollTop = 0;
      })
      .catch(function () { $('#e-pay').textContent = 'Could not reach the server. Please try again.'; })
      .then(function () { btn.disabled = false; btn.textContent = 'Confirm booking'; });
  }

  document.querySelectorAll('[data-open-booking]').forEach(function (b) {
    b.addEventListener('click', function () { openModal(b); });
  });
  modal.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModal(); });
  $('#cal-prev').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); });
  $('#cal-next').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); });
  $('#confirm-btn').addEventListener('click', confirmBooking);
  ['name', 'email', 'phone'].forEach(function (k) { $('#b-' + k).addEventListener('input', function () { clearErr(k); }); });
  document.querySelectorAll('input[name="pay"]').forEach(function (r) {
    r.addEventListener('change', function () {
      clearErr('pay');
      $('#pay-note').textContent = r.value === 'Pay in person'
        ? 'Pay at the shop after your service. Cash or card.'
        : 'We\'ll email you a secure payment link to complete payment.';
    });
  });

  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key !== 'Tab') return;
    var f = [].filter.call(modal.querySelectorAll('button, input, [href]'), function (el) {
      return !el.disabled && el.offsetParent !== null && el.type !== 'radio' || el.type === 'radio' && el.checked;
    });
    if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });
})();
