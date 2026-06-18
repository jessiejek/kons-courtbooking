# Sunshine Pickleball Courts — Claude Context

## Project
React 19 + Vite 6 + Tailwind CSS v4 + Supabase + react-router-dom v6.
Dev server runs on **port 3000** (user runs it in VS Code — never start it here).
Brand color: `#00694c` green. Font: Hanken Grotesk.

## Supabase
- URL: `https://hwwwhdtqdzlizhfqcdow.supabase.co`
- Anon key: `sb_publishable_R2z5AXpKY5UnHeZXH_d6lA_0d53WZ0N`
- Client: `src/lib/supabase.ts` — exports `supabase` and `isSupabaseEnabled`
- Schema: `supabase_schema.sql` — run once in Supabase SQL Editor
- Realtime enabled on: `bookings`, `booking_slots`, `announcements`

## Auth
- `App.tsx` owns all auth state: `role`, `currentUser`, `authReady`
- `getSession()` on mount + `onAuthStateChange` subscription restores OAuth sessions
- `CurrentUser` interface: `{ name: string; email: string; avatar?: string; }`
- Google OAuth: client ID `506648259313-am3a02es4c4gtasugfej0datp04jvapd.apps.googleusercontent.com`
- Redirect URI: `https://hwwwhdtqdzlizhfqcdow.supabase.co/auth/v1/callback` → back to `http://localhost:3000`

## Key Files
| File | What it does |
|---|---|
| `src/App.tsx` | Root: auth state, BrowserRouter, role routing |
| `src/LoginModal.tsx` | Google OAuth + email/password + demo role cards |
| `src/lib/supabase.ts` | Shared Supabase client |
| `src/customer/CustomerApp.tsx` | Customer routes + booking state machine |
| `src/admin/AdminApp.tsx` | Admin routes + booking CRUD + Realtime feed |
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
- `user` = logged-in player (customer + My Bookings)
- `admin` = full access (customer + all `/admin/*`)

## Supabase Tables
`profiles` · `locations` · `courts` · `court_pricing` · `bookings` · `booking_slots` · `announcements`
- `bookings.court_id` and `booking_slots.court_id` are **nullable** (customer app sends null)
- `bookings.booking_ref` format: `SPC-xxxxx`

## Known Gaps (pick up here next session)
- [ ] `BookingsHistory` fetches all bookings — needs `user_id` filter for per-user isolation
- [ ] `court_id` always null from customer — needs slug→id lookup or DB trigger
- [ ] Admin revenue chart uses localStorage data, not Supabase
- [ ] Facebook OAuth not set up in FB Developer Console yet
- [ ] `src/LoginPage.tsx` is a dead unused file

## TypeScript Note
`src/lib/supabase.ts` has a pre-existing `ImportMeta.env` TS error from Vite config — not a real error, ignore it.

## Conventions
- All nav bars show avatar+name pill when logged in (not plain "Log out")
- `isSupabaseEnabled` gates all DB calls — localStorage fallback when false
- Demo mode: role cards in LoginModal bypass real auth
