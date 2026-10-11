/* ============================================================
   MOTION LAYER
   ------------------------------------------------------------
   One entrance language for the whole page: things arrive from
   slightly below, images uncover upward, headings come in a word at a
   time. Two easings, both defined in salon.css, so a section added
   next year inherits the same feel for free.

   Three guarantees:
   - It touches nothing the booking engine owns. Deleting this file
     leaves a fully working, fully readable site.
   - prefers-reduced-motion short-circuits everything at the top: no
     observers are created, no transforms applied, content shown as-is.
   - A hard floor reveals everything after 2.4s no matter what, so a
     failed observer or a throttled tab can never leave text invisible.
   ============================================================ */
(function () {
  'use strict';

  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var observers = [];

  /* ============================================================
     SPLITTING
     Walks the tree instead of reading textContent, so <em>, <br> and
     any other inline markup inside a heading survive the split.
     ============================================================ */
  function wrapWords(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var text = child.textContent;
        if (!text.trim()) return;
        var frag = document.createDocumentFragment();
        text.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var span = document.createElement('span');
          span.className = 'word';
          var inner = document.createElement('i');
          inner.textContent = part;
          span.appendChild(inner);
          frag.appendChild(span);
        });
        child.parentNode.replaceChild(frag, child);
      } else if (child.nodeType === 1 &&
                 !child.classList.contains('word') &&
                 child.tagName !== 'BR') {
        wrapWords(child);
      }
    });
  }

  /* Line mode: each .line becomes a single masked unit, which is what
     makes the hero read as two deliberate strokes rather than six
     words scattering in. */
  function wrapLines(root) {
    $$('.line', root).forEach(function (line) {
      var span = document.createElement('span');
      span.className = 'word';
      var inner = document.createElement('i');
      while (line.firstChild) inner.appendChild(line.firstChild);
      span.appendChild(inner);
      line.appendChild(span);
    });
  }

  function showWords(root, instant) {
    var words = $$('.word', root);
    words.forEach(function (word, index) {
      if (instant) { word.classList.add('in'); return; }
      // 58ms apart: fast enough that a long heading finishes before the
      // reader gets impatient, slow enough to read as a sequence.
      setTimeout(function () { word.classList.add('in'); }, index * 58);
    });
  }

  var splitRoots = $$('[data-split]');
  splitRoots.forEach(function (root) {
    if (root.getAttribute('data-split') === 'lines') wrapLines(root);
    else wrapWords(root);
  });

  /* ============================================================
     REDUCED MOTION — everything visible, nothing observed
     ============================================================ */
  function revealEverything() {
    splitRoots.forEach(function (root) { showWords(root, true); });
    $$('.reveal, .mask').forEach(function (el) { el.classList.add('in'); });
  }

  if (reduce.matches) {
    revealEverything();
  } else {

    /* ============================================================
       ENTRANCE OBSERVERS
       ============================================================ */
    if ('IntersectionObserver' in window) {

      // Headings. The hero fires immediately; everything else waits
      // until it is actually on screen.
      var wordObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          showWords(entry.target, false);
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
      observers.push(wordObserver);

      splitRoots.forEach(function (root) {
        if (root.closest('.hero')) {
          // Give the stylesheet one frame to apply the hidden state,
          // otherwise the first paint can skip the animation entirely.
          requestAnimationFrame(function () { showWords(root, false); });
        } else {
          wordObserver.observe(root);
        }
      });

      var revealObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      observers.push(revealObserver);

      $$('.reveal').forEach(function (el) { revealObserver.observe(el); });

      // Clip-path image reveals. A lower threshold than text, because a
      // tall plate is often taller than the viewport.
      var maskObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.06 });
      observers.push(maskObserver);

      $$('.mask').forEach(function (el) {
        if (el.closest('.hero')) {
          requestAnimationFrame(function () { el.classList.add('in'); });
        } else {
          maskObserver.observe(el);
        }
      });

      /* ----- active section in the navigation ----- */
      var navLinks = $$('.nav-link');
      var sectionsById = {};
      navLinks.forEach(function (link) {
        var id = link.getAttribute('href').slice(1);
        var section = document.getElementById(id);
        if (section) sectionsById[id] = link;
      });

      var navObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var link = sectionsById[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            navLinks.forEach(function (l) { l.removeAttribute('aria-current'); });
            link.setAttribute('aria-current', 'true');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      observers.push(navObserver);

      Object.keys(sectionsById).forEach(function (id) {
        navObserver.observe(document.getElementById(id));
      });
    } else {
      revealEverything();
    }

    /* ============================================================
       SCROLL-LINKED: statement progress rule
       A single rAF-batched read per frame, writing one custom property.
       No layout properties are animated and nothing runs when the
       section is off screen.
       ============================================================ */
    var progressEl = document.getElementById('statementProgress');
    var statement = progressEl && progressEl.closest('.statement');

    if (progressEl && statement && 'IntersectionObserver' in window) {
      var inView = false;
      var queued = false;

      var progressObserver = new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) schedule();
      }, { threshold: 0 });
      progressObserver.observe(statement);
      observers.push(progressObserver);

      function paint() {
        queued = false;
        if (!inView) return;
        var rect = statement.getBoundingClientRect();
        var viewport = window.innerHeight || 1;
        // 0 when the section's top reaches the bottom of the viewport,
        // 1 when its bottom passes the top.
        var travelled = viewport - rect.top;
        var total = viewport + rect.height;
        var p = Math.max(0, Math.min(1, travelled / total));
        progressEl.style.setProperty('--p', p.toFixed(3));
      }

      function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(paint);
      }

      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      schedule();
    }
  }

  /* ============================================================
     HEADER DOCK
     Runs under reduced motion too: it is a legibility feature, not
     decoration — the header has to become opaque or its text sits on
     top of whatever scrolls beneath it.
     ============================================================ */
  var header = document.getElementById('header');
  if (header) {
    var docked = null;
    var pending = false;

    function readScroll() {
      pending = false;
      var y = window.scrollY || window.pageYOffset || 0;
      var next = y > 24;
      if (next === docked) return;
      docked = next;
      header.classList.toggle('docked', next);
    }

    window.addEventListener('scroll', function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(readScroll);
    }, { passive: true });
    readScroll();
  }

  /* ============================================================
     HARD FLOOR
     Whatever happened above, nothing stays hidden.
     ============================================================ */
  setTimeout(revealEverything, 2400);

  /* Stop observing if the page is being torn down, so nothing is left
     holding references to detached nodes. */
  window.addEventListener('pagehide', function () {
    observers.forEach(function (o) { o.disconnect(); });
    observers.length = 0;
  });
})();
