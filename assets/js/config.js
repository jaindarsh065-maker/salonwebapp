/* ============================================================
   V ROHIT RAI UNISEX SALON — single source of truth
   ------------------------------------------------------------
   Everything the owner can change without touching a component
   lives here. Two rules the rest of the site depends on:

     1. `null` means "we do not know this yet".
        Every renderer SKIPS a null value — the row, the link or
        the whole block simply does not appear, and no invented
        fact is ever shown to a customer or to Google.

     2. A string is treated as verified and WILL be published,
        including into the structured data in index.html.
        Do not put a guess in a string.

   Search for TODO to find everything still waiting on the owner.
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = {

    /* ---------- Identity ---------- */
    brand: {
      name: 'V Rohit Rai Unisex Salon',
      shortName: 'V Rohit Rai',
      // Used in the browser tab, the wordmark and the footer.
      monogram: 'VR',
      // Owner-provided. Shown as "owner / founder", never as a claim
      // about qualifications we cannot verify.
      ownerName: 'Rohit Rai',
      ownerRole: 'Founder'
    },

    /* ---------- Location ----------
       city/region are confirmed. street/postalCode/mapQuery stay null
       until the owner confirms the address: a null street means the
       contact block shows the city only, the map is not rendered, and
       the LocalBusiness structured data omits the postal address
       entirely rather than publishing a half-address. */
    location: {
      city: 'Mumbai',
      region: 'Maharashtra',
      country: 'India',
      countryCode: 'IN',

      /* VERIFIED. Supplied by the owner from the salon's Google
         Business Profile, and independently matching the salon's own
         claimed Justdial listing word for word. */
      street: 'Shop No. 2, Shiv Sadan Building, Lokhandwala Complex Market',
      area: 'Andheri West',
      postalCode: '400053',
      landmark: "Next to McDonald's",

      // Drives the embedded map. Derived from the address above, so if
      // the address changes this follows it.
      mapQuery: 'Rohit Rai Unisex Salon, Shiv Sadan Building, Lokhandwala Complex Market, Andheri West, Mumbai, Maharashtra 400053',

      // TODO owner: only fill these in from the real address. Publishing
      // guessed coordinates in structured data is worse than none.
      latitude: null,
      longitude: null
    },

    /* ---------- Contact ----------
       Each null link is dropped from the header, booking panel,
       contact block, footer and mobile action bar automatically. */
    contact: {
      phone: null,           // TODO owner: E.164, e.g. '+919820000000'
      phoneDisplay: null,    // TODO owner: e.g. '+91 98200 00000'
      whatsapp: null,        // TODO owner: digits only, e.g. '919820000000'
      email: null,           // TODO owner: e.g. 'hello@vrohitrai.com'
      instagram: 'https://www.instagram.com/rohit.rai10',
      instagramHandle: '@rohit.rai10',
      // Owner-provided figure. Rendered with the wording "as of today"
      // and never as an independently audited number.
      instagramFollowers: '26K'
    },

    /* ---------- Opening hours ----------
       `null` = the salon has not confirmed hours yet. The hours row and
       the openingHoursSpecification in structured data are both omitted
       while this is null.

       When the owner confirms, replace with an array of 7 entries,
       index 0 = Monday … index 6 = Sunday. Each entry is either null
       (closed) or { open: 'HH:MM', close: 'HH:MM' } in salon-local time.
       The booking engine reads THIS — it is not a second copy of the
       hours, it is the hours.

       Example:
         hours: [
           { open: '10:00', close: '20:00' },  // Mon
           ...
           null                                // Sun — closed
         ]
    */
    /* CONFIRM BEFORE LAUNCH — 10:00 to 22:00, all seven days, from the
       salon's claimed Justdial listing. The address next to it has been
       confirmed by the owner; these hours have NOT been, so check them
       against the Google Business Profile. If the salon has a weekly
       day off, set that entry to null and the booking calendar stops
       offering it, with no other change needed. */
    hours: [
      { open: '10:00', close: '22:00' },  // Monday
      { open: '10:00', close: '22:00' },  // Tuesday
      { open: '10:00', close: '22:00' },  // Wednesday
      { open: '10:00', close: '22:00' },  // Thursday
      { open: '10:00', close: '22:00' },  // Friday
      { open: '10:00', close: '22:00' },  // Saturday
      { open: '10:00', close: '22:00' }   // Sunday
    ],

    /* Fallback used ONLY to keep the booking grid functional if `hours`
       is ever set back to null. The UI labels slots as provisional
       whenever this is what is in use. */
    provisionalHours: { open: '10:00', close: '20:00' },

    /* ---------- Scheduling rules ---------- */
    scheduling: {
      // Mumbai. Every date and time in the booking flow is interpreted
      // in this zone, on the client and in Postgres.
      timeZone: 'Asia/Kolkata',
      // Granularity of offered start times, in minutes. 15 lets a
      // 45-minute service start at 10:45 instead of wasting a slot.
      slotStepMinutes: 15,
      // Earliest a customer may book from "now".
      leadTimeMinutes: 60,
      // How far ahead the calendar opens.
      horizonDays: 45,
      // Default turnaround between two appointments on the same chair.
      // Per-service overrides live in catalogue.js.
      defaultBufferMinutes: 10
    },

    /* ---------- Booking backend ----------
       TODO owner: create a Supabase project, run supabase/schema.sql in
       the SQL editor, then paste the project URL and the anon public key
       here. The anon key is designed to be public; the service_role key
       must NEVER appear in this file.

       While either value is null the booking panel renders a clear
       "online booking not connected yet" state with the phone and
       WhatsApp fallbacks — it never pretends to take a booking. */
    supabase: {
      url: null,             // TODO owner: 'https://xxxxxxxx.supabase.co'
      anonKey: null          // TODO owner: the anon / public key
    },

    /* ---------- Confirmation email (optional) ----------
       EmailJS sends the customer and owner confirmations straight from
       the browser. Leave null to skip email entirely: the booking is
       still stored and confirmed on screen, and the success panel says
       the salon will confirm by phone instead of promising an email
       that will never arrive. */
    email: {
      serviceId: null,       // TODO owner (optional)
      templateCustomer: null,
      templateOwner: null,
      publicKey: null,
      ownerAddress: null
    },

    /* ---------- Photography ----------
       The salon's own photographs, supplied by the owner from the
       Google Business Profile and stored locally rather than hotlinked
       (Google's gps-cs-s URLs are signed and expire).

       Every key here must match a `data-plate` attribute in index.html.
       Setting `src` to null turns that position back into the designed
       placeholder plate, so a slot is never broken, only empty.

       These are photographs of the premises. None of them is presented
       as a finished client result, and the alt text describes exactly
       what is in frame. */
    images: {
      hero: {
        src: 'assets/images/salon/styling-floor.jpg',
        alt: 'The styling floor at V Rohit Rai Unisex Salon: a row of black styling chairs along a full-length mirror, with pedicure chairs at the far end',
        caption: 'The floor'
      },
      // Sits on the Hair & Styling service card.
      statement: {
        src: 'assets/images/salon/hair-wash-station.jpg',
        alt: 'The hair wash station: two reclining basins with towels laid out, and professional shampoo and conditioner on the shelf above',
        caption: 'Wash station'
      },
      // Nails & Nail Art service card.
      nails: {
        src: 'assets/images/salon/nail-polish-wall.jpg',
        alt: 'A wall-mounted rack holding five rows of gel polish bottles at the nail station',
        caption: 'The polish wall'
      },
      // Grooming & Shaving service card.
      grooming: {
        src: 'assets/images/salon/towel-warmer.jpg',
        alt: 'A UV towel warmer on a shelf beside a styling trolley with a hairdryer and clippers',
        caption: 'Hot towels'
      },
      // The dark Experience section.
      interior: {
        src: 'assets/images/salon/nail-bar.jpg',
        alt: 'The nail bar: a manicure table with a curing lamp, set below the salon\'s wall of gel polish',
        caption: 'The nail bar'
      }
    },

    /* Gallery slots. Each is a captioned plate until `src` is filled.
       Captions describe the intended subject so the owner knows which
       photograph belongs in which frame. */
    gallery: [
      {
        src: 'assets/images/salon/nail-station.jpg',
        alt: 'The manicure table with a curing lamp and brushes, below a lit glass cabinet of nail art supplies',
        caption: 'Nail station',
        span: 'tall'
      },
      {
        src: 'assets/images/salon/nail-art-supplies.jpg',
        alt: 'Close view of the nail art cabinet: trays of glitters, foils, rhinestones and coloured powders',
        caption: 'Nail art shelf',
        span: 'wide'
      },
      {
        src: 'assets/images/salon/stylist-at-reception.jpg',
        alt: 'A stylist working at the salon reception desk, with practice hands and a training head on the counter behind',
        caption: 'Reception',
        span: 'normal'
      }
      /* Room for more: add { src, alt, caption, span } and a cell
         appears. `span` is 'tall', 'wide' or 'normal'. */
    ],

    /* ---------- Things we deliberately do not claim ----------
       Set to true ONLY when the owner confirms each one. Every entry is
       a factual claim about the premises or the business, and the
       Experience section renders only the confirmed ones. */
    claims: {
      consultationBeforeService: false,  // TODO owner
      singleUseDisposables: false,       // TODO owner
      sterilisedTools: false,            // TODO owner
      brandedProducts: null,             // TODO owner: e.g. 'L\'Oréal, Olaplex'
      cardPayments: false,               // TODO owner
      upiPayments: false,                // TODO owner
      homeService: false,                // TODO owner
      parking: false                     // TODO owner
    },

    /* ---------- Legal pages ----------
       Footer links appear only when a real page exists. The German
       Impressum / AGB / Datenschutz files shipped with the original
       template do NOT apply to a Mumbai salon and are not linked. */
    legal: {
      privacy: null,         // TODO owner: '/privacy.html'
      terms: null            // TODO owner
    },

    /* ---------- SEO ---------- */
    seo: {
      // TODO owner: set once the domain is live. Until then no canonical
      // or og:url is emitted, which is safer than pointing at a guess.
      canonical: null,
      title: 'V Rohit Rai Unisex Salon — Hair, Beauty & Nails in Mumbai',
      description: 'Unisex hair and beauty studio in Mumbai. Haircuts, colour, hair spa, nail art, manicure and pedicure, makeup, waxing and grooming — book an appointment online.'
    }
  };

  /* A string that is still a template placeholder counts as unknown.
     Guards against 'TODO', 'xxx', 'your-...' ending up on the page. */
  var PLACEHOLDER = /^\s*(todo|tbd|xxx+|changeme|your[-_ ])/i;

  CONFIG.has = function (path) {
    var value = path.split('.').reduce(function (acc, key) {
      return (acc === null || acc === undefined) ? null : acc[key];
    }, CONFIG);
    if (value === null || value === undefined || value === false) return false;
    if (typeof value === 'string') return value.trim() !== '' && !PLACEHOLDER.test(value);
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };

  CONFIG.get = function (path, fallback) {
    return CONFIG.has(path)
      ? path.split('.').reduce(function (acc, key) { return acc[key]; }, CONFIG)
      : (fallback === undefined ? null : fallback);
  };

  /* True once a real Supabase project is wired up. The booking panel
     branches on this instead of guessing from a failed network call. */
  CONFIG.bookingIsLive = function () {
    return CONFIG.has('supabase.url') && CONFIG.has('supabase.anonKey');
  };

  CONFIG.emailIsLive = function () {
    return CONFIG.has('email.serviceId') &&
           CONFIG.has('email.publicKey') &&
           CONFIG.has('email.templateCustomer');
  };

  /* Effective hours for a weekday (0 = Monday). Returns null when the
     salon is closed that day. Falls back to provisional hours, and
     reports which of the two it used so the UI can say so. */
  CONFIG.hoursFor = function (weekdayMondayFirst) {
    if (CONFIG.has('hours')) {
      var day = CONFIG.hours[weekdayMondayFirst];
      return day ? { open: day.open, close: day.close, provisional: false } : null;
    }
    var p = CONFIG.provisionalHours;
    return { open: p.open, close: p.close, provisional: true };
  };

  window.SALON_CONFIG = CONFIG;
})();
