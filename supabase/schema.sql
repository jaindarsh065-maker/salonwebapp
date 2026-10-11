-- ============================================================
-- V ROHIT RAI UNISEX SALON — booking backend
-- ------------------------------------------------------------
-- Run once in Supabase -> SQL Editor -> New query -> Run.
-- Safe to re-run: every object is created with IF NOT EXISTS or
-- CREATE OR REPLACE, and the seed data upserts.
--
-- WHAT GUARANTEES EXCLUSIVITY
-- Three independent layers, because the frontend is not allowed to be
-- the source of truth:
--
--   1. public.create_booking() takes a transaction-scoped advisory
--      lock on (resource kind, local date) before it looks at
--      availability. Two concurrent requests for the same chair on the
--      same day are serialised; the second one sees the first one's
--      row and is told the slot is gone.
--   2. bookings_no_overlap is an EXCLUDE ... USING gist constraint.
--      Even if a booking is inserted by some other path — an admin
--      tool, a psql session, a future API — Postgres itself refuses an
--      overlapping active appointment on the same resource.
--   3. Row Level Security is on for public.bookings with no policy for
--      the anon role, and all table privileges are revoked. The public
--      key cannot read a customer's name, phone or email, and cannot
--      insert a row except through the validated function.
--
-- Overlap uses half-open ranges '[)', so 17:00-18:00 and 18:00-19:00
-- do not conflict, while 17:00-18:00 and 17:45-18:45 do. A service's
-- turnaround buffer is folded into ends_at, so a 45-minute service
-- with a 10-minute buffer starting at 17:00 frees 17:55, not 17:45.
-- ============================================================

-- gist support for '=' on the text resource_id inside the exclusion
-- constraint. Available on Supabase; part of contrib elsewhere.
create extension if not exists btree_gist;

-- Supabase always has these roles. Created here only so that this file
-- also runs unchanged against a plain Postgres (which is how the
-- automated tests exercise it).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end
$$;


-- ============================================================
-- 1. CONFIGURATION TABLES
-- ============================================================

-- Single-row table. The `id boolean primary key check (id)` trick makes
-- a second row impossible, so there is never an ambiguous settings set.
create table if not exists public.salon_settings (
  id                        boolean primary key default true check (id),
  time_zone                 text    not null default 'Asia/Kolkata',
  slot_step_minutes         integer not null default 15  check (slot_step_minutes between 5 and 120),
  lead_time_minutes         integer not null default 60  check (lead_time_minutes >= 0),
  horizon_days              integer not null default 45  check (horizon_days between 1 and 365),
  -- Cheap abuse brake: how many live bookings one email may hold for a
  -- single day. Real rate limiting belongs at the edge (see README).
  max_live_per_email_per_day integer not null default 3  check (max_live_per_email_per_day between 1 and 50)
);

insert into public.salon_settings (id) values (true) on conflict (id) do nothing;

-- Weekday 0 = Monday ... 6 = Sunday, matching availability.js.
-- A row with null opens/closes means closed that day.
create table if not exists public.opening_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  opens   time,
  closes  time,
  constraint opening_hours_ordered
    check (opens is null or closes is null or closes > opens)
);

-- The exclusive things an appointment can occupy. `kind` groups
-- interchangeable units: two styling chairs are two rows of the same
-- kind, and the booking function will fill the first free one.
create table if not exists public.resources (
  id     text primary key,
  kind   text    not null,
  label  text    not null,
  active boolean not null default true,
  sort   smallint not null default 0
);

create index if not exists resources_kind_idx on public.resources (kind) where active;

create table if not exists public.services (
  id               text primary key,
  category_id      text not null,
  name             text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  buffer_minutes   integer not null default 10 check (buffer_minutes between 0 and 240),
  resource_kind    text not null,
  bookable         boolean not null default true,
  sort             smallint not null default 0
);

-- Holidays, breaks, and "this chair is out of action on Thursday".
-- resource_id null closes the whole salon for that range.
create table if not exists public.closures (
  id          uuid primary key default gen_random_uuid(),
  resource_id text references public.resources (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  reason      text,
  occupies    tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  constraint closures_ordered check (ends_at > starts_at)
);

create index if not exists closures_occupies_idx on public.closures using gist (occupies);


-- ============================================================
-- 2. BOOKINGS
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum
      ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
  end if;
end
$$;

create table if not exists public.bookings (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  service_id       text not null references public.services (id),
  resource_id      text not null references public.resources (id),

  -- starts_at .. ends_at is what the resource is BLOCKED for and
  -- includes the turnaround buffer.
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  -- service_ends_at is what the customer is told, buffer excluded.
  service_ends_at  timestamptz not null,

  -- Snapshot of the rules at booking time, so changing a service's
  -- duration next month does not silently rewrite history.
  duration_minutes integer not null,
  buffer_minutes   integer not null,

  status           public.booking_status not null default 'pending',
  customer_name    text not null,
  customer_phone   text not null,
  customer_email   text not null,
  notes            text,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,

  occupies tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,

  constraint bookings_ordered check (
    ends_at > starts_at and
    service_ends_at > starts_at and
    service_ends_at <= ends_at
  )
);

-- Layer 2 of the exclusivity guarantee. Cancelled appointments are
-- excluded from the constraint, which is exactly what "cancelling
-- releases the slot" means at the storage level.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bookings_no_overlap'
  ) then
    alter table public.bookings
      add constraint bookings_no_overlap
      exclude using gist (resource_id with =, occupies with &&)
      where (status <> 'cancelled');
  end if;
end
$$;

create index if not exists bookings_lookup_idx
  on public.bookings (resource_id, starts_at) where status <> 'cancelled';
create index if not exists bookings_email_idx
  on public.bookings (lower(customer_email), starts_at);


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

alter table public.salon_settings enable row level security;
alter table public.opening_hours  enable row level security;
alter table public.resources      enable row level security;
alter table public.services       enable row level security;
alter table public.closures       enable row level security;
alter table public.bookings       enable row level security;

-- Reference data is readable. None of it is personal.
do $$
declare t text;
begin
  foreach t in array array['salon_settings', 'opening_hours', 'resources', 'services', 'closures']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_read', t
    );
  end loop;
end
$$;

-- bookings: deliberately NO policy. RLS with no policy denies every
-- row to anon, so customer details cannot leak through the public key,
-- and a direct insert cannot bypass create_booking()'s validation.
revoke all on public.bookings from anon, authenticated;

-- Reference data is read-only to the public key; writes go through the
-- Supabase dashboard or the service_role key.
revoke all on public.salon_settings, public.opening_hours, public.resources,
               public.services, public.closures
  from anon, authenticated;
grant select on public.salon_settings, public.opening_hours, public.resources,
                public.services, public.closures
  to anon, authenticated;


-- ============================================================
-- 4. HELPERS
-- ============================================================

-- 'now' as a naive local timestamp in the salon's own city.
create or replace function public.salon_local_now()
returns timestamp
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone (select time_zone from public.salon_settings where id));
$$;

-- Normalise and validate a phone number. Returns null when unusable,
-- which the caller turns into a rejection.
create or replace function public.clean_phone(p_raw text)
returns text
language plpgsql
immutable
as $$
declare v text;
begin
  if p_raw is null then return null; end if;
  -- Keep a leading + and the digits; drop spaces, dashes, brackets.
  v := regexp_replace(p_raw, '[^0-9+]', '', 'g');
  v := regexp_replace(v, '(?<=.)\+', '', 'g');  -- only a leading +
  if v !~ '^\+?[0-9]{7,15}$' then return null; end if;
  return v;
end
$$;

-- Strip control characters and collapse whitespace. Storage hygiene;
-- the frontend still renders everything as text, never as HTML.
create or replace function public.clean_text(p_raw text, p_max integer)
returns text
language plpgsql
immutable
as $$
declare v text;
begin
  if p_raw is null then return null; end if;
  v := regexp_replace(p_raw, '[\u0000-\u001F\u007F]', ' ', 'g');
  v := btrim(regexp_replace(v, '\s+', ' ', 'g'));
  if v = '' then return null; end if;
  return left(v, p_max);
end
$$;


-- ============================================================
-- 5. PUBLIC API
-- ============================================================

-- Everything the booking UI needs to render itself, in one round trip.
-- Durations and opening hours come from here rather than from the
-- client's own copy, so the grid can never offer a length the backend
-- will not honour.
create or replace function public.salon_runtime()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'settings', (
      select jsonb_build_object(
        'timeZone', time_zone,
        'slotStepMinutes', slot_step_minutes,
        'leadTimeMinutes', lead_time_minutes,
        'horizonDays', horizon_days
      ) from public.salon_settings where id
    ),
    'localNow', to_char(public.salon_local_now(), 'YYYY-MM-DD"T"HH24:MI'),
    'hours', coalesce((
      select jsonb_object_agg(weekday::text,
               case when opens is null or closes is null then null
                    else jsonb_build_object('open', to_char(opens, 'HH24:MI'),
                                            'close', to_char(closes, 'HH24:MI'))
               end)
      from public.opening_hours
    ), '{}'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'name', name, 'category', category_id,
               'duration', duration_minutes, 'buffer', buffer_minutes,
               'resource', resource_kind
             ) order by sort, name)
      from public.services where bookable
    ), '[]'::jsonb),
    'resourceCounts', coalesce((
      select jsonb_object_agg(kind, n)
      from (select kind, count(*)::int as n from public.resources
            where active group by kind) q
    ), '{}'::jsonb)
  );
$$;


-- Start times for one service on one salon-local date.
--
-- Returns EVERY candidate start inside opening hours with a flag and a
-- reason, so the UI can show "5:00 PM — already booked" as a disabled
-- control instead of silently omitting it. It returns no customer data
-- whatsoever: a caller learns that a time is taken, never by whom.
create or replace function public.available_slots(
  p_service_id text,
  p_date       date
)
returns table (slot_time time, available boolean, reason text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_set      public.salon_settings;
  v_service  public.services;
  v_hours    public.opening_hours;
  v_tz       text;
  v_local_now timestamp;
  v_day_open  timestamptz;
  v_day_close timestamptz;
  v_last_start timestamptz;
  v_cursor    timestamptz;
  v_block     interval;
  v_earliest  timestamptz;
  v_free      integer;
begin
  if p_date is null then
    raise exception 'invalid_date' using errcode = '22023';
  end if;

  select * into v_set from public.salon_settings where id;
  v_tz := v_set.time_zone;

  select * into v_service
    from public.services
   where id = p_service_id and bookable;
  if not found then
    -- Unknown or non-bookable service is a caller error, not an
    -- empty day: fail loudly so a typo cannot look like "fully booked".
    raise exception 'unknown_service: %', coalesce(p_service_id, '(null)')
      using errcode = '22023';
  end if;

  v_local_now := public.salon_local_now();

  -- Outside the booking window: no rows.
  if p_date > (v_local_now::date + v_set.horizon_days) then
    return;
  end if;

  select * into v_hours
    from public.opening_hours
   where weekday = (extract(isodow from p_date)::int - 1);

  -- No row, or a row with no times, means closed.
  if not found or v_hours.opens is null or v_hours.closes is null then
    return;
  end if;

  v_day_open  := (p_date + v_hours.opens)  at time zone v_tz;
  v_day_close := (p_date + v_hours.closes) at time zone v_tz;

  -- The treatment must finish by closing time. Its turnaround buffer is
  -- allowed to run past close — staff tidying up is not a reason to
  -- refuse the last appointment of the day.
  v_last_start := v_day_close - make_interval(mins => v_service.duration_minutes);
  v_block := make_interval(mins => v_service.duration_minutes + v_service.buffer_minutes);
  v_earliest := now() + make_interval(mins => v_set.lead_time_minutes);

  v_cursor := v_day_open;
  while v_cursor <= v_last_start loop
    slot_time := (v_cursor at time zone v_tz)::time;

    if v_cursor < v_earliest then
      available := false;
      reason := 'past';
    else
      select count(*) into v_free
        from public.resources r
       where r.kind = v_service.resource_kind
         and r.active
         and not exists (
           select 1 from public.bookings b
            where b.resource_id = r.id
              and b.status <> 'cancelled'
              and b.occupies && tstzrange(v_cursor, v_cursor + v_block, '[)')
         )
         and not exists (
           select 1 from public.closures c
            where (c.resource_id is null or c.resource_id = r.id)
              and c.occupies && tstzrange(v_cursor, v_cursor + v_block, '[)')
         );

      available := v_free > 0;
      reason := case when v_free > 0 then null else 'booked' end;
    end if;

    return next;
    v_cursor := v_cursor + make_interval(mins => v_set.slot_step_minutes);
  end loop;
end
$$;


-- Atomically reserve a slot.
--
-- Returns jsonb for every outcome the UI has to handle, so there is one
-- code path on the client:
--   { ok: true,  reference, startsAt, endsAt, serviceMinutes, resource }
--   { ok: false, reason: 'slot_taken' | 'closed' | 'past' | 'off_grid'
--                        | 'outside_window' | 'invalid_name'
--                        | 'invalid_phone' | 'invalid_email'
--                        | 'too_many_live_bookings',
--     message }
-- An unknown service id raises, because that is a bug or an attack,
-- not something a customer can fix by picking another time.
create or replace function public.create_booking(
  p_service_id text,
  p_date       date,
  p_time       time,
  p_name       text,
  p_phone      text,
  p_email      text,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_set       public.salon_settings;
  v_service   public.services;
  v_hours     public.opening_hours;
  v_tz        text;
  v_local_now timestamp;
  v_starts    timestamptz;
  v_ends      timestamptz;
  v_svc_ends  timestamptz;
  v_day_open  timestamptz;
  v_day_close timestamptz;
  v_name      text;
  v_phone     text;
  v_email     text;
  v_notes     text;
  v_resource  public.resources;
  v_reference text;
  v_live      integer;
  v_minutes   integer;
  v_attempt   integer := 0;
begin
  select * into v_set from public.salon_settings where id;
  v_tz := v_set.time_zone;

  select * into v_service
    from public.services
   where id = p_service_id and bookable;
  if not found then
    raise exception 'unknown_service: %', coalesce(p_service_id, '(null)')
      using errcode = '22023';
  end if;

  if p_date is null or p_time is null then
    return jsonb_build_object('ok', false, 'reason', 'off_grid',
                              'message', 'Pick a date and a time.');
  end if;

  -- ---- input validation ----
  v_name := public.clean_text(p_name, 80);
  if v_name is null or length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name',
                              'message', 'Please enter your name.');
  end if;

  v_phone := public.clean_phone(p_phone);
  if v_phone is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_phone',
                              'message', 'Please enter a phone number we can reach you on.');
  end if;

  v_email := lower(public.clean_text(p_email, 160));
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email',
                              'message', 'Please check the email address.');
  end if;

  v_notes := public.clean_text(p_notes, 500);

  -- ---- scheduling rules ----
  v_local_now := public.salon_local_now();

  if p_date > (v_local_now::date + v_set.horizon_days) then
    return jsonb_build_object('ok', false, 'reason', 'outside_window',
                              'message', 'That date is further ahead than we currently take bookings.');
  end if;

  select * into v_hours
    from public.opening_hours
   where weekday = (extract(isodow from p_date)::int - 1);
  if not found or v_hours.opens is null or v_hours.closes is null then
    return jsonb_build_object('ok', false, 'reason', 'closed',
                              'message', 'The salon is closed that day.');
  end if;

  v_day_open  := (p_date + v_hours.opens)  at time zone v_tz;
  v_day_close := (p_date + v_hours.closes) at time zone v_tz;

  v_starts   := (p_date + p_time) at time zone v_tz;
  v_svc_ends := v_starts + make_interval(mins => v_service.duration_minutes);
  v_ends     := v_svc_ends + make_interval(mins => v_service.buffer_minutes);

  if v_starts < v_day_open or v_svc_ends > v_day_close then
    return jsonb_build_object('ok', false, 'reason', 'closed',
                              'message', 'That time is outside opening hours for this service.');
  end if;

  -- Must sit on the published grid. Stops a crafted request from
  -- wedging an appointment at 17:07 and fragmenting the day.
  v_minutes := (extract(hour from p_time)::int * 60 + extract(minute from p_time)::int)
               - (extract(hour from v_hours.opens)::int * 60 + extract(minute from v_hours.opens)::int);
  if extract(second from p_time)::int <> 0
     or v_minutes < 0
     or (v_minutes % v_set.slot_step_minutes) <> 0 then
    return jsonb_build_object('ok', false, 'reason', 'off_grid',
                              'message', 'Please pick one of the offered times.');
  end if;

  if v_starts < now() + make_interval(mins => v_set.lead_time_minutes) then
    return jsonb_build_object('ok', false, 'reason', 'past',
                              'message', 'That time has passed. Please pick a later slot.');
  end if;

  -- ---- cheap abuse brake ----
  select count(*) into v_live
    from public.bookings
   where lower(customer_email) = v_email
     and status <> 'cancelled'
     and (starts_at at time zone v_tz)::date = p_date;
  if v_live >= v_set.max_live_per_email_per_day then
    return jsonb_build_object('ok', false, 'reason', 'too_many_live_bookings',
                              'message', 'There are already several appointments on that email for this day. Please call us instead.');
  end if;

  -- ---- LAYER 1: serialise everyone competing for this kind of
  -- resource on this date. Transaction-scoped, so it is released on
  -- commit or rollback without any cleanup path. ----
  perform pg_advisory_xact_lock(
    hashtextextended(v_service.resource_kind || '|' || p_date::text, 0)
  );

  -- First free unit of the required kind, lowest sort first, so a
  -- second chair is only used once the first is genuinely busy.
  select r.* into v_resource
    from public.resources r
   where r.kind = v_service.resource_kind
     and r.active
     and not exists (
       select 1 from public.bookings b
        where b.resource_id = r.id
          and b.status <> 'cancelled'
          and b.occupies && tstzrange(v_starts, v_ends, '[)')
     )
     and not exists (
       select 1 from public.closures c
        where (c.resource_id is null or c.resource_id = r.id)
          and c.occupies && tstzrange(v_starts, v_ends, '[)')
     )
   order by r.sort, r.id
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'slot_taken',
                              'message', 'That time was just taken. Please choose another.');
  end if;

  -- ---- insert, with LAYER 2 catching anything the lock did not ----
  loop
    v_attempt := v_attempt + 1;
    v_reference := 'VRR-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into public.bookings (
        reference, service_id, resource_id,
        starts_at, ends_at, service_ends_at,
        duration_minutes, buffer_minutes,
        customer_name, customer_phone, customer_email, notes
      ) values (
        v_reference, v_service.id, v_resource.id,
        v_starts, v_ends, v_svc_ends,
        v_service.duration_minutes, v_service.buffer_minutes,
        v_name, v_phone, v_email, v_notes
      );
      exit;
    exception
      when exclusion_violation then
        -- The resource was taken between the lock and the insert, or by
        -- a writer that never took the lock. Either way: not ours.
        return jsonb_build_object('ok', false, 'reason', 'slot_taken',
                                  'message', 'That time was just taken. Please choose another.');
      when unique_violation then
        -- Reference collision only. Retry with a fresh one.
        if v_attempt >= 5 then raise; end if;
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'reference', v_reference,
    'startsAt', to_char(v_starts at time zone v_tz, 'YYYY-MM-DD"T"HH24:MI'),
    'endsAt', to_char(v_svc_ends at time zone v_tz, 'YYYY-MM-DD"T"HH24:MI'),
    'serviceMinutes', v_service.duration_minutes,
    'resource', v_resource.label,
    'status', 'pending'
  );
end
$$;


-- Cancel by reference + the email it was booked with. The single UPDATE
-- is the commit point, so availability is released only once the
-- cancellation is durable.
create or replace function public.cancel_booking(
  p_reference text,
  p_email     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where reference = upper(btrim(coalesce(p_reference, '')))
     and lower(customer_email) = lower(btrim(coalesce(p_email, '')))
     and status <> 'cancelled';
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_found',
                              'message', 'No live appointment matches that reference and email.');
  end if;
  return jsonb_build_object('ok', true);
end
$$;


-- Only these four functions are reachable with the public key.
revoke all on function public.salon_runtime()                         from public;
revoke all on function public.available_slots(text, date)             from public;
revoke all on function public.create_booking(text, date, time, text, text, text, text) from public;
revoke all on function public.cancel_booking(text, text)              from public;
revoke all on function public.salon_local_now()                       from public;

grant execute on function public.salon_runtime()             to anon, authenticated;
grant execute on function public.available_slots(text, date) to anon, authenticated;
grant execute on function public.create_booking(text, date, time, text, text, text, text)
  to anon, authenticated;
grant execute on function public.cancel_booking(text, text)  to anon, authenticated;


-- ============================================================
-- 6. SEED
-- ------------------------------------------------------------
-- Mirrors assets/js/catalogue.js. Durations are provisional scheduling
-- defaults, not the salon's published timings — update both here and in
-- catalogue.js when the owner confirms them.
--
-- Opening hours: 10:00-22:00 every day, taken from the salon's own
-- claimed Justdial listing. Must match assets/js/config.js `hours`.
-- If the salon has a weekly day off, set that weekday's times to null.
-- ============================================================

insert into public.opening_hours (weekday, opens, closes) values
  (0, '10:00', '22:00'),
  (1, '10:00', '22:00'),
  (2, '10:00', '22:00'),
  (3, '10:00', '22:00'),
  (4, '10:00', '22:00'),
  (5, '10:00', '22:00'),
  (6, '10:00', '22:00')
on conflict (weekday) do update set
  opens = excluded.opens, closes = excluded.closes;

-- TODO owner: confirm how many of each the salon actually has, then add
-- rows (e.g. 'styling-chair-2') to let two of that service run at once.
insert into public.resources (id, kind, label, sort) values
  ('styling-chair-1', 'styling-chair', 'Styling chair', 1),
  ('beauty-room-1',   'beauty-room',   'Beauty room',   1),
  ('nail-station-1',  'nail-station',  'Nail station',  1),
  ('tattoo-studio-1', 'tattoo-studio', 'Tattoo studio', 1)
on conflict (id) do nothing;

insert into public.services
  (id, category_id, name, duration_minutes, buffer_minutes, resource_kind, bookable, sort) values
  ('hair-cut-women',  'hair',        'Haircut & blow-dry',             60,  10, 'styling-chair', true, 1),
  ('hair-cut-men',    'hair',        'Men''s haircut',                 30,  10, 'styling-chair', true, 2),
  ('hair-cut-child',  'hair',        'Children''s haircut',            30,  10, 'styling-chair', true, 3),
  ('hair-blow-dry',   'hair',        'Blow-dry & styling',             45,  10, 'styling-chair', true, 4),
  ('hair-wash-style', 'hair',        'Wash & finish',                  30,  10, 'styling-chair', true, 5),

  ('spa-classic',     'hair-spa',    'Hair spa',                       60,  15, 'styling-chair', true, 1),
  ('spa-deep',        'hair-spa',    'Deep conditioning treatment',    75,  15, 'styling-chair', true, 2),
  ('spa-scalp',       'hair-spa',    'Scalp treatment & massage',      45,  10, 'styling-chair', true, 3),
  ('spa-hairfall',    'hair-spa',    'Hair-fall care session',         60,  15, 'styling-chair', true, 4),

  ('makeup-day',      'makeup',      'Day makeup',                     60,  15, 'beauty-room',   true, 1),
  ('makeup-party',    'makeup',      'Party & evening makeup',         90,  15, 'beauty-room',   true, 2),
  ('makeup-occasion', 'makeup',      'Occasion makeup',               120,  20, 'beauty-room',   true, 3),
  ('makeup-trial',    'makeup',      'Makeup trial',                   75,  15, 'beauty-room',   true, 4),

  ('nails-polish',    'nails',       'Nail polish application',        30,  10, 'nail-station',  true, 1),
  ('nails-gel',       'nails',       'Gel polish',                     60,  10, 'nail-station',  true, 2),
  ('nails-extension', 'nails',       'Nail extensions',               120,  15, 'nail-station',  true, 3),
  ('nails-art-simple','nails',       'Nail art — accent nails',        45,  10, 'nail-station',  true, 4),
  ('nails-art-full',  'nails',       'Nail art — full set',            90,  15, 'nail-station',  true, 5),

  ('mani-classic',    'hands-feet',  'Classic manicure',               45,  10, 'nail-station',  true, 1),
  ('pedi-classic',    'hands-feet',  'Classic pedicure',               60,  15, 'nail-station',  true, 2),
  ('mani-pedi',       'hands-feet',  'Manicure & pedicure',           105,  15, 'nail-station',  true, 3),
  ('pedi-spa',        'hands-feet',  'Spa pedicure',                   75,  15, 'nail-station',  true, 4),

  ('wax-face',        'waxing',      'Face waxing',                    30,  10, 'beauty-room',   true, 1),
  ('wax-arms',        'waxing',      'Arms waxing',                    30,  10, 'beauty-room',   true, 2),
  ('wax-legs',        'waxing',      'Legs waxing',                    45,  10, 'beauty-room',   true, 3),
  ('wax-full',        'waxing',      'Full-body waxing',              120,  20, 'beauty-room',   true, 4),
  ('wax-threading',   'waxing',      'Threading',                      20,   5, 'beauty-room',   true, 5),

  ('groom-shave',     'grooming',    'Shave',                          30,  10, 'styling-chair', true, 1),
  ('groom-beard',     'grooming',    'Beard trim & shaping',           30,  10, 'styling-chair', true, 2),
  ('groom-cut-beard', 'grooming',    'Haircut & beard',                60,  10, 'styling-chair', true, 3),
  ('groom-facial',    'grooming',    'Men''s clean-up',                45,  10, 'beauty-room',   true, 4),

  ('tattoo-consult',  'tattoo',      'Tattoo consultation',            30,  10, 'tattoo-studio', true, 1),
  -- Not bookable online: a session length cannot be known before the
  -- design is agreed, so offering a slot would be offering one we
  -- might not be able to honour.
  ('tattoo-small',    'tattoo',      'Small tattoo session',           90,  30, 'tattoo-studio', false, 2)
on conflict (id) do update set
  category_id      = excluded.category_id,
  name             = excluded.name,
  duration_minutes = excluded.duration_minutes,
  buffer_minutes   = excluded.buffer_minutes,
  resource_kind    = excluded.resource_kind,
  bookable         = excluded.bookable,
  sort             = excluded.sort;
