# WayneTrade — Group Dashboard (first pass)

> **⚠️ MERGED — see [arpanwayne/saaf-signal-frontend](https://github.com/arpanwayne/saaf-signal-frontend).**
> This dashboard's Risk & Execution view now lives as a tab inside the
> combined Saaf Signal frontend, alongside the forecast engine UI. This repo
> is no longer actively developed — go to the link above for current work.

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
- **New:** Create a group directly from the connect screen ("Create one")
  instead of needing direct database access.
- **New:** Add member and Add strategy forms in the group header. Adding a
  strategy shows its webhook secret exactly once — copy it into TradingView
  immediately, it cannot be retrieved again afterwards.

## What is NOT built (Phase 2 items still open)

- **No live P&L or live position data.** Everything shown comes from our own
  database (orders + risk_decisions), not a live poll of MetaApi/Kite
  account equity or open positions. That's a separate integration.
- **No login/user accounts.** The "admin API key" is one shared secret for
  whoever has it — there's no concept of an individual logged-in user here.
  Anyone with the key can pause anyone or create groups/strategies.
- **No charts/visualizations of P&L over time** — only per-order and
  per-decision list views.
- **No editing/removing members or strategies** yet — only creating them.
- **No mobile-specific layout testing** beyond basic responsive CSS.

## Setup

```bash
npm install
npm run dev
```

Then open the app and either:
- **Create a new group**: click "Create one" on the connect screen, enter
  your backend URL, admin API key, group name, and your admin user ID.
- **Connect to an existing group**: enter your backend URL, admin API key,
  and the group's ID.

## Deploy

Static build (`npm run build` → `dist/`) — deploy to Vercel same as the
other Wayne E Solutions frontends.
