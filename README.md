# WayneTrade — Group Dashboard (first pass)

A plain-language dashboard for a WayneTrade group: see member status, recent
order outcomes, pause/resume with a required reason, and each member's full
audit trail. Talks directly to a running `waynetrade-backend` deployment.

**HONEST STATUS: this is a first pass, not a finished Phase 2 dashboard.**

## What's built

- Connect screen: paste your backend URL, admin API key, and group ID
  (stored only in the browser's `localStorage`, nowhere else).
- Group overview: member list, status pills (Active/Paused/Removed), recent
  order status per member.
- Kill-switch controls: pause/resume a member, pause the whole group — every
  action requires typing a reason (matches the backend's "no silent
  kill-switches" rule).
- Per-member audit trail: every risk decision (approve/reject/resize) with
  its reason, and the resulting order status if one was placed.
- Auto-refreshes every 15 seconds.

## What is NOT built (Phase 2 items still open)

- **No live P&L or live position data.** Everything shown comes from our own
  database (orders + risk_decisions), not a live poll of MetaApi/Kite
  account equity or open positions. That's a separate integration.
- **No group/member onboarding UI.** Adding a group, inviting members,
  linking their broker accounts, and setting risk profiles all currently
  require going directly into the database — there's no form for any of it
  yet.
- **No login/user accounts.** The "admin API key" is one shared secret for
  whoever has it — there's no concept of an individual logged-in user here.
  Anyone with the key can pause anyone.
- **No charts/visualizations of P&L over time** — only per-order and
  per-decision list views.
- **No mobile-specific layout testing** beyond basic responsive CSS.

## Setup

```bash
npm install
npm run dev
```

Then open the app and enter:
- Your `waynetrade-backend` URL (e.g. `http://localhost:4000` while
  developing, or its Railway URL once deployed)
- The `ADMIN_API_KEY` value from that backend's `.env`
- A group ID (a row in the `groups` table — there's no group-creation UI
  yet, so this currently has to be inserted directly via Prisma Studio or SQL)

## Deploy

Static build (`npm run build` → `dist/`) — deploy to Vercel same as the
other Wayne E Solutions frontends.
