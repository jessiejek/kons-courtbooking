-- ============================================================
-- SUNSHINE PICKLEBALL COURTS — SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor (in order)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fast text search on names


-- ────────────────────────────────────────────────────────────
-- 1. ENUMS  (safe — skips if already exists)
-- ────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('player', 'staff', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type court_surface as enum ('indoor', 'outdoor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type court_status as enum ('active', 'maintenance', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type day_of_week as enum ('Mon','Tue','Wed','Thu','Fri','Sat','Sun');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending','confirmed','paid','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('Card','GCash','Online Banking');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending','paid','refunded','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type location_type as enum ('main','branch');
exception when duplicate_object then null; end $$;


-- ────────────────────────────────────────────────────────────
-- 2. PROFILES  (extends auth.users)
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid         primary key references auth.users(id) on delete cascade,
  full_name     text,
  phone         text,
  email         text,
  role          user_role    not null default 'player',
  avatar_url    text,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

comment on table public.profiles is
  'One row per auth.users entry. Role controls admin vs player access.';

-- auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ────────────────────────────────────────────────────────────
-- 3. LOCATIONS  (facility branches)
-- ────────────────────────────────────────────────────────────
create table if not exists public.locations (
  id              serial       primary key,
  name            text         not null,
  address         text         not null,
  city            text         not null default 'Taguig',
  province        text         not null default 'Metro Manila',
  type            location_type not null default 'branch',
  indoor_courts   int          not null default 0,
  outdoor_courts  int          not null default 0,
  phone           text,
  email           text,
  google_maps_url text,
  is_active       boolean      not null default true,
  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

comment on table public.locations is
  'Physical club locations. Courts belong to a location.';


-- ────────────────────────────────────────────────────────────
-- 4. COURTS
-- ────────────────────────────────────────────────────────────
create table if not exists public.courts (
  id              serial         primary key,
  location_id     int            references public.locations(id) on delete set null,
  -- used as the string key in the customer app (court-1, court-2 …)
  slug            text           unique not null,
  name            text           not null,
  surface_type    court_surface  not null default 'indoor',
  opens_at        time           not null default '06:00',
  closes_at       time           not null default '22:00',
  -- default / fallback price when no pricing rule matches
  default_price   numeric(10,2)  not null default 350,
  status          court_status   not null default 'active',
  -- customer-facing
  rating          numeric(3,2)   check (rating between 0 and 5) default 5.0,
  description     text,
  image_url       text,
  created_at      timestamptz    not null default now(),
  updated_at      timestamptz    not null default now()
);

comment on table public.courts is
  'A court belongs to a location. Slug matches the id used in the customer app.';

create index if not exists idx_courts_location  on public.courts(location_id);
create index if not exists idx_courts_status    on public.courts(status);


-- ────────────────────────────────────────────────────────────
-- 5. COURT PRICING  (per day-of-week time bands)
-- ────────────────────────────────────────────────────────────
create table if not exists public.court_pricing (
  id          uuid           primary key default gen_random_uuid(),
  court_id    int            not null references public.courts(id) on delete cascade,
  day         day_of_week    not null,
  start_time  time           not null,
  end_time    time           not null,
  rate        numeric(10,2)  not null,
  created_at  timestamptz    not null default now(),

  constraint pricing_start_before_end check (start_time < end_time),
  -- one rule per court+day+start combination
  unique (court_id, day, start_time)
);

comment on table public.court_pricing is
  'Time-banded pricing per day of week. Replaces the pricing JSONB in the admin app.
   To find the rate for a given slot: match court_id + day + start_time <= slot < end_time.';

create index if not exists idx_court_pricing_court on public.court_pricing(court_id, day);


-- ────────────────────────────────────────────────────────────
-- 6. BOOKINGS
-- ────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id               uuid            primary key default gen_random_uuid(),
  -- human-readable reference shown to customers (SPC-88219) and staff (BK-1001)
  booking_ref      text            unique not null,

  -- nullable: guest bookings have no user_id
  user_id          uuid            references auth.users(id) on delete set null,
  -- nullable: customer app resolves court by slug; court_id populated by trigger or admin
  court_id         int             references public.courts(id) on delete set null,
  -- denormalized for display without joins
  court_name       text            not null,

  booking_date     date            not null,
  start_time       time            not null,
  end_time         time            not null,
  -- number of 1-hour slots booked
  slots_count      int             not null default 1 check (slots_count >= 1),

  total_amount     numeric(10,2)   not null check (total_amount >= 0),
  booking_status   booking_status  not null default 'pending',

  -- customer info (guest bookings don't have user_id but still need these)
  customer_name    text            not null,
  customer_phone   text            not null,
  customer_email   text,

  -- payment
  payment_method   payment_method,
  payment_status   payment_status  not null default 'pending',
  card_last4       text            check (card_last4 ~ '^\d{4}$' or card_last4 is null),

  -- admin fields
  notes            text,
  cancelled_reason text,

  created_at       timestamptz     not null default now(),
  updated_at       timestamptz     not null default now(),

  constraint end_after_start check (end_time > start_time)
);

comment on table public.bookings is
  'Master bookings table used by both the customer app and the admin terminal.
   booking_ref format: SPC-XXXXX for online, BK-XXXX for walk-in/admin-created.';

create index if not exists idx_bookings_user        on public.bookings(user_id);
create index if not exists idx_bookings_court_date  on public.bookings(court_id, booking_date);
create index if not exists idx_bookings_status      on public.bookings(booking_status);
create index if not exists idx_bookings_ref         on public.bookings(booking_ref);


-- ────────────────────────────────────────────────────────────
-- 7. BOOKING SLOTS  (one row per 1-hour block)
-- Enforces no double-booking at the database level.
-- ────────────────────────────────────────────────────────────
create table if not exists public.booking_slots (
  id          uuid  primary key default gen_random_uuid(),
  booking_id  uuid  not null references public.bookings(id) on delete cascade,
  court_id    int   references public.courts(id) on delete set null,
  slot_date   date  not null,
  slot_time   time  not null,  -- e.g. 09:00 means the 09:00–10:00 hour

  -- prevent double-booking per court per day (only enforced when court_id is known)
  unique (court_id, slot_date, slot_time)
);

comment on table public.booking_slots is
  'One row per 1-hour block. The unique constraint prevents double-booking
   at DB level — no need to check in application code.';

create index if not exists idx_slots_court_date on public.booking_slots(court_id, slot_date);
create index if not exists idx_slots_booking    on public.booking_slots(booking_id);


-- ────────────────────────────────────────────────────────────
-- 8. ANNOUNCEMENTS  (admin broadcast notices)
-- ────────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id          uuid         primary key default gen_random_uuid(),
  title       text         not null,
  body        text         not null,
  author_id   uuid         references auth.users(id) on delete set null,
  is_pinned   boolean      not null default false,
  is_active   boolean      not null default true,
  publish_at  timestamptz  not null default now(),
  expires_at  timestamptz,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

comment on table public.announcements is
  'Admin-managed broadcast messages shown on the customer landing page.';

create index if not exists idx_announcements_active on public.announcements(is_active, publish_at);


-- ────────────────────────────────────────────────────────────
-- 9. updated_at TRIGGER  (applied to all mutable tables)
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger trg_locations_updated_at
  before update on public.locations
  for each row execute procedure public.set_updated_at();

create trigger trg_courts_updated_at
  before update on public.courts
  for each row execute procedure public.set_updated_at();

create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute procedure public.set_updated_at();

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute procedure public.set_updated_at();


-- ────────────────────────────────────────────────────────────
-- 10. HELPER FUNCTION — get price for a slot
-- Usage: select get_court_rate(1, 'Mon', '09:00');
-- ────────────────────────────────────────────────────────────
create or replace function public.get_court_rate(
  p_court_id  int,
  p_day       day_of_week,
  p_time      time
)
returns numeric language sql stable as $$
  select coalesce(
    (
      select rate
      from   public.court_pricing
      where  court_id   = p_court_id
        and  day        = p_day
        and  start_time <= p_time
        and  end_time   >  p_time
      limit 1
    ),
    (select default_price from public.courts where id = p_court_id)
  );
$$;

comment on function public.get_court_rate is
  'Returns the applicable hourly rate for a court at a given day + time.
   Falls back to courts.default_price if no pricing rule matches.';


-- ────────────────────────────────────────────────────────────
-- 11. HELPER FUNCTION — check slot availability
-- Usage: select is_slot_available(1, '2026-10-13'::date, '09:00'::time);
-- ────────────────────────────────────────────────────────────
create or replace function public.is_slot_available(
  p_court_id  int,
  p_date      date,
  p_time      time
)
returns boolean language sql stable as $$
  select not exists (
    select 1
    from   public.booking_slots
    where  court_id  = p_court_id
      and  slot_date = p_date
      and  slot_time = p_time
  );
$$;


-- ────────────────────────────────────────────────────────────
-- 12. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

-- helper: current user's role from profiles
create or replace function public.current_user_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── profiles ──────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins read all profiles"
  on public.profiles for select
  using (public.current_user_role() = 'admin');

create policy "Users update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ── locations ─────────────────────────────────────────────
alter table public.locations enable row level security;

create policy "Public read locations"
  on public.locations for select
  using (is_active = true);

create policy "Admins manage locations"
  on public.locations for all
  using (public.current_user_role() = 'admin');

-- ── courts ────────────────────────────────────────────────
alter table public.courts enable row level security;

create policy "Public read active courts"
  on public.courts for select
  using (status = 'active');

create policy "Admins read all courts"
  on public.courts for select
  using (public.current_user_role() in ('admin','staff'));

create policy "Admins manage courts"
  on public.courts for all
  using (public.current_user_role() = 'admin');

-- ── court_pricing ─────────────────────────────────────────
alter table public.court_pricing enable row level security;

create policy "Public read pricing"
  on public.court_pricing for select
  using (true);

create policy "Admins manage pricing"
  on public.court_pricing for all
  using (public.current_user_role() = 'admin');

-- ── bookings ──────────────────────────────────────────────
alter table public.bookings enable row level security;

-- guests / logged-in users can create bookings
create policy "Anyone can create a booking"
  on public.bookings for insert
  with check (true);

-- logged-in users see only their own bookings
create policy "Users read own bookings"
  on public.bookings for select
  using (user_id = auth.uid());

-- admins and staff see everything
create policy "Staff read all bookings"
  on public.bookings for select
  using (public.current_user_role() in ('admin','staff'));

create policy "Admins update any booking"
  on public.bookings for update
  using (public.current_user_role() in ('admin','staff'));

create policy "Users cancel own booking"
  on public.bookings for update
  using (
    user_id = auth.uid()
    and booking_status not in ('completed','cancelled')
  );

-- ── booking_slots ─────────────────────────────────────────
alter table public.booking_slots enable row level security;

-- anyone can read slots to check availability
create policy "Public read slots"
  on public.booking_slots for select
  using (true);

-- slots are inserted by the booking flow only (use service role in Edge Functions)
create policy "Service role insert slots"
  on public.booking_slots for insert
  with check (true);

create policy "Service role delete slots"
  on public.booking_slots for delete
  using (public.current_user_role() in ('admin','staff'));

-- ── announcements ─────────────────────────────────────────
alter table public.announcements enable row level security;

create policy "Public read active announcements"
  on public.announcements for select
  using (is_active = true and publish_at <= now()
         and (expires_at is null or expires_at > now()));

create policy "Admins manage announcements"
  on public.announcements for all
  using (public.current_user_role() = 'admin');


-- ────────────────────────────────────────────────────────────
-- 13. SEED DATA — Locations
-- ────────────────────────────────────────────────────────────
insert into public.locations (name, address, city, type, indoor_courts, outdoor_courts, is_active) values
  ('Sunshine Hills Country Club',  '7th Ave & 30th St, BGC',              'Taguig',    'main',   2, 0, true),
  ('West Makati Clay Courts',      '123 Ayala Ave, Makati',               'Makati',    'branch', 2, 0, true),
  ('East High Hardwood Courts',    '456 Ortigas Ave, Pasig',              'Pasig',     'branch', 0, 1, true);


-- ────────────────────────────────────────────────────────────
-- 14. SEED DATA — Courts
-- Slugs match the string IDs used in the customer app.
-- ────────────────────────────────────────────────────────────
insert into public.courts
  (location_id, slug, name, surface_type, opens_at, closes_at, default_price, status, rating, description, image_url)
values
  (1, 'court-1', 'Court 1 (Premium Indoor)',       'indoor',  '06:00', '22:00', 300, 'active',      4.9,
   'High-visibility climate-controlled indoor court with professional-grade cushion coating.',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuAYGSfmdA49eRR83lQsv1hN2gMHr8FG2ikTUmB_75urXgGquTYjSAENgNxTmOIHIy5WRrorIx6XDTt1GqOzxjZS5W--iheKIagmsOqNJF9ovBmYePaCf5F_Aer9lL3rYfbQi3p4SdIf4iLPyk_au1dr7TGCHv2WH1E_0O--uKGrKZ8XJ-8TmVcWpL0MLdqO0U_pevBDCuBKf8PgWtblYvWopZWLFFb6zhLgI-fuOY_n3o21fhIR3dCQ-ecUrX-h9jEroubarcpKg-0g'),

  (1, 'court-2', 'Court 2 (Championship Outdoor)', 'outdoor', '06:00', '22:00', 250, 'active',      4.8,
   'Open-air standard outdoor court featuring premium mesh fencing, shadowless night lighting, and pristine wind barriers.',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuDflRyAyRElrM8rqUnguE6w5PmIDC5BNVKVe0bK2Tvyur65W3kDqeD9BZ37gMDGwOQX7h_lBKS_nX-dCcPP6y9bH1G_4ZKqC3E6EoMnGP2uNZoOHIZ2tkLOd2ATN5Yr4PYQgEi2Kz27JdX571WJW8cicJV0XSV2YkN8djGsENzAwgU2En1WJYx_XW-fuxi3fIgq7eYLjcHnc395c1h8OmQ4xcv5vBh16-2rQJig0A5-uztkWoj8S7Jncfa2geNNzclHKVDu3I6t4pq0'),

  (1, 'court-3', 'Court 3 (Indoor Pro)',            'indoor',  '06:00', '22:00', 300, 'active',      4.7,
   'Dynamic cushioned court built for competitive matches, fully ventilated, tournament-standard nets.',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuAUXjgdDHxmwietk7x8EWlEnGVZ3EiJsJnH8HMd7cgeN3KZtYbntZdQhM9FNxlMDfFtJd7A9cePP1Xyl61Z2ejXjjmHmirpO0ig3oHiHBtUZbln_SAeaPVnn_i_rPP1sWqgOpwy3hJB2tGpIraoyS4kJ3FciJVH-b2uigFKyHMSahupCQEZZll4fYMo18UFiqX_0hge5NtUzYCFvJ30DMmxG4J8CNyksJ9z5ppCeVhJ5_wWFuam1bDY0-5LtZndfQqSyoRdQMN1Za0S'),

  (1, 'court-4', 'Court 4 (Outdoor Scenic)',        'outdoor', '06:00', '22:00', 250, 'active',      4.6,
   'Outstanding outdoor court framed by lush peripheral greenery, specialized non-slip texture, and premium net posts.',
   'https://lh3.googleusercontent.com/aida-public/AB6AXuCJZO4uG4ciG-9HvpBeL4KWbg1MCIajfR4-2nvayr6fb-NcRDuvSKdOqcT8c6pcmhvDb2vn_xXmKZdPdvY9rI_RDmdN0D0hdxPX6Ng3peqxDDdCQCej3DorIPK9ahXnrrabwnpq1OEEDJ4Rj3dnNublvhAczHk1THJSFdkYTplh3rzIBjkLTftkdQNKJ6BMrw3WCNVUir_Uvyt2grrpYhbnDthy7Um5dHBAUh-kbc3d_aZ_n-SWqc_pPts');


-- ────────────────────────────────────────────────────────────
-- 15. SEED DATA — Court Pricing
-- Matches the admin app's createDefaultPricingForDay() logic
-- ────────────────────────────────────────────────────────────

-- Court 1 & 3 (Indoor) — standard week pricing
insert into public.court_pricing (court_id, day, start_time, end_time, rate)
select
  c.id,
  d.day::day_of_week,
  p.start_time::time,
  p.end_time::time,
  p.rate
from
  public.courts c,
  (values
    ('Mon'), ('Tue'), ('Thu'), ('Fri'), ('Sat'), ('Sun')
  ) as d(day),
  (values
    ('06:00', '12:00', 350),
    ('12:00', '17:00', 350),
    ('17:00', '22:00', 400)
  ) as p(start_time, end_time, rate)
where c.slug in ('court-1', 'court-3');

-- Court 1 & 3 — Wednesday (different bands)
insert into public.court_pricing (court_id, day, start_time, end_time, rate)
select
  c.id,
  'Wed'::day_of_week,
  p.start_time::time,
  p.end_time::time,
  p.rate
from
  public.courts c,
  (values
    ('06:00', '09:00', 300),
    ('09:00', '17:00', 350),
    ('17:00', '22:00', 400)
  ) as p(start_time, end_time, rate)
where c.slug in ('court-1', 'court-3');

-- Court 2 & 4 (Outdoor) — all days same two bands
insert into public.court_pricing (court_id, day, start_time, end_time, rate)
select
  c.id,
  d.day::day_of_week,
  p.start_time::time,
  p.end_time::time,
  p.rate
from
  public.courts c,
  (values
    ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat'), ('Sun')
  ) as d(day),
  (values
    ('06:00', '13:00', 250),
    ('13:00', '22:00', 300)
  ) as p(start_time, end_time, rate)
where c.slug in ('court-2', 'court-4');


-- ────────────────────────────────────────────────────────────
-- 16. SEED DATA — Sample Bookings + Slots
-- Mirrors INITIAL_BOOKINGS from the customer app
-- ────────────────────────────────────────────────────────────
insert into public.bookings
  (booking_ref, court_id, court_name, booking_date, start_time, end_time,
   slots_count, total_amount, booking_status, customer_name, customer_phone,
   payment_method, payment_status, card_last4, created_at)
values
  ('SPC-88219',
   (select id from public.courts where slug='court-1'),
   'Court 1 (Premium Indoor)',
   '2026-10-13', '09:00', '11:00', 2, 600,
   'confirmed', 'Juan Dela Cruz', '+63 912 345 6789',
   'Card', 'paid', '4242',
   '2026-10-10 14:30:00+00'),

  ('SPC-71239',
   (select id from public.courts where slug='court-2'),
   'Court 2 (Championship Outdoor)',
   '2026-10-09', '16:00', '18:00', 2, 500,
   'completed', 'Juan Dela Cruz', '+63 912 345 6789',
   'GCash', 'paid', null,
   '2026-10-08 09:15:00+00'),

  ('SPC-42981',
   (select id from public.courts where slug='court-3'),
   'Court 3 (Indoor Pro)',
   '2026-10-05', '08:00', '09:00', 1, 300,
   'completed', 'Juan Dela Cruz', '+63 912 345 6789',
   'Online Banking', 'paid', null,
   '2026-10-03 11:00:00+00'),

  -- Admin-created sample bookings (BK- prefix)
  ('BK-1001',
   (select id from public.courts where slug='court-1'),
   'Court 1 (Premium Indoor)',
   '2026-10-24', '08:00', '09:00', 1, 2400,
   'paid', 'Rafael N.', '0917 123 4567',
   'Card', 'paid', null, now()),

  ('BK-1002',
   (select id from public.courts where slug='court-2'),
   'Court 2 (Championship Outdoor)',
   '2026-10-24', '10:00', '11:00', 1, 1800,
   'pending', 'Maria S.', '0918 234 5678',
   null, 'pending', null, now()),

  ('BK-1003',
   (select id from public.courts where slug='court-3'),
   'Court 3 (Indoor Pro)',
   '2026-10-24', '14:00', '15:00', 1, 1500,
   'confirmed', 'Carlos A.', '0919 345 6789',
   null, 'pending', null, now()),

  ('BK-1004',
   (select id from public.courts where slug='court-1'),
   'Court 1 (Premium Indoor)',
   '2026-10-25', '09:00', '10:00', 1, 3000,
   'cancelled', 'Novak J.', '0920 456 7890',
   null, 'refunded', null, now()),

  ('BK-1005',
   (select id from public.courts where slug='court-1'),
   'Court 1 (Premium Indoor)',
   '2026-10-23', '16:00', '17:00', 1, 2400,
   'completed', 'Iga S.', '0921 567 8901',
   null, 'paid', null, now());


-- ── booking_slots for the SPC bookings ──────────────────────
insert into public.booking_slots (booking_id, court_id, slot_date, slot_time)
select
  b.id,
  b.court_id,
  b.booking_date,
  s.slot_time::time
from public.bookings b,
  lateral (values ('09:00'), ('10:00')) as s(slot_time)
where b.booking_ref = 'SPC-88219';

insert into public.booking_slots (booking_id, court_id, slot_date, slot_time)
select
  b.id, b.court_id, b.booking_date, s.slot_time::time
from public.bookings b,
  lateral (values ('16:00'), ('17:00')) as s(slot_time)
where b.booking_ref = 'SPC-71239';

insert into public.booking_slots (booking_id, court_id, slot_date, slot_time)
select b.id, b.court_id, b.booking_date, '08:00'::time
from public.bookings b where b.booking_ref = 'SPC-42981';


-- ────────────────────────────────────────────────────────────
-- 17. SEED DATA — Sample Announcement
-- ────────────────────────────────────────────────────────────
insert into public.announcements (title, body, is_pinned, is_active)
values (
  'Court 3 Back Online',
  'Maintenance on Court 3 is complete. All four courts are now fully operational. Book your slot today!',
  true,
  true
);


-- ────────────────────────────────────────────────────────────
-- 18. STORAGE BUCKET  (run manually in Supabase dashboard
--     or via the CLI — SQL cannot create buckets)
-- ────────────────────────────────────────────────────────────
-- Bucket name : court-images
-- Public      : true  (images are served publicly)
-- Allowed MIME: image/jpeg, image/png, image/webp
-- Max size    : 5 MB
--
-- After creating the bucket, add this policy in the dashboard:
--   Policy name : "Admins upload court images"
--   Allowed ops : INSERT, UPDATE, DELETE
--   Target roles: authenticated
--   Expression  : (public.current_user_role() = 'admin')
-- ────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────
-- 19. REALTIME PUBLICATION
--     Enable postgres_changes events for the three tables
--     that have live subscribers in the front-end.
-- ────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.booking_slots;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.announcements;


-- ────────────────────────────────────────────────────────────
-- DONE.
-- ────────────────────────────────────────────────────────────
