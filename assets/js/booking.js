/* ============================================================
   BOOKING
   ------------------------------------------------------------
   Four steps: service, date, time, details. The frontend's job is to
   be pleasant and never to be trusted — every rule it applies is
   applied again inside Postgres, and the success panel is only shown
   once the backend has returned a reference.

   NO SDK. The three RPCs are plain POSTs to PostgREST, which keeps
   roughly 150 KB of client library out of the page for what amounts
   to three JSON calls.

   WHEN NOT CONFIGURED
   With no Supabase URL and key in config.js, the panel runs in preview
   mode: the grid is computed locally so the design can be reviewed,
   every slot is labelled as a preview, and the submit button is
   disabled with an explanation. It never accepts a booking it cannot
   store, and it never shows a confirmation it has not earned.
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = window.SALON_CONFIG;
  var CATALOGUE = window.SALON_CATALOGUE;
  var AV = window.SalonAvailability;
  var UI = window.SalonUI || { toast: function () {}, announce: function () {} };

  if (!CONFIG || !CATALOGUE || !AV) return;

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var LIVE = CONFIG.bookingIsLive();

  /* ---------- state ---------- */
  var state = {
    service: null,     // catalogue entry, with duration from the server when live
    date: null,        // 'YYYY-MM-DD'
    time: null,        // 'HH:MM'
    calYear: 0,
    calMonth: 0,       // 0-11
    submitting: false,
    runtime: null,     // server truth: settings, hours, services, resourceCounts
    slotsToken: 0      // guards against a slow response overwriting a newer one
  };

  var els = {
    panel:    $('#bookingPanel'),
    status:   $('#bookingStatus'),
    form:     $('#bookingForm'),
    picker:   $('#svcPicker'),
    step1:    $('#step1'), step2: $('#step2'), step3: $('#step3'), step4: $('#step4'),
    hint1:    $('#step1Hint'), hint2: $('#step2Hint'), hint3: $('#step3Hint'),
    calMonth: $('#calMonth'), calDays: $('#calDays'), calWeekdays: $('#calWeekdays'),
    calPrev:  $('#calPrev'), calNext: $('#calNext'),
    slotGrid: $('#slotGrid'), slotLegend: $('#slotLegend'),
    submit:   $('#bkSubmit'), submitLabel: $('#bkSubmitLabel'), terms: $('#bkTerms'),
    ok:       $('#bookingOk'), okNote: $('#bookingOkNote'),
    ref:      $('#bookingRef'), summary: $('#bookingSummary'),
    again:    $('#bookingAgain')
  };

  if (!els.form || !els.picker) return;

  /* ============================================================
     RPC
     ============================================================ */
  function rpc(fn, args) {
    var base = CONFIG.get('supabase.url');
    var key = CONFIG.get('supabase.anonKey');
    return fetch(base.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(args || {})
    }).then(function (res) {
      return res.text().then(function (body) {
        var data = null;
        try { data = body ? JSON.parse(body) : null; } catch (e) { data = null; }
        if (!res.ok) {
          var err = new Error((data && (data.message || data.hint)) || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          err.payload = data;
          throw err;
        }
        return data;
      });
    });
  }

  /* ============================================================
     SETUP NOTICE
     ============================================================ */
  function notice(kind, title, html) {
    if (!els.status) return;
    var box = document.createElement('div');
    box.className = 'notice notice-' + kind;
    var icon = document.createElement('span');
    icon.className = 'notice-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind === 'error' ? '!' : 'i';
    var body = document.createElement('div');
    var h = document.createElement('h3');
    h.textContent = title;
    var p = document.createElement('p');
    p.innerHTML = html; // only ever called with literals defined in this file
    body.appendChild(h);
    body.appendChild(p);
    box.appendChild(icon);
    box.appendChild(body);
    els.status.appendChild(box);
  }

  function enterPreviewMode(reason) {
    LIVE = false;
    if (els.submit) {
      els.submit.disabled = true;
      els.submit.setAttribute('aria-disabled', 'true');
    }
    if (els.submitLabel) els.submitLabel.textContent = 'Online booking not available yet';
    if (els.terms) {
      els.terms.textContent =
        'This form cannot take a booking until the salon connects its booking database. ' +
        'Please book on Instagram or by phone in the meantime.';
    }
    notice('warn', 'Preview mode — this form is not taking bookings',
      reason + ' The times below are a <strong>preview</strong> generated in your browser, ' +
      'not real availability. Setup instructions are in <code>README.md</code>.');
  }

  /* ============================================================
     SERVICE PICKER
     ============================================================ */
  function serviceDuration(service) {
    // Server truth wins when we have it, so the grid can never offer a
    // length the backend will refuse.
    if (state.runtime && state.runtime.services) {
      for (var i = 0; i < state.runtime.services.length; i++) {
        if (state.runtime.services[i].id === service.id) return state.runtime.services[i];
      }
      return null; // not bookable online
    }
    // Offline preview: honour the catalogue's own flag, so the picker
    // never offers something the backend would reject.
    return service.bookable === false ? null : service;
  }

  function renderCategories() {
    els.picker.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'svc-cats';

    CATALOGUE.categories.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'svc-cat';
      var b = document.createElement('b');
      b.textContent = cat.name;
      var i = document.createElement('i');
      i.setAttribute('aria-hidden', 'true');
      i.textContent = '→';
      btn.appendChild(b);
      btn.appendChild(i);
      btn.setAttribute('aria-label', cat.name + ', show treatments');
      btn.addEventListener('click', function () { renderServiceList(cat); });
      grid.appendChild(btn);
    });

    els.picker.appendChild(grid);
    if (els.hint1) els.hint1.textContent = 'Choose a category';
  }

  function renderServiceList(cat) {
    els.picker.innerHTML = '';

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'svc-back';
    back.innerHTML = '← <span>All categories</span>';
    back.addEventListener('click', renderCategories);
    els.picker.appendChild(back);

    var list = document.createElement('div');
    list.className = 'svc-list';
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', cat.name + ' treatments');

    CATALOGUE.inCategory(cat.id).forEach(function (service) {
      var server = serviceDuration(service);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'svc-option';
      btn.setAttribute('aria-pressed', 'false');

      var name = document.createElement('span');
      name.textContent = service.name;
      btn.appendChild(name);

      var meta = document.createElement('span');
      meta.className = 'svc-option-meta';
      if (!server) {
        meta.textContent = 'In salon only';
        btn.disabled = true;
        btn.setAttribute('aria-label', service.name + ' — not bookable online, please call the salon');
        if (service.note) btn.title = service.note;
      } else if (service.price) {
        meta.textContent = service.price;
      } else {
        // Durations are provisional until the owner confirms them, so
        // they are labelled rather than presented as published timings.
        var mins = server.duration;
        meta.textContent = (CATALOGUE.durationsConfirmed ? '' : 'approx. ') + mins + ' min';
      }
      btn.appendChild(meta);

      if (server) {
        btn.addEventListener('click', function () {
          $$('.svc-option', list).forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
          btn.setAttribute('aria-pressed', 'true');
          chooseService(service, server, cat);
        });
      }
      list.appendChild(btn);
    });

    els.picker.appendChild(list);
    if (els.hint1) els.hint1.textContent = cat.name;
  }

  function chooseService(service, server, cat) {
    state.service = {
      id: service.id,
      name: service.name,
      category: cat.name,
      duration: server.duration,
      buffer: typeof server.buffer === 'number' ? server.buffer : CATALOGUE.blockMinutes(service) - service.duration,
      resource: server.resource || service.resource,
      price: service.price || null
    };
    state.time = null;

    // Collapse the picker to a single confirmed line with a way back.
    els.picker.innerHTML = '';
    var chosen = document.createElement('div');
    chosen.className = 'svc-chosen';
    var left = document.createElement('div');
    var strong = document.createElement('strong');
    strong.textContent = service.name;
    left.appendChild(strong);
    var sub = document.createElement('span');
    sub.className = 'svc-option-meta';
    sub.style.marginLeft = '0.5rem';
    sub.textContent = cat.name + ' · ' +
      (CATALOGUE.durationsConfirmed ? '' : 'approx. ') + state.service.duration + ' min';
    left.appendChild(sub);
    chosen.appendChild(left);

    var change = document.createElement('button');
    change.type = 'button';
    change.className = 'link';
    change.textContent = 'Change';
    change.addEventListener('click', function () {
      state.service = null; state.time = null;
      setStep(els.step1, 'active'); setStep(els.step2, 'locked'); setStep(els.step3, 'locked');
      setStep(els.step4, 'locked');
      if (els.hint2) els.hint2.textContent = 'Pick a service first';
      if (els.hint3) els.hint3.textContent = 'Pick a date first';
      els.slotGrid.innerHTML = '';
      if (els.slotLegend) els.slotLegend.hidden = true;
      renderCategories();
    });
    chosen.appendChild(change);
    els.picker.appendChild(chosen);

    setStep(els.step1, 'done');
    setStep(els.step2, 'active');
    if (els.hint2) els.hint2.textContent = 'Choose a day';
    UI.announce(service.name + ' selected. Now choose a date.');

    // A date already chosen stays chosen, but its slots are stale the
    // moment the service length changes.
    if (state.date) loadSlots();
    renderCalendar();
    focusStep(els.step2);
  }

  /* ============================================================
     STEPS
     ============================================================ */
  function setStep(step, value) {
    if (!step) return;
    step.setAttribute('data-state', value);
    var body = step.querySelector('.step-body');
    if (!body) return;
    // Locked steps must not be reachable by keyboard.
    $$('button, input, textarea, a', body).forEach(function (el) {
      if (value === 'locked') { el.setAttribute('tabindex', '-1'); }
      else { el.removeAttribute('tabindex'); }
    });
  }

  function focusStep(step) {
    if (!step) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    step.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  /* ============================================================
     CALENDAR
     ============================================================ */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function salonNow() {
    var tz = (state.runtime && state.runtime.settings && state.runtime.settings.timeZone) ||
             CONFIG.get('scheduling.timeZone', 'Asia/Kolkata');
    return AV.salonNow(tz);
  }

  function hoursFor(dateStr) {
    var weekday = AV.weekdayMondayFirst(dateStr);
    if (state.runtime && state.runtime.hours) {
      var fromServer = state.runtime.hours[String(weekday)];
      // An explicit null from the server means closed that weekday.
      return fromServer ? { open: fromServer.open, close: fromServer.close, provisional: false } : null;
    }
    return CONFIG.hoursFor(weekday);
  }

  function horizonDays() {
    return (state.runtime && state.runtime.settings && state.runtime.settings.horizonDays) ||
           CONFIG.get('scheduling.horizonDays', 45);
  }

  function initCalendar() {
    var now = salonNow();
    var parts = now.date.split('-');
    state.calYear = +parts[0];
    state.calMonth = +parts[1] - 1;

    els.calWeekdays.innerHTML = '';
    WEEKDAYS.forEach(function (d) {
      var cell = document.createElement('div');
      cell.className = 'cal-wd';
      cell.textContent = d;
      els.calWeekdays.appendChild(cell);
    });

    els.calPrev.addEventListener('click', function () { shiftMonth(-1); });
    els.calNext.addEventListener('click', function () { shiftMonth(1); });
    renderCalendar();
  }

  function shiftMonth(delta) {
    state.calMonth += delta;
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
    renderCalendar();
    els.calMonth.focus && els.calMonth.focus();
  }

  function renderCalendar() {
    var now = salonNow();
    var nowParts = now.date.split('-');
    var thisY = +nowParts[0], thisM = +nowParts[1] - 1;
    var horizon = AV.addDays(now.date, horizonDays());

    els.calMonth.textContent = MONTHS[state.calMonth] + ' ' + state.calYear;
    els.calPrev.disabled = (state.calYear === thisY && state.calMonth === thisM) ||
                           (state.calYear < thisY);
    // Do not let the visitor wander months past the booking horizon.
    var horizonParts = horizon.split('-');
    els.calNext.disabled = state.calYear > +horizonParts[0] ||
      (state.calYear === +horizonParts[0] && state.calMonth >= +horizonParts[1] - 1);

    els.calDays.innerHTML = '';

    var firstDow = new Date(Date.UTC(state.calYear, state.calMonth, 1)).getUTCDay();
    firstDow = (firstDow + 6) % 7; // Monday-first
    var daysInMonth = new Date(Date.UTC(state.calYear, state.calMonth + 1, 0)).getUTCDate();

    for (var pad = 0; pad < firstDow; pad++) {
      var empty = document.createElement('div');
      empty.className = 'cal-empty';
      els.calDays.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = state.calYear + '-' +
        String(state.calMonth + 1).padStart(2, '0') + '-' +
        String(d).padStart(2, '0');

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.textContent = String(d);
      btn.setAttribute('aria-pressed', state.date === dateStr ? 'true' : 'false');
      if (dateStr === now.date) btn.setAttribute('data-today', 'true');

      var open = hoursFor(dateStr);
      var bookable = AV.isDateBookable(dateStr, now, horizonDays());
      var human = MONTHS[state.calMonth] + ' ' + d;

      if (!bookable) {
        btn.disabled = true;
        btn.setAttribute('aria-label', human + ' — not available for booking');
      } else if (!open) {
        btn.disabled = true;
        btn.setAttribute('aria-label', human + ' — salon closed');
      } else {
        btn.setAttribute('aria-label', human);
        btn.addEventListener('click', makeDayHandler(dateStr));
      }
      els.calDays.appendChild(btn);
    }
  }

  function makeDayHandler(dateStr) {
    return function () {
      state.date = dateStr;
      state.time = null;
      $$('.cal-day', els.calDays).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      $$('.cal-day', els.calDays).forEach(function (b) {
        if (b.textContent === String(+dateStr.split('-')[2])) b.setAttribute('aria-pressed', 'true');
      });
      setStep(els.step2, 'done');
      setStep(els.step3, 'active');
      setStep(els.step4, 'locked');
      if (els.hint2) els.hint2.textContent = prettyDate(dateStr);
      loadSlots();
      focusStep(els.step3);
    };
  }

  function prettyDate(dateStr) {
    var p = dateStr.split('-');
    return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0];
  }

  /* ============================================================
     SLOTS
     ============================================================ */
  function loadSlots() {
    if (!state.service || !state.date) return;
    var token = ++state.slotsToken;

    if (els.hint3) els.hint3.textContent = 'Checking availability…';
    els.slotGrid.setAttribute('aria-busy', 'true');
    els.slotGrid.innerHTML = '';
    for (var i = 0; i < 10; i++) {
      var sk = document.createElement('div');
      sk.className = 'skeleton';
      els.slotGrid.appendChild(sk);
    }

    var request = LIVE
      ? rpc('available_slots', { p_service_id: state.service.id, p_date: state.date })
          .then(function (rows) {
            return (rows || []).map(function (r) {
              var minutes = AV.parseTime(String(r.slot_time));
              return {
                minutes: minutes,
                time: AV.formatTime(minutes),
                label: AV.formatTimeLabel(minutes),
                available: r.available === true,
                reason: r.reason
              };
            });
          })
      : Promise.resolve(localSlots());

    request.then(function (slots) {
      if (token !== state.slotsToken) return; // a newer request won
      renderSlots(slots);
    }).catch(function (err) {
      if (token !== state.slotsToken) return;
      els.slotGrid.innerHTML = '';
      els.slotGrid.removeAttribute('aria-busy');
      if (els.hint3) els.hint3.textContent = 'Could not load times';

      var box = document.createElement('p');
      box.className = 'notice notice-error';
      box.innerHTML = '<span class="notice-icon" aria-hidden="true">!</span>';
      var span = document.createElement('span');
      span.textContent = 'We could not load availability just now. Check your connection and try again.';
      box.appendChild(span);
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'link';
      retry.style.marginTop = '0.5rem';
      retry.textContent = 'Try again';
      retry.addEventListener('click', loadSlots);
      box.appendChild(retry);
      els.slotGrid.appendChild(box);

      UI.announce('Availability could not be loaded.');
      console.error('available_slots failed', err);
    });
  }

  /* Local computation, used only in preview mode. It knows about no
     existing appointments, which is exactly why it is labelled a
     preview and cannot be submitted. */
  function localSlots() {
    var now = salonNow();
    var result = AV.computeSlots({
      service: state.service,
      date: state.date,
      hours: hoursFor(state.date),
      resourceCount: 1,
      bookings: [],
      now: now,
      slotStepMinutes: CONFIG.get('scheduling.slotStepMinutes', 15),
      leadTimeMinutes: CONFIG.get('scheduling.leadTimeMinutes', 60)
    });
    return result.slots;
  }

  function renderSlots(slots) {
    els.slotGrid.innerHTML = '';
    els.slotGrid.removeAttribute('aria-busy');

    var free = slots.filter(function (s) { return s.available; });

    if (!slots.length) {
      var closed = document.createElement('p');
      closed.className = 'notice notice-info';
      closed.innerHTML = '<span class="notice-icon" aria-hidden="true">i</span>';
      var ctext = document.createElement('span');
      ctext.textContent = 'The salon is closed on ' + prettyDate(state.date) +
        ' for this service. Please choose another day.';
      closed.appendChild(ctext);
      els.slotGrid.appendChild(closed);
      if (els.slotLegend) els.slotLegend.hidden = true;
      if (els.hint3) els.hint3.textContent = 'Closed';
      UI.announce('No times on that date. The salon is closed.');
      return;
    }

    if (!free.length) {
      var full = document.createElement('p');
      full.className = 'notice notice-warn';
      full.innerHTML = '<span class="notice-icon" aria-hidden="true">i</span>';
      var ftext = document.createElement('span');
      ftext.textContent = 'Every ' + state.service.duration + '-minute slot on ' +
        prettyDate(state.date) + ' is taken or has passed. Try the next day.';
      full.appendChild(ftext);
      els.slotGrid.appendChild(full);
      if (els.slotLegend) els.slotLegend.hidden = true;
      if (els.hint3) els.hint3.textContent = 'Fully booked';
      UI.announce('No times left on that date.');
      return;
    }

    slots.forEach(function (slot) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot';
      btn.textContent = slot.label;
      btn.setAttribute('aria-pressed', 'false');

      if (!slot.available) {
        btn.disabled = true;
        // The accessible name explains why, so availability is never
        // communicated by styling alone.
        btn.setAttribute('aria-label', slot.label + ' — ' +
          (slot.reason === 'past' ? 'no longer available today' : 'already booked'));
      } else {
        btn.addEventListener('click', function () {
          $$('.slot', els.slotGrid).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
          btn.setAttribute('aria-pressed', 'true');
          state.time = slot.time;
          setStep(els.step3, 'done');
          setStep(els.step4, 'active');
          if (els.hint3) els.hint3.textContent = slot.label;
          UI.announce(slot.label + ' selected. Now add your details.');
          focusStep(els.step4);
        });
      }
      els.slotGrid.appendChild(btn);
    });

    if (els.slotLegend) els.slotLegend.hidden = false;
    if (els.hint3) {
      els.hint3.textContent = free.length + (free.length === 1 ? ' time free' : ' times free') +
        (LIVE ? '' : ' (preview)');
    }
    UI.announce(free.length + ' times available on ' + prettyDate(state.date) + '.');
  }

  /* ============================================================
     VALIDATION
     ============================================================ */
  var RULES = [
    { id: 'bkName', err: 'bkNameErr', test: function (v) { return v.trim().length >= 2; },
      message: 'Please enter your name.' },
    { id: 'bkPhone', err: 'bkPhoneErr',
      test: function (v) { return /^\+?[0-9][0-9\s-()]{6,18}$/.test(v.trim()); },
      message: 'Please enter a phone number we can reach you on.' },
    { id: 'bkEmail', err: 'bkEmailErr',
      test: function (v) { return /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(v.trim()); },
      message: 'Please check the email address.' }
  ];

  function validateField(rule, showError) {
    var input = document.getElementById(rule.id);
    var errEl = document.getElementById(rule.err);
    if (!input) return true;
    var ok = rule.test(input.value || '');
    if (ok) {
      input.removeAttribute('aria-invalid');
      if (errEl) errEl.textContent = '';
    } else if (showError) {
      input.setAttribute('aria-invalid', 'true');
      if (errEl) errEl.textContent = rule.message;
    }
    return ok;
  }

  RULES.forEach(function (rule) {
    var input = document.getElementById(rule.id);
    if (!input) return;
    // Validate on blur, and clear an existing error as soon as it is
    // fixed — never shout at someone mid-typing.
    input.addEventListener('blur', function () { validateField(rule, true); });
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') validateField(rule, true);
    });
  });

  /* ============================================================
     SUBMIT
     ============================================================ */
  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (state.submitting) return;

    if (!state.service) {
      UI.toast('Please choose a service first.', 'error');
      focusStep(els.step1);
      return;
    }
    if (!state.date) {
      UI.toast('Please choose a date.', 'error');
      focusStep(els.step2);
      return;
    }
    if (!state.time) {
      UI.toast('Please choose a time.', 'error');
      focusStep(els.step3);
      return;
    }

    var firstBad = null;
    RULES.forEach(function (rule) {
      var ok = validateField(rule, true);
      if (!ok && !firstBad) firstBad = document.getElementById(rule.id);
    });
    if (firstBad) {
      firstBad.focus();
      UI.toast('Please check the highlighted fields.', 'error');
      return;
    }

    if (!LIVE) {
      UI.toast('This is a preview. Booking is not connected yet.', 'error');
      return;
    }

    submit();
  });

  function setSubmitting(on) {
    state.submitting = on;
    els.submit.disabled = on;
    els.submit.setAttribute('aria-busy', on ? 'true' : 'false');
    els.submitLabel.textContent = on ? 'Holding your slot…' : 'Confirm appointment';
    var spinner = els.submit.querySelector('.spinner');
    if (on && !spinner) {
      var s = document.createElement('span');
      s.className = 'spinner';
      s.setAttribute('aria-hidden', 'true');
      els.submit.insertBefore(s, els.submit.firstChild);
    } else if (!on && spinner) {
      spinner.remove();
    }
  }

  function submit() {
    setSubmitting(true);
    UI.announce('Confirming your appointment.');

    var payload = {
      p_service_id: state.service.id,
      p_date: state.date,
      p_time: state.time,
      p_name: $('#bkName').value,
      p_phone: $('#bkPhone').value,
      p_email: $('#bkEmail').value,
      p_notes: $('#bkNotes') ? $('#bkNotes').value : null
    };

    rpc('create_booking', payload).then(function (result) {
      setSubmitting(false);

      if (!result || result.ok !== true) {
        var reason = (result && result.reason) || 'unknown';
        var message = (result && result.message) || 'That booking could not be completed.';
        UI.toast(message, 'error');
        UI.announce(message);

        // Someone else got there first: the honest response is to show
        // the new truth immediately rather than let them try again
        // against a stale grid.
        if (reason === 'slot_taken' || reason === 'past' ||
            reason === 'closed' || reason === 'off_grid') {
          state.time = null;
          setStep(els.step3, 'active');
          setStep(els.step4, 'locked');
          loadSlots();
          focusStep(els.step3);
        }
        return;
      }

      showSuccess(result);
      sendEmails(result);
    }).catch(function (err) {
      setSubmitting(false);
      var msg = 'We could not reach the booking system. Nothing has been booked — please try again.';
      UI.toast(msg, 'error');
      UI.announce(msg);
      console.error('create_booking failed', err);
    });
  }

  /* ============================================================
     SUCCESS — only ever reached from an ok:true backend response
     ============================================================ */
  function showSuccess(result) {
    els.form.hidden = true;
    els.ok.hidden = false;

    els.ref.textContent = result.reference;
    els.ref.setAttribute('aria-label', 'Booking reference ' + result.reference.split('').join(' '));

    els.okNote.textContent = CONFIG.emailIsLive()
      ? 'A confirmation is on its way to your email. We will call if anything needs changing.'
      : 'We will call you on the number you gave to confirm. Please keep your reference handy.';

    var startLabel = AV.formatTimeLabel(AV.parseTime(result.startsAt.split('T')[1]));
    var endLabel = AV.formatTimeLabel(AV.parseTime(result.endsAt.split('T')[1]));

    var rows = [
      ['Service', state.service.name],
      ['Date', prettyDate(state.date)],
      ['Time', startLabel + ' – ' + endLabel],
      ['Name', $('#bkName').value.trim()],
      ['Phone', $('#bkPhone').value.trim()]
    ];
    els.summary.innerHTML = '';
    rows.forEach(function (row) {
      var wrap = document.createElement('div');
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      els.summary.appendChild(wrap);
    });

    UI.toast('Booked. Your reference is ' + result.reference, 'ok');
    UI.announce('Appointment confirmed for ' + prettyDate(state.date) + ' at ' + startLabel +
                '. Your reference is ' + result.reference + '.');
    focusStep(els.ok);
    els.again.focus();
  }

  if (els.again) {
    els.again.addEventListener('click', function () {
      state.service = null; state.date = null; state.time = null;
      els.form.reset();
      els.form.hidden = false;
      els.ok.hidden = true;
      RULES.forEach(function (r) {
        var errEl = document.getElementById(r.err);
        if (errEl) errEl.textContent = '';
        var input = document.getElementById(r.id);
        if (input) input.removeAttribute('aria-invalid');
      });
      setStep(els.step1, 'active');
      setStep(els.step2, 'locked');
      setStep(els.step3, 'locked');
      setStep(els.step4, 'locked');
      if (els.hint2) els.hint2.textContent = 'Pick a service first';
      if (els.hint3) els.hint3.textContent = 'Pick a date first';
      els.slotGrid.innerHTML = '';
      if (els.slotLegend) els.slotLegend.hidden = true;
      renderCategories();
      renderCalendar();
      focusStep(els.step1);
    });
  }

  /* ============================================================
     OPTIONAL CONFIRMATION EMAIL
     Loaded lazily and only when configured. A failure here is logged
     and surfaced gently: the appointment is already stored, so it must
     never look like the booking failed.
     ============================================================ */
  function sendEmails(result) {
    if (!CONFIG.emailIsLive()) return;

    loadEmailJS().then(function () {
      var common = {
        reference: result.reference,
        service: state.service.name,
        date: prettyDate(state.date),
        time: AV.formatTimeLabel(AV.parseTime(result.startsAt.split('T')[1])),
        client_name: $('#bkName').value.trim(),
        client_email: $('#bkEmail').value.trim(),
        client_phone: $('#bkPhone').value.trim(),
        notes: $('#bkNotes') ? $('#bkNotes').value.trim() : ''
      };
      var jobs = [window.emailjs.send(CONFIG.get('email.serviceId'),
                                      CONFIG.get('email.templateCustomer'), common)];
      if (CONFIG.has('email.templateOwner')) {
        var forOwner = Object.assign({}, common);
        forOwner.owner_email = CONFIG.get('email.ownerAddress', '');
        jobs.push(window.emailjs.send(CONFIG.get('email.serviceId'),
                                      CONFIG.get('email.templateOwner'), forOwner));
      }
      return Promise.all(jobs);
    }).catch(function (err) {
      console.warn('Confirmation email failed; the booking itself is stored.', err);
      if (els.okNote) {
        els.okNote.textContent =
          'Your appointment is booked. The confirmation email did not go through, ' +
          'so please keep your reference below.';
      }
    });
  }

  var emailJsPromise = null;
  function loadEmailJS() {
    if (window.emailjs) return Promise.resolve();
    if (emailJsPromise) return emailJsPromise;
    emailJsPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
      s.async = true;
      s.onload = function () {
        try {
          window.emailjs.init({ publicKey: CONFIG.get('email.publicKey') });
          resolve();
        } catch (e) { reject(e); }
      };
      s.onerror = function () { reject(new Error('EmailJS failed to load')); };
      document.head.appendChild(s);
    });
    return emailJsPromise;
  }

  /* ============================================================
     DEEP LINKS — "Book this" on a service card
     ============================================================ */
  function initServiceShortcuts() {
    $$('[data-book]').forEach(function (link) {
      link.addEventListener('click', function () {
        var cat = CATALOGUE.categoryById(link.getAttribute('data-book'));
        if (!cat) return;
        // The anchor still does the scrolling; this just preloads the
        // right category so the panel is already on the right screen.
        if (state.service) return;
        renderServiceList(cat);
      });
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    renderCategories();
    initCalendar();
    initServiceShortcuts();
    setStep(els.step2, 'locked');
    setStep(els.step3, 'locked');
    setStep(els.step4, 'locked');
  }

  if (!LIVE) {
    enterPreviewMode('The booking database has not been connected yet.');
    boot();
    return;
  }

  // Live: fetch server truth first so durations and hours are the
  // backend's, not the client's.
  rpc('salon_runtime', {}).then(function (runtime) {
    state.runtime = runtime;
    if (!runtime || !runtime.services || !runtime.services.length) {
      enterPreviewMode('The booking database is reachable but has no services in it yet — run supabase/schema.sql.');
    }
    boot();
  }).catch(function (err) {
    console.error('salon_runtime failed', err);
    enterPreviewMode('The booking database did not respond.');
    boot();
  });
})();
