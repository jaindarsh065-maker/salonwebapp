/* ============================================================
   SERVICE CATALOGUE
   ------------------------------------------------------------
   The categories come from the salon's own service list. The
   individual treatments are the common items within each of those
   categories — the owner should sign off on the final menu.

   PRICES
   There is no verified price list, so every `price` is null and the
   UI shows no number at all. It does not show "from ₹0", it does not
   show a guess. Fill `price` with a string ('₹ 600', 'From ₹ 1,200')
   and it appears automatically.

   DURATIONS
   The booking engine cannot compute availability without a duration,
   so each service carries a provisional one. They are scheduling
   defaults, NOT the salon's published timings: while
   `durationsConfirmed` is false the UI labels them as approximate and
   the service cards do not advertise them. Once the owner confirms the
   real timings, set durationsConfirmed = true.

   RESOURCES
   `resource` is the exclusive thing the appointment occupies. Two
   appointments can never overlap on the same resource — that is the
   guarantee in availability.js and, authoritatively, in
   supabase/schema.sql. Services on DIFFERENT resources can run at the
   same time, which is how a real salon works: a nail appointment and a
   haircut at 5pm are both fine, two haircuts at 5pm are not (with one
   chair configured).
   ============================================================ */
(function () {
  'use strict';

  /* Bookable resources, grouped by kind. `count` is how many of that
     thing the salon actually has. With count: 1 the rule is exactly
     "if 5:00 PM is taken, nobody else is offered 5:00 PM".
     TODO owner: confirm these counts. */
  var RESOURCES = {
    'styling-chair': { label: 'Styling chair', count: 1 },
    'beauty-room':   { label: 'Beauty room',   count: 1 },
    'nail-station':  { label: 'Nail station',  count: 1 },
    'tattoo-studio': { label: 'Tattoo studio', count: 1 }
  };

  var CATEGORIES = [
    {
      id: 'hair',
      name: 'Hair & Styling',
      eyebrow: '01',
      blurb: 'Cuts that keep their shape as they grow out, and finishing that you can repeat at home.',
      // Short line-art glyph key, drawn in salon.css / index.html
      glyph: 'scissors'
    },
    {
      id: 'hair-spa',
      name: 'Hair Spa & Treatments',
      eyebrow: '02',
      blurb: 'Conditioning work for scalp and length — the slow part of the appointment, and the part that lasts.',
      glyph: 'drop'
    },
    {
      id: 'makeup',
      name: 'Makeup & Occasion',
      eyebrow: '03',
      blurb: 'Day makeup, evening makeup and full occasion looks, matched to your skin in daylight.',
      glyph: 'brush'
    },
    {
      id: 'nails',
      name: 'Nails & Nail Art',
      eyebrow: '04',
      blurb: 'Shape, finish and hand-painted detail — from one clean colour to work that takes its time.',
      glyph: 'nail'
    },
    {
      id: 'hands-feet',
      name: 'Manicure & Pedicure',
      eyebrow: '05',
      blurb: 'Proper hand and foot care, unhurried, with the soak and the massage left in.',
      glyph: 'bowl'
    },
    {
      id: 'waxing',
      name: 'Waxing & Personal Care',
      eyebrow: '06',
      blurb: 'Private room, quick turnaround, and a technician who tells you what to expect first.',
      glyph: 'leaf'
    },
    {
      id: 'grooming',
      name: 'Grooming & Shaving',
      eyebrow: '07',
      blurb: 'Beard architecture, the hot-towel shave, and a cut that works with how your hair actually falls.',
      glyph: 'razor'
    },
    {
      id: 'tattoo',
      name: 'Tattoo',
      eyebrow: '08',
      blurb: 'Every piece starts with a conversation about placement, size and healing — book the consultation first.',
      glyph: 'needle'
    }
  ];

  /* id must be stable and must match the services table in Postgres.
     duration = minutes of chair time. buffer = turnaround afterwards
     (cleaning, reset); it blocks the resource but is not sold to the
     customer, and it is why 5:00 PM + 45 min can free 5:55 PM rather
     than 5:45 PM. */
  var SERVICES = [
    /* ---- 01 Hair & Styling ---- */
    { id: 'hair-cut-women',    category: 'hair', name: 'Haircut & blow-dry',        duration: 60, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'hair-cut-men',      category: 'hair', name: "Men's haircut",             duration: 30, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'hair-cut-child',    category: 'hair', name: "Children's haircut",        duration: 30, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'hair-blow-dry',     category: 'hair', name: 'Blow-dry & styling',        duration: 45, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'hair-wash-style',   category: 'hair', name: 'Wash & finish',             duration: 30, buffer: 10, resource: 'styling-chair', price: null },

    /* ---- 02 Hair Spa & Treatments ---- */
    { id: 'spa-classic',       category: 'hair-spa', name: 'Hair spa',              duration: 60, buffer: 15, resource: 'styling-chair', price: null },
    { id: 'spa-deep',          category: 'hair-spa', name: 'Deep conditioning treatment', duration: 75, buffer: 15, resource: 'styling-chair', price: null },
    { id: 'spa-scalp',         category: 'hair-spa', name: 'Scalp treatment & massage', duration: 45, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'spa-hairfall',      category: 'hair-spa', name: 'Hair-fall care session', duration: 60, buffer: 15, resource: 'styling-chair', price: null },

    /* ---- 03 Makeup & Occasion ---- */
    { id: 'makeup-day',        category: 'makeup', name: 'Day makeup',              duration: 60,  buffer: 15, resource: 'beauty-room', price: null },
    { id: 'makeup-party',      category: 'makeup', name: 'Party & evening makeup',  duration: 90,  buffer: 15, resource: 'beauty-room', price: null },
    { id: 'makeup-occasion',   category: 'makeup', name: 'Occasion makeup',         duration: 120, buffer: 20, resource: 'beauty-room', price: null },
    { id: 'makeup-trial',      category: 'makeup', name: 'Makeup trial',            duration: 75,  buffer: 15, resource: 'beauty-room', price: null },

    /* ---- 04 Nails & Nail Art ---- */
    { id: 'nails-polish',      category: 'nails', name: 'Nail polish application',  duration: 30, buffer: 10, resource: 'nail-station', price: null },
    { id: 'nails-gel',         category: 'nails', name: 'Gel polish',               duration: 60, buffer: 10, resource: 'nail-station', price: null },
    { id: 'nails-extension',   category: 'nails', name: 'Nail extensions',          duration: 120, buffer: 15, resource: 'nail-station', price: null },
    { id: 'nails-art-simple',  category: 'nails', name: 'Nail art — accent nails',  duration: 45, buffer: 10, resource: 'nail-station', price: null },
    { id: 'nails-art-full',    category: 'nails', name: 'Nail art — full set',      duration: 90, buffer: 15, resource: 'nail-station', price: null },

    /* ---- 05 Manicure & Pedicure ---- */
    { id: 'mani-classic',      category: 'hands-feet', name: 'Classic manicure',    duration: 45, buffer: 10, resource: 'nail-station', price: null },
    { id: 'pedi-classic',      category: 'hands-feet', name: 'Classic pedicure',    duration: 60, buffer: 15, resource: 'nail-station', price: null },
    { id: 'mani-pedi',         category: 'hands-feet', name: 'Manicure & pedicure', duration: 105, buffer: 15, resource: 'nail-station', price: null },
    { id: 'pedi-spa',          category: 'hands-feet', name: 'Spa pedicure',        duration: 75, buffer: 15, resource: 'nail-station', price: null },

    /* ---- 06 Waxing & Personal Care ---- */
    { id: 'wax-face',          category: 'waxing', name: 'Face waxing',             duration: 30, buffer: 10, resource: 'beauty-room', price: null },
    { id: 'wax-arms',          category: 'waxing', name: 'Arms waxing',             duration: 30, buffer: 10, resource: 'beauty-room', price: null },
    { id: 'wax-legs',          category: 'waxing', name: 'Legs waxing',             duration: 45, buffer: 10, resource: 'beauty-room', price: null },
    { id: 'wax-full',          category: 'waxing', name: 'Full-body waxing',        duration: 120, buffer: 20, resource: 'beauty-room', price: null },
    { id: 'wax-threading',     category: 'waxing', name: 'Threading',               duration: 20, buffer: 5,  resource: 'beauty-room', price: null },

    /* ---- 07 Grooming & Shaving ---- */
    { id: 'groom-shave',       category: 'grooming', name: 'Shave',                 duration: 30, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'groom-beard',       category: 'grooming', name: 'Beard trim & shaping',  duration: 30, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'groom-cut-beard',   category: 'grooming', name: 'Haircut & beard',       duration: 60, buffer: 10, resource: 'styling-chair', price: null },
    { id: 'groom-facial',      category: 'grooming', name: "Men's clean-up",        duration: 45, buffer: 10, resource: 'beauty-room', price: null },

    /* ---- 08 Tattoo ----
       Only the consultation is bookable online. A session length cannot
       be known before the design is agreed, so offering an online slot
       for "a tattoo" would be offering a slot we cannot honour. */
    { id: 'tattoo-consult',    category: 'tattoo', name: 'Tattoo consultation',     duration: 30, buffer: 10, resource: 'tattoo-studio', price: null },
    // bookable: false must match `bookable` in the services seed in
    // supabase/schema.sql. It is what stops the picker offering a slot
    // the backend would refuse.
    { id: 'tattoo-small',      category: 'tattoo', name: 'Small tattoo session',    duration: 90, buffer: 30, resource: 'tattoo-studio', price: null,
      bookable: false,
      note: 'Book a consultation first — the session is confirmed once the design is agreed.' }
  ];

  var CATALOGUE = {
    resources: RESOURCES,
    categories: CATEGORIES,
    services: SERVICES,

    /* TODO owner: flip to true once the real service timings are
       confirmed. Until then the page never presents a duration as the
       salon's official figure. */
    durationsConfirmed: false,

    byId: function (id) {
      for (var i = 0; i < SERVICES.length; i++) {
        if (SERVICES[i].id === id) return SERVICES[i];
      }
      return null;
    },

    inCategory: function (categoryId) {
      return SERVICES.filter(function (s) { return s.category === categoryId; });
    },

    categoryById: function (id) {
      for (var i = 0; i < CATEGORIES.length; i++) {
        if (CATEGORIES[i].id === id) return CATEGORIES[i];
      }
      return null;
    },

    /* Total minutes this service occupies its resource for. */
    blockMinutes: function (service) {
      var cfg = window.SALON_CONFIG;
      var fallback = (cfg && cfg.scheduling.defaultBufferMinutes) || 0;
      var buffer = typeof service.buffer === 'number' ? service.buffer : fallback;
      return service.duration + buffer;
    }
  };

  window.SALON_CATALOGUE = CATALOGUE;
})();
