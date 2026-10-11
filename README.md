# V Rohit Rai Unisex Salon

Homepage and appointment booking for a unisex salon in Lokhandwala Complex
Market, Andheri West, Mumbai.

Static HTML, CSS and JavaScript with no build step, plus a Postgres backend on
Supabase that owns the booking rules. There is no framework, no bundler and no
`node_modules` — the only runtime dependencies are two Google Fonts and,
optionally, EmailJS.

---

## Run it locally

This machine does not need Node or Python. From the project folder:

```bash
powershell -ExecutionPolicy Bypass -File .\tools\serve.ps1
```

Then open <http://localhost:8080/>. Use `-Port 4000` for a different port, and
Ctrl+C to stop.

Serve it rather than double-clicking `index.html`: the test pages use module
scripts, which browsers refuse on a `file://` origin.

Any other static server works too — the project is just files.

---

## What still needs the owner

Everything below is marked `TODO owner` in `assets/js/config.js`. The site is
built so that an unknown value is simply absent: a missing phone number removes
the phone row, the call button and the `telephone` field in the structured data,
rather than rendering an empty link.

| Item | Where | Status |
|---|---|---|
| Street address | `config.location` | **Confirmed** by the owner, matches the Justdial listing |
| Opening hours (10:00–22:00, daily) | `config.hours` + `supabase/schema.sql` | From the Justdial listing — **please confirm** |
| Phone number | `config.contact.phone` | **Missing.** Four numbers appear on the Justdial page and none could be reliably attributed, so none was used |
| Email address | `config.contact.email` | Missing |
| WhatsApp number | `config.contact.whatsapp` | Missing |
| Prices | `assets/js/catalogue.js` | Missing — no price is shown anywhere |
| Service durations | `assets/js/catalogue.js` + schema seed | **Provisional.** Used for scheduling, labelled "approx." in the UI. Set `durationsConfirmed = true` once real |
| Resource counts | `supabase/schema.sql` seed | Assumed one of each. Add rows for a second chair or nail station |
| Photographs | `config.images`, `config.gallery` | **Supplied** — 9 from the Google Business Profile, 8 in use |
| Live domain | `config.seo.canonical` | Missing, so no canonical or `og:url` is emitted |
| Claims about the premises | `config.claims` | All `false`. Nothing about hygiene, products or payment is asserted |

### Photographs

The photographs in `assets/images/salon/` are the salon's own, taken from its
Google Business Profile. They are stored locally rather than hotlinked, because
Google's `gps-cs-s` URLs are signed and expire. Each was downloaded at full
resolution and resampled to 1200px on the long edge at JPEG quality 82, which
took the set from 3.4 MB to 1.35 MB.

Every one is a photograph of the **premises** — the floor, the stations, the
shelves. None is presented as a finished client result, which is why the gallery
section is headed "The room, as it actually is" and points to Instagram for
finished looks. Keep that distinction if you add more: a photograph of a client's
hair is a claim about results, and the alt text should say whose work it is.

| File | Used as |
|---|---|
| `styling-floor.jpg` | hero |
| `hair-wash-station.jpg` | Hair & Styling card |
| `nail-polish-wall.jpg` | Nails & Nail Art card |
| `towel-warmer.jpg` | Grooming & Shaving card |
| `nail-bar.jpg` | Experience section |
| `nail-station.jpg`, `nail-art-supplies.jpg`, `stylist-at-reception.jpg` | gallery |
| `reception-counter.jpg` | **not used** — see below |

`reception-counter.jpg` was downloaded but left out. It is the most cluttered of
the nine, and it shows a swastika on the counter front. In India that is the
ordinary Hindu auspicious symbol and entirely unremarkable in a shop; on a web
page with an international audience it reads differently to people who do not
know that. The file is in the folder, so put it in `config.gallery` if you want
it.

To change any of this, edit `src`, `alt` and `caption` in `config.images` or
`config.gallery`. Setting `src` to `null` turns that position back into the
designed placeholder plate, so a slot is never broken, only empty.

---

## Connecting the booking system

Until a Supabase project is connected, the booking panel runs in **preview
mode**: it renders a locally-computed grid clearly labelled as a preview, and
the submit button is disabled with an explanation. It never accepts a booking it
cannot store.

1. Create a Supabase project.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`,
   and run it. It is safe to re-run.
3. Copy the project URL and the **anon / public** key from
   **Project Settings → API**.
4. Put them in `assets/js/config.js`:

   ```js
   supabase: {
     url: 'https://xxxxxxxx.supabase.co',
     anonKey: 'eyJhbGciOi...'
   }
   ```

Reload the page; the preview notice disappears and availability comes from the
database.

> The anon key is designed to be public and is safe in this file. The
> **service_role** key must never appear here — it bypasses every rule below.

### Optional: confirmation emails

Fill in `config.email` with EmailJS credentials. Leave it `null` and the booking
still works end to end; the success panel simply says the salon will call to
confirm instead of promising an email that will not arrive.

---

## How double bookings are prevented

> If someone books 5:00 PM, nobody else is offered a time that overlaps it.

Three independent layers, because the browser is never trusted:

1. **An advisory lock.** `create_booking()` takes
   `pg_advisory_xact_lock(resource kind + date)` *before* it looks at
   availability. Two requests for the same chair on the same day are serialised,
   so the second one sees the first one's row and is told the slot is gone.
2. **A database constraint.** `bookings_no_overlap` is an
   `EXCLUDE USING gist (resource_id WITH =, occupies WITH &&)`. Even a write
   that never goes through the function — an admin tool, a psql session — cannot
   create an overlapping active appointment.
3. **Row Level Security.** `public.bookings` has RLS on and **no policy**, and
   all table privileges are revoked from `anon`. The public key cannot read a
   customer's name, phone or email, and cannot insert a row at all. The only way
   in is the four validated functions.

An appointment occupies `[start, end)` where `end = start + duration + buffer`.
Ranges are half-open, so 17:00–18:00 and 18:00–19:00 do not conflict, while
17:00–18:00 and 17:45–18:45 do. The buffer is folded into `end`, which is why a
45-minute service with a 10-minute turnaround starting at 17:00 frees 17:55
rather than 17:45.

Times are stored as `timestamptz` computed from the salon-local date and time in
`Asia/Kolkata`, so a 17:00 appointment is 17:00 in Mumbai regardless of where
the server or the customer is.

### The public API

| Function | Purpose |
|---|---|
| `salon_runtime()` | Settings, opening hours, bookable services and resource counts in one call. The client takes durations from here, never from its own copy |
| `available_slots(service_id, date)` | Every candidate start with `available` and a reason. Returns no customer data — you learn that a time is taken, never by whom |
| `create_booking(...)` | Validates, locks, assigns a free resource, inserts, returns a reference or a reason |
| `cancel_booking(reference, email)` | Releases the slot; the single UPDATE is the commit point |

Server-side validation covers name, phone and email format, whitespace and
control-character stripping, opening hours, the published time grid (so a
crafted 17:07 is refused), lead time, the booking horizon, and a per-email daily
cap. `create_booking` returns a structured reason for every outcome the UI has
to handle.

---

## Tests

Both suites run in the browser against the real code. Start the server, then:

- <http://localhost:8080/tests/availability.html> — **31 tests** over the
  scheduling engine: overlap and adjacency, buffers, differing durations,
  multiple resources, past and lead time, the `Asia/Kolkata` offset, and
  malformed input.
- <http://localhost:8080/tests/schema.html> — **36 tests** that load
  `supabase/schema.sql` into a real Postgres compiled to WebAssembly
  ([PGlite](https://pglite.dev)) and exercise it: the exclusion constraint, RLS
  lockdown, double-booking refusal, stale-slot rejection, cancellation,
  validation, the rate limit, and timezone storage. Needs an internet connection
  the first time to fetch PGlite.

A green bar means every listed test passed; failures are listed with the
expected and actual values.

**Not covered:** PGlite runs a single connection, so genuinely simultaneous
transactions cannot be executed locally. What *is* verified is the mechanism
that makes a real race safe — `create_booking` refuses an already-taken slot,
and the `EXCLUDE` constraint rejects an overlapping row inserted directly. To
test true concurrency, fire two parallel `create_booking` calls at a real
Supabase project.

---

## Project layout

```
index.html                  the homepage
assets/css/salon.css        design system: tokens, components, motion
assets/js/config.js         business facts and integration keys  <- edit this
assets/js/catalogue.js      service categories, durations, resources
assets/js/availability.js   pure scheduling engine (no DOM, no network)
assets/js/site.js           config binding, gallery, drawer, toasts
assets/js/booking.js        the booking flow
assets/js/motion.js         reveals, header dock, scroll-linked rule
supabase/schema.sql         tables, constraints, RLS, functions, seed
tools/serve.ps1             dependency-free static server
tests/                      the two suites above
```

`config.js` and `catalogue.js` are data. `availability.js` is logic with no side
effects. Nothing in `motion.js` can affect whether a booking succeeds.

---

## Left over from the previous template

This project was built on top of a German salon template (Beauty Glanz, Kassel).
The original files are preserved in `_original-beautyglanz/` for reference.

**Delete these before deploying.** They are unrelated to this business and some
contain the other salon's credentials:

- `admin.html`, `assets/js/admin.js` — an admin panel for the old schema,
  pointing at the other salon's Supabase project
- `assets/js/main.js`, `assets/js/lux.js`, `assets/css/style.css`,
  `index.original.html`, `assets/css/style.original.css`
- `agb.html`, `datenschutz.html`, `impressum.html` — German legal pages that do
  not apply in India
- `supabase.min.js`, `emailjs.min.js`, `supabase_procedures.sql`
- `favicon.ico` and everything under `assets/images/` **except
  `assets/images/salon/`** — the other salon's photographs and logo. The new
  site uses only `assets/images/salon/`.
- `_original-beautyglanz/` itself

None of them are referenced by the new homepage.

---

## Notes on decisions

- **No language switcher.** The original carried German, Russian and English.
  The brief asks for English throughout, and three languages of invented copy
  would be three things to keep true.
- **No smooth-scroll library.** The original used Lenis. Native
  `scroll-behavior` plus `scroll-margin-top` gets the same result without
  intercepting the wheel, which keeps scrolling predictable and costs nothing on
  mobile.
- **No Tailwind CDN.** The CDN build compiles stylesheets in the browser on
  every load. The design system is hand-written CSS with tokens instead.
- **No Supabase JS client.** Three RPC calls are three `fetch` POSTs to
  PostgREST, which keeps about 150 KB of library out of the page.
- **No cookie banner.** The site sets no cookies and loads no analytics, so
  there is nothing to ask consent for. If analytics is added later, the banner
  comes back with it.
- **Tattoo sessions are not bookable online.** A session length cannot be known
  before the design is agreed, so only the consultation takes an online slot.
