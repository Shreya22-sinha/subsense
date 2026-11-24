# SubSense — web demo

A subscription tracker shown inside a phone frame: your real monthly total, warnings before trials
and renewals charge you, and ideas on what to keep, cancel or switch. React app with real accounts on Supabase; the demo account lives only in the browser. Spec: `SubSense Web Demo — PRD v1.0`.

## Scripts

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Dev server at http://localhost:5173 |
| `npm test`          | Vitest (engine + store tests)       |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | TypeScript project build check      |
| `npm run format`    | Prettier                            |
| `npm run build`     | Typecheck and production build      |

## Structure

```
src/
  main.tsx            entry: restores session, mounts the router
  router.tsx          route map (PRD 5); Analytics is lazy-loaded
  App.tsx             root layout: phone frame + desktop demo panel
  routes/             one file per screen, plus guards.tsx
  components/
    ui/               primitives: Button, TextField, Modal, Toast, Segmented, Switch…
    layout/           PhoneFrame, StatusBar, Screen (top bar + scroll body), BottomNav
    demo/             Demo controls (side panel on desktop, Settings on mobile)
  store/              Zustand stores: auth, data (per user), clock, ui
    slices/           data-store actions split by domain (profile, subscriptions)
  engine/             business rules as pure functions + *.test.ts
  data/               catalog.json, quiz, categories, demo account seed
  lib/                formatting, hashing, validation, ids, storage keys
  types/models.ts     the data model (PRD 8)
```

## Rules of the codebase

- **Layering:** routes → store actions → engine. Pages never touch `localStorage`.
- **Engine is pure:** data and `today` in, results out. No React, stores or clock reads
  (enforced by ESLint for `src/engine`). This is what gets ported to Kotlin.
- **Today** comes from the demo clock (`useToday()` / `getToday()`), never `new Date()`.
- **Money** is integer paise everywhere; format with `formatRs`.
- **Every user-visible change** logs an Activity via the data store.
- Styling uses semantic tokens (`bg-surface`, `text-ink`, `text-ink-muted`, `border-line`…) that
  switch with the theme, so components rarely need `dark:` variants.

## Accounts and database

- Setup: run `supabase/schema.sql` in the Supabase SQL Editor (safe to repeat), turn off "Confirm
  email", and copy `.env.example` to `.env.local` with the project URL and publishable key. Never put
  a secret key in this project.
- `src/cloud` is the only code that talks to Supabase, loaded only when an account is used. Access
  rules live in the database (Row Level Security), not in the app.
- `src/store/sync.ts` keeps an offline copy in the browser and saves changes to the account. It never
  saves before a successful load, and refuses to overwrite newer data from another device.
- The demo account never uses the database, apart from an anonymous daily visit count. Time travel
  and reset are demo-only.
- Your numbers: `select * from admin.stats;` in the SQL Editor. Tick `is_test` on your own rows in
  `profiles` so they aren't counted.
- If what is stored changes, update `src/routes/Privacy.tsx` and `PRIVACY_VERSION`.

Browser storage: `subsense_auth`, `subsense_data_<userId>`, `subsense_sync_<userId>` (signed-in users,
removed on logout), `subsense_session` (demo), `subsense_clock`, `subsense_device`,
`subsense_demo_day`.

## Deviations from the PRD

- TypeScript instead of JavaScript; `quiz.ts` instead of `quiz.json` (it carries icons and types).
- Catalogue plans have an explicit `pricePaise` for their own cycle (some services bill
  quarterly). Prices are placeholders with `lastVerified: null` until checked in step 4.
- The Share (family plan) pick is out of scope for this project.
- Utility templates are not offered as onboarding chips (they have no price); add them via the
  Add form.
- Subscription has an extra `datesConfirmed` flag for the "confirm your dates" prompt on Home.
- Adding a subscription treats every charge date up to and including today as already paid
  (you pay when you subscribe). Past payments become Charge records, so "Spent so far" is right
  for back-dated subscriptions, and the next charge is always in the future. Clock-driven
  rollover still follows the PRD: only charges dated before today are recorded.
- The onboarding budget hint is based on quiz question 3 (student / working), since age is never asked.
- ₹0 prices are allowed only when the plan name contains "free".
- The full demo account seed (PRD 9.2, planned for step 9) was built early so steps 5–7 can be
  reviewed; a test checks it shows every badge and action level on every day of a year.
- Subscriptions store a `chargeAnchor` (the date the billing series counts from) so month-end
  dates never drift after a short month (31 Jan → 28 Feb → 31 Mar).
- Charges carry a `source` (`rollover` or `backfill`); only rollover charges raise the Confirm
  item. PriceChange records `cycleChanged` and `remindAtRenewal`.
- Charts use the validated 8-slot categorical palette; News and Utilities fold into a grey
  "Bills and news" slice. Initial circles use a darker step of the same hue for text contrast.
- "Priciest" and "Best value" badges skip Utilities. "Renews soon" and Action Center items skip
  charges that won't happen (auto-renew off or past the end date).
- The Student pick needs "I'm a student"; the PRD's demo profile is not a student, so it appears
  once that setting is on (a test checks this). Every other pick type shows on first load.
- "A cheaper plan of the same service" (vibe check follow-up) is a Swap pick that changes the plan
  in place. Swapping to another service starts the new one on the old one's next charge date.
- Pausing from a Trim pick records a pause Saving, removed again when the subscription resumes.
- CSV cells starting with = + - @ are prefixed with ' so spreadsheets don't run them as formulas.

- Navigation: Recommendations is a bottom tab; Actions (with its count) replaced the reserved bell in
  the top bar; + sits in the top bar of Home and Subscriptions instead of floating. Home leads with
  recommendations.
- The desktop frame imitates a chosen phone (`src/data/devices.ts`, saved in `subsense_device`),
  fitted to the window or at actual size, instead of one fixed 390 x 844 frame.
- Analytics is split into Overview, Spending and Activity; optional form fields and secondary
  subscription details open on tap.
- Recommendations skip plans that are already ending.

## Progress

- [x] 0 Project setup · [x] 1 Shell · [x] 2 Accounts · [x] 3 Onboarding
- [x] 4 Subscriptions · [x] 5 Usage and badges · [x] 6 Action Center · [x] 7 Analytics
- [x] 8 Recommendations · [x] 9 Home and Settings · [ ] 10 Polish and launch
