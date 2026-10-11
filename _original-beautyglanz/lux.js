/* ============================================================
   BEAUTY GLANZ — motion layer
   Dependency-free. Sits on top of main.js and never touches the
   booking engine. main.js owns #heroImg and #aboutPhotoWrap
   transforms; nothing here writes to those.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 1. Page entrance ---------- */
  function openPage() {
    var pre = $('#preloader');
    var hero = $('#hero');
    if (hero) hero.classList.add('ready');
    if (pre) {
      pre.classList.add('gone');
      setTimeout(function () { if (pre && pre.parentNode) pre.parentNode.removeChild(pre); }, 900);
    }
  }
  var opened = false;
  function openOnce() { if (opened) return; opened = true; openPage(); }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { setTimeout(openOnce, 80); });
  }
  window.addEventListener('load', function () { setTimeout(openOnce, 60); });
  setTimeout(openOnce, 1800); // hard floor, never leave someone on the preloader

  /* ---------- 2. Word-mask headings ----------
     Headings carry data-de/ru/en and main.js rewrites their innerHTML on
     every language switch, which wipes the split. A MutationObserver puts
     it back, so the treatment survives DE → RU → EN. */
  function splitOne(el) {
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text || el.getAttribute('data-split-src') === text) return;

    var frag = document.createDocumentFragment();
    text.split(' ').forEach(function (word, i) {
      if (i) frag.appendChild(document.createTextNode(' '));
      var outer = document.createElement('span');
      outer.className = 'wd';
      var inner = document.createElement('i');
      inner.textContent = word;
      outer.appendChild(inner);
      frag.appendChild(outer);
    });

    el.textContent = '';
    el.appendChild(frag);
    el.setAttribute('data-split-src', text);

    // Already scrolled past? show immediately rather than animating in place.
    if (reduce || el.getAttribute('data-shown') === '1') showWords(el, true);
  }

  function showWords(el, instant) {
    el.setAttribute('data-shown', '1');
    $$('.wd', el).forEach(function (w, i) {
      if (instant || reduce) { w.classList.add('in'); return; }
      setTimeout(function () { w.classList.add('in'); }, i * 62);
    });
  }

  var splits = $$('.split');
  splits.forEach(splitOne);

  if ('MutationObserver' in window) {
    var mo = new MutationObserver(function (muts) {
      muts.forEach(function (m) { splitOne(m.target); });
    });
    splits.forEach(function (el) { mo.observe(el, { childList: true }); });
  }

  /* ---------- 3. Enter-view observers ---------- */
  if ('IntersectionObserver' in window) {
    var wordObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        showWords(e.target);
        wordObs.unobserve(e.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });
    splits.forEach(function (el) { wordObs.observe(el); });

    var clipObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        clipObs.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    $$('.img-rv').forEach(function (el) { clipObs.observe(el); });

    /* counters */
    var numObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target);
        numObs.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    $$('.count').forEach(function (el) { numObs.observe(el); });
  } else {
    splits.forEach(function (el) { showWords(el, true); });
    $$('.img-rv').forEach(function (el) { el.classList.add('in'); });
  }

  function groupNum(n, sep) {
    return sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n);
  }

  function countUp(el) {
    var target = parseInt(el.getAttribute('data-to'), 10);
    if (isNaN(target)) return;
    var sep = el.getAttribute('data-sep') === '1';
    if (reduce) { el.textContent = groupNum(target, sep); return; }

    var dur = 1500, t0 = null;
    function tick(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = groupNum(Math.round(target * eased), sep);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- 4. Header dock ----------
     main.js already swaps the Tailwind background classes at the same
     threshold; this adds the colour state so header type stays legible
     when the bar turns light. */
  var header = $('#mainHeader');
  var bar = $('#actionBar');
  var lastY = -1;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset || 0;
    if (y === lastY) return;
    lastY = y;
    if (header) header.classList.toggle('docked', y > 20);
    if (bar) bar.classList.toggle('up', y > 420);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 5. Foil shimmer on the hero wordmark ----------
     The logo is brushed metal; the wordmark catches light the same way
     as the pointer crosses it. Desktop only, rAF-throttled. */
  var hero = $('#hero');
  if (hero && !reduce && window.matchMedia('(pointer: fine)').matches) {
    var queued = false, px = 0;
    hero.addEventListener('pointermove', function (e) {
      px = e.clientX / window.innerWidth;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        hero.style.setProperty('--fx', (12 + px * 62).toFixed(1) + '%');
      });
    }, { passive: true });
  }

  /* ---------- 6. Clinic slider dots ----------
     main.js drives the slides; it does not know about the dots, so the
     dot state is read back from whichever slide is currently opaque. */
  var dots = $$('#clinicDots .clinic-dot');
  if (dots.length) {
    setInterval(function () {
      for (var i = 0; i < 4; i++) {
        var slide = document.getElementById('clinicSlide' + i);
        if (!slide) continue;
        var on = slide.classList.contains('opacity-100');
        if (dots[i]) dots[i].classList.toggle('on', on);
      }
    }, 400);
  }

  /* ---------- 7. Marquee duration from measured width ----------
     Keeps the scroll speed constant whatever language is showing. */
  var track = $('#marqueeTrack');
  function retimeMarquee() {
    if (!track || reduce) return;
    var half = track.scrollWidth / 2;
    if (!half) return;
    track.style.animationDuration = Math.max(24, half / 46).toFixed(1) + 's';
  }
  window.addEventListener('load', retimeMarquee);
  window.addEventListener('resize', retimeMarquee);
  setTimeout(retimeMarquee, 600);

  /* ---------- 8. Keep motion in step with language switches ---------- */
  var origSelect = window.selectLang;
  if (typeof origSelect === 'function') {
    window.selectLang = function (lang) {
      origSelect.apply(this, arguments);
      splits.forEach(splitOne);
      setTimeout(retimeMarquee, 50);
    };
  }

  /* ---------- 9. Close the mobile menu on Escape ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var ov = $('#mobileOverlay');
    if (ov) ov.classList.remove('open');
    var ls = $('#langSwitcher');
    if (ls) ls.classList.remove('open');
  });
})();
