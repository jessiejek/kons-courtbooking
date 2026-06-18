# Sunshine Pickleball Courts — Claude Context

## Project
React 19 + Vite 6 + Tailwind CSS v4 + Supabase + react-router-dom v6.
Dev server runs on **port 3000** (user runs it in VS Code — never start it here).
Brand color: `#00694c` green. Font: Hanken Grotesk.
Deployed at: https://courtbooking-sooty.vercel.app

## Supabase
- URL: `https://hwwwhdtqdzlizhfqcdow.supabase.co`
- Anon key: `sb_publishable_R2z5AXpKY5UnHeZXH_d6lA_0d53WZ0N`
- Client: `src/lib/supabase.ts` — exports `supabase` and `isSupabaseEnabled`
- Schema: `supabase_schema.sql` — run once in Supabase SQL Editor
- Realtime enabled on: `bookings`, `booking_slots`, `announcements`

## Auth
- `App.tsx` owns all auth state: `role`, `currentUser`, `authReady`
- `getSession()` on mount + `onAuthStateChange` restores OAuth sessions
- `CurrentUser` interface: `{ name: string; email: string; avatar?: string; }`
- Admin users are auto-redirected to `/admin` via `AppRoutes` in `App.tsx`
- Role comes from `user_metadata.role` in Supabase auth — set via:
  ```sql
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}' where email = '...';
  ```
- Google OAuth client ID: `506648259313-am3a02es4c4gtasugfej0datp04jvapd.apps.googleusercontent.com`
- Redirect URI: `https://hwwwhdtqdzlizhfqcdow.supabase.co/auth/v1/callback`

## No localStorage
**Zero localStorage in the app.** Everything reads/writes Supabase only.
- Bookings — Supabase
- Courts — Supabase (`courts` table)
- Customer booking history — filtered by `customer_email`
- BookingDetailPage — fetches its own booking by `booking_ref` from Supabase

## Key Files
| File | What it does |
|---|---|
| `src/App.tsx` | Root — auth state, `AppRoutes` (admin redirect), BrowserRouter |
| `src/LoginModal.tsx` | Google OAuth + email/password + demo role cards |
| `src/lib/supabase.ts` | Shared Supabase client |
| `src/customer/CustomerApp.tsx` | Customer routes, no local bookings state |
| `src/admin/AdminApp.tsx` | Admin routes, loads courts+bookings from Supabase |
| `src/admin/components/Sidebar.tsx` | Admin nav + currentUser avatar/name + Sign out |
| `src/hooks/useRealtimeSlots.ts` | Live slot availability for BookingSelector |
| `src/hooks/useRealtimeBookings.ts` | Live booking updates (admin=all, customer=mine) |
| `src/hooks/useRealtimeAnnouncements.ts` | Live announcements for LandingPage |

## Routes
### Customer
`/` LandingPage · `/booking` BookingSelector · `/checkout` CheckoutPage · `/confirmed` ConfirmedPage · `/bookings` BookingsHistory · `/bookings/:id` BookingDetailPage

### Admin
`/admin` Dashboard · `/admin/bookings` BookingsView · `/admin/courts` CourtsPricingView · `/admin/courts/new` AddEditCourtView · `/admin/courts/:id` AddEditCourtView · `/admin/locations` LocationsView

## Roles
- `null` = guest (customer pages only)
- `user` = logged-in player (customer + My Bookings, filtered by email)
- `admin` = auto-redirected to `/admin`, full access

## Supabase Tables
`profiles` · `locations` · `courts` · `court_pricing` · `bookings` · `booking_slots` · `announcements`
- `bookings.court_id` and `booking_slots.court_id` are **nullable**
- `bookings.booking_ref` format: `SPC-xxxxx` (customer) / `BK-xxxx` (admin manual)
- `bookings.customer_email` used for per-user filtering in BookingsHistory

## Courts seed data (run if courts table is empty)
```sql
insert into public.courts (slug, name, surface_type, default_price, status) values
  ('court-1', 'Court 1 (Premium Indoor)', 'indoor', 300, 'active'),
  ('court-2', 'Court 2 (Standard Indoor)', 'indoor', 250, 'active'),
  ('court-3', 'Court 3 (Outdoor)', 'outdoor', 200, 'active'),
  ('court-4', 'Court 4 (Outdoor)', 'outdoor', 200, 'active')
on conflict (slug) do nothing;
```

## Known Gaps
- [ ] Court pricing editor (`handleUpdateCourtPricing`) saves to React state only — not wired to `court_pricing` table yet
- [ ] Facebook OAuth not set up in FB Developer Console
- [ ] `src/LoginPage.tsx` is a dead unused file

## TypeScript Note
`src/lib/supabase.ts` has a pre-existing `ImportMeta.env` TS error from Vite config — not a real error, ignore it.

## Conventions
- All nav bars show avatar+name pill when logged in
- CheckoutPage auto-fills name+email from `currentUser` on mount
- Admin "New Booking" form uses `type="date"` and `type="time"` inputs
