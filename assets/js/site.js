/* ============================================================
   SITE LAYER
   ------------------------------------------------------------
   Everything that is not the booking engine and not the motion
   layer: binding config into the page, swapping photography slots
   for real images when they exist, the gallery and its lightbox,
   the map, the mobile drawer, and the toast/announce helpers that
   booking.js reuses.

   Nothing here is required for the page to make sense. With this
   file blocked, the markup still reads correctly — it just stops
   reflecting config changes.
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = window.SALON_CONFIG;
  var CATALOGUE = window.SALON_CATALOGUE;
  var AV = window.SalonAvailability;

  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ============================================================
     TOASTS + SCREEN READER ANNOUNCEMENTS
     Exposed on window.SalonUI so booking.js does not re-implement them.
     ============================================================ */
  var toastHost = $('#toasts');
  var liveRegion = $('#bookingLive');

  function toast(message, kind) {
    if (!toastHost) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind === 'ok' ? '✓' : '!';
    var text = document.createElement('span');
    // textContent, never innerHTML: a server message can never inject markup.
    text.textContent = message;
    el.appendChild(icon);
    el.appendChild(text);
    toastHost.appendChild(el);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.setAttribute('data-show', 'true'); });
    });

    var life = setTimeout(function () {
      el.removeAttribute('data-show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
    }, 5200);

    el.addEventListener('click', function () {
      clearTimeout(life);
      el.removeAttribute('data-show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
    });
  }

  /* Polite announcement for assistive tech. Cleared first so the same
     message twice in a row is still read out. */
  function announce(message) {
    if (!liveRegion) return;
    liveRegion.textContent = '';
    setTimeout(function () { liveRegion.textContent = message; }, 60);
  }

  window.SalonUI = { toast: toast, announce: announce, $: $, $$: $$ };

  if (!CONFIG) return; // config.js failed to load; markup stands on its own.

  /* ============================================================
     CONFIG BINDING
     The HTML carries real, confirmed copy as its default. These
     attributes let config override it, and remove anything the config
     has no value for — which is how a missing phone number becomes an
     absent row rather than an empty link.
     ============================================================ */
  function applyBindings() {
    // Drop whole elements whose required value is unknown.
    $$('[data-requires]').forEach(function (el) {
      if (!CONFIG.has(el.getAttribute('data-requires'))) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    });

    $$('[data-bind]').forEach(function (el) {
      var path = el.getAttribute('data-bind');
      if (CONFIG.has(path)) el.textContent = CONFIG.get(path);
    });

    $$('[data-bind-href]').forEach(function (el) {
      var path = el.getAttribute('data-bind-href');
      if (!CONFIG.has(path)) { el.removeAttribute('href'); return; }
      el.setAttribute('href', (el.getAttribute('data-href-prefix') || '') + CONFIG.get(path));
    });

    var yr = $('#year');
    if (yr) yr.textContent = String(new Date().getFullYear());

    var followers = CONFIG.get('contact.instagramFollowers');
    if (followers) {
      $$('#heroFollowers, #igFollowers').forEach(function (el) { el.textContent = followers; });
    }
  }

  /* ============================================================
     OPENING HOURS LINE
     "Open today until 10pm" / "Closed today, open tomorrow 10am".
     Computed from the same config the booking engine reads, so the two
     can never disagree.
     ============================================================ */
  function describeHours() {
    if (!AV) return;
    var tz = CONFIG.get('scheduling.timeZone', 'Asia/Kolkata');
    var now = AV.salonNow(tz);
    var weekday = AV.weekdayMondayFirst(now.date);
    var today = CONFIG.hoursFor(weekday);

    var heroEl = $('#heroHours');
    if (!heroEl) return;

    function pretty(hhmm) {
      return AV.formatTimeLabel(AV.parseTime(hhmm)).replace(':00', '').toLowerCase();
    }

    if (!today) {
      // Find the next open day so a closed day still gives useful info.
      for (var i = 1; i <= 7; i++) {
        var next = CONFIG.hoursFor((weekday + i) % 7);
        if (next) {
          var names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          heroEl.textContent = 'Closed today · open ' +
            (i === 1 ? 'tomorrow' : names[(weekday + i) % 7]) + ' from ' + pretty(next.open);
          return;
        }
      }
      heroEl.textContent = 'Closed today';
      return;
    }

    var open = AV.parseTime(today.open);
    var close = AV.parseTime(today.close);
    var label;
    if (now.minutes < open) {
      label = 'Opens today at ' + pretty(today.open);
    } else if (now.minutes < close) {
      label = 'Open now until ' + pretty(today.close);
    } else {
      label = 'Closed for today · open tomorrow from ' + pretty(today.open);
    }
    if (today.provisional) label += ' (provisional)';
    heroEl.textContent = label;
  }

  /* ============================================================
     PHOTOGRAPHY SLOTS
     A .plate becomes a real figure the moment config.images has a src.
     ============================================================ */
  function hydratePlates() {
    $$('[data-plate]').forEach(function (plate) {
      var key = plate.getAttribute('data-plate');
      var spec = CONFIG.images && CONFIG.images[key];
      if (!spec || !spec.src) return;

      var img = document.createElement('img');
      img.src = spec.src;
      img.alt = spec.alt || '';
      img.decoding = 'async';
      // The hero image is the likely LCP element, so it is eager and
      // high priority; everything below the fold is lazy.
      if (key === 'hero') {
        img.setAttribute('fetchpriority', 'high');
      } else {
        img.loading = 'lazy';
      }
      plate.insertBefore(img, plate.firstChild);
      plate.classList.add('has-image');
    });
  }

  /* ============================================================
     GALLERY
     ============================================================ */
  function buildGallery() {
    var grid = $('#galleryGrid');
    if (!grid) return;
    var items = CONFIG.gallery || [];
    var withImages = items.filter(function (i) { return !!i.src; });

    items.forEach(function (item, index) {
      var cell = document.createElement('div');
      cell.className = 'gallery-cell reveal' + (index % 4 ? ' reveal-d' + (index % 4) : '');
      cell.setAttribute('data-span', item.span || 'normal');

      if (item.src) {
        // Real photograph: a button, because it opens a dialog.
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'plate mask has-image';
        btn.setAttribute('aria-label', 'Enlarge: ' + (item.alt || item.caption || 'image'));
        var img = document.createElement('img');
        img.src = item.src;
        img.alt = item.alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);
        btn.addEventListener('click', function () { openLightbox(item); });
        cell.appendChild(btn);
      } else {
        var plate = document.createElement('div');
        plate.className = 'plate mask';
        var inner = document.createElement('div');
        inner.className = 'plate-inner';
        inner.innerHTML =
          '<p class="plate-caption"><b></b><i>Photography slot</i></p>' +
          '<svg class="plate-glyph" viewBox="0 0 64 64" aria-hidden="true">' +
          '<path d="M8 48 24 30l10 11 8-8 14 15z"/><circle cx="22" cy="18" r="5"/>' +
          '<path d="M6 10h52v44H6z"/></svg>' +
          '<p class="plate-caption"><i></i><b></b></p>';
        // Captions are config data, so they go in as text.
        inner.querySelector('.plate-caption b').textContent = item.caption || '';
        inner.querySelectorAll('.plate-caption')[1].querySelector('b').textContent =
          String(index + 1).padStart(2, '0');
        plate.appendChild(inner);
        cell.appendChild(plate);
      }
      grid.appendChild(cell);
    });

    // The section copy is written to be true either way, so this adds a
    // hint rather than overwriting it — the lightbox only exists once
    // there are real photographs to enlarge.
    if (withImages.length > 0) {
      var hint = document.createElement('p');
      hint.className = 'micro';
      hint.style.marginTop = 'var(--sp-3)';
      hint.textContent = 'Tap any photograph to see it full size.';
      grid.insertAdjacentElement('afterend', hint);
    }
  }

  /* ============================================================
     LIGHTBOX — focus is trapped while open and restored on close
     ============================================================ */
  var lightbox = $('#lightbox');
  var lightboxImg = $('#lightboxImg');
  var lightboxCap = $('#lightboxCap');
  var lastFocused = null;

  function openLightbox(item) {
    if (!lightbox) return;
    lastFocused = document.activeElement;
    lightboxImg.src = item.src;
    lightboxImg.alt = item.alt || '';
    lightboxCap.textContent = item.caption || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';

    // Reading a layout property forces a reflow, which gives the
    // transition a start state to animate from. Doing it this way
    // instead of deferring to requestAnimationFrame matters: the closed
    // state is `visibility: hidden`, so until data-open flips, nothing
    // inside can take focus — and rAF does not run in a background tab
    // or under heavy load, which would leave the dialog open with focus
    // stranded behind it.
    void lightbox.offsetHeight;
    lightbox.setAttribute('data-open', 'true');

    var close = $('#lightboxClose');
    if (close) close.focus();
  }

  function closeLightbox() {
    // Keyed on `hidden`, which open() sets synchronously, rather than on
    // data-open, which is set in a rAF callback. If frames are throttled
    // the fade may not have started yet, and the dialog still has to be
    // closeable.
    if (!lightbox || lightbox.hidden) return;
    lightbox.setAttribute('data-open', 'false');
    document.body.style.overflow = '';
    setTimeout(function () {
      lightbox.hidden = true;
      lightboxImg.src = '';
    }, 420);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  if (lightbox) {
    $('#lightboxClose').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    // Nothing else is focusable inside, so trapping is just: stay here.
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { e.preventDefault(); $('#lightboxClose').focus(); }
    });
  }

  /* ============================================================
     MAP — only when there is a real address to point at
     ============================================================ */
  function buildMap() {
    var host = $('#map');
    if (!host) return;
    if (!CONFIG.has('location.mapQuery')) {
      // No verified address: remove the frame rather than show a pin
      // in the wrong place.
      var wrapper = host.parentNode;
      if (wrapper && wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      return;
    }
    var iframe = document.createElement('iframe');
    iframe.src = 'https://maps.google.com/maps?q=' +
      encodeURIComponent(CONFIG.get('location.mapQuery')) +
      '&z=16&output=embed';
    iframe.title = 'Map showing V Rohit Rai Unisex Salon, ' + CONFIG.get('location.area', 'Mumbai');
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.setAttribute('allowfullscreen', '');
    host.appendChild(iframe);
  }

  /* ============================================================
     DIRECT CONTACT + LEGAL LINKS
     ============================================================ */
  function buildDirectContact() {
    var host = $('#directContact');
    if (!host) return;

    if (CONFIG.has('contact.whatsapp')) {
      var wa = document.createElement('a');
      wa.className = 'btn btn-ghost';
      wa.href = 'https://wa.me/' + CONFIG.get('contact.whatsapp');
      wa.target = '_blank';
      wa.rel = 'noopener noreferrer';
      wa.textContent = 'WhatsApp';
      host.insertBefore(wa, host.firstChild);
    }
    if (CONFIG.has('contact.phone')) {
      var call = document.createElement('a');
      call.className = 'btn btn-ghost';
      call.href = 'tel:' + CONFIG.get('contact.phone');
      call.textContent = 'Call the salon';
      host.insertBefore(call, host.firstChild);

      // Also upgrade the mobile action bar with a call button.
      var bar = $('.action-bar');
      if (bar) {
        var icon = document.createElement('a');
        icon.className = 'icon-btn';
        icon.href = 'tel:' + CONFIG.get('contact.phone');
        icon.setAttribute('aria-label', 'Call the salon');
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 5a2 2 0 0 1 2-2h3.3a1 1 0 0 1 .95.68l1.5 4.5a1 1 0 0 1-.5 1.2l-2.26 1.14a11 11 0 0 0 5.5 5.5l1.14-2.26a1 1 0 0 1 1.2-.5l4.5 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2h-1C9.7 21 3 14.3 3 6V5Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        bar.appendChild(icon);
      }
    }
  }

  function buildLegal() {
    var host = $('#footerLegal');
    if (!host) return;
    var links = [
      { path: 'legal.privacy', label: 'Privacy' },
      { path: 'legal.terms', label: 'Terms' }
    ];
    links.forEach(function (l) {
      if (!CONFIG.has(l.path)) return;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = CONFIG.get(l.path);
      a.textContent = l.label;
      li.appendChild(a);
      host.appendChild(li);
    });
  }

  /* ============================================================
     SERVICE CHIPS + CARD COUNTS
     Progressive enhancement over the static service cards.
     ============================================================ */
  function enhanceServiceCards() {
    if (!CATALOGUE) return;
    $$('.service[data-category]').forEach(function (card) {
      var categoryId = card.getAttribute('data-category');
      var items = CATALOGUE.inCategory(categoryId);

      var count = card.querySelector('[data-count]');
      if (count) {
        count.textContent = items.length + (items.length === 1 ? ' service' : ' services');
      }

      var chips = card.querySelector('[data-chips]');
      if (!chips) return;
      // Three named treatments is enough to communicate the range
      // without turning the card into a price list.
      items.slice(0, 3).forEach(function (service) {
        var chip = document.createElement('span');
        chip.className = 'service-item';
        chip.textContent = service.name;
        chips.appendChild(chip);
      });
      if (items.length > 3) {
        var more = document.createElement('span');
        more.className = 'service-item';
        more.textContent = '+' + (items.length - 3) + ' more';
        chips.appendChild(more);
      }
    });
  }

  /* ============================================================
     MOBILE DRAWER — modal, focus-trapped, Escape closes
     ============================================================ */
  function initDrawer() {
    var drawer = $('#drawer');
    var burger = $('#burger');
    var close = $('#drawerClose');
    if (!drawer || !burger) return;

    var opener = null;

    function focusables() {
      return $$('a[href], button:not([disabled])', drawer);
    }

    function open() {
      opener = document.activeElement;
      drawer.hidden = false;
      requestAnimationFrame(function () {
        drawer.setAttribute('data-open', 'true');
        burger.setAttribute('aria-expanded', 'true');
        var f = focusables();
        if (f.length) f[0].focus();
      });
      document.body.style.overflow = 'hidden';
    }

    function shut() {
      drawer.setAttribute('data-open', 'false');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(function () { drawer.hidden = true; }, 540);
      if (opener && opener.focus) opener.focus();
    }

    burger.addEventListener('click', open);
    if (close) close.addEventListener('click', shut);

    // Any navigation closes it, so the target section is not hidden
    // behind the overlay.
    $$('a[href^="#"]', drawer).forEach(function (a) {
      a.addEventListener('click', shut);
    });

    drawer.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { shut(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Closing the drawer when the viewport grows past the breakpoint
    // avoids a hidden modal eating focus on a rotated tablet.
    window.matchMedia('(min-width: 1001px)').addEventListener('change', function (e) {
      if (e.matches && drawer.getAttribute('data-open') === 'true') shut();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  /* ============================================================
     BOOT
     ============================================================ */
  applyBindings();
  describeHours();
  hydratePlates();
  buildGallery();
  buildMap();
  buildDirectContact();
  buildLegal();
  enhanceServiceCards();
  initDrawer();
})();
