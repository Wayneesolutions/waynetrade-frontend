# WayneTrade — Group Dashboard

A plain-language dashboard for a WayneTrade group: member status, live
balance/equity from each member's own broker account, equity-over-time
charts, kill-switch controls, full audit trails, and member/strategy
management. Talks directly to a running `waynetrade-backend` deployment.

## What's built

- Connect screen: paste your backend URL, admin API key, and group ID
  (stored only in the browser's `localStorage`, nowhere else). Can also
  create a group from here.
- Group overview: member list, status pills, risk-profile lot size, recent
  order status per member. Auto-refreshes every 15 seconds.
- **New: Live accounts panel** — on-demand balance/equity/floating P&L per
  member, straight from MetaApi via the backend (this IS live broker data).
  Each refresh also stores an equity snapshot server-side.
- **New: Equity chart per member** — equity over time from those snapshots,
  in account currency (per the guide: "P&L in currency, not just %").
- **New: Edit member** (user ID, broker account ref, lot size) and
  **Remove member** (soft delete with required reason — audit-logged;
  history kept).
- **New: Rename / Archive strategy.** Archiving immediately stops the
  strategy's webhook; history is kept; secrets can never be re-shown, so
  re-trading means creating a fresh strategy.
- Kill-switch controls: pause/resume a member, pause the whole group —
  every action requires a typed reason (no silent kill-switches).
- Per-member audit trail: every risk decision with its reason and the
  resulting order status.

## What is NOT built

- **No login screen for the new per-user auth yet.** The backend now
  supports JWT users with member-scoped permissions; this dashboard still
  connects with the shared admin API key (which the backend accepts as
  ADMIN). A member-facing login view is the next frontend task.
- **No live chart streaming** — the equity chart is built from snapshots
  captured whenever live data is refreshed, so history accrues with use;
  quiet weeks have sparse charts until a backend polling worker exists.
- **Live position detail table** (per-position rows with SL/TP) — the
  backend returns positions; the UI currently shows account-level numbers.
- No mobile-specific layout testing beyond basic responsive CSS.

## Setup

```bash
npm install
npm run dev
```

Then either create a new group from the connect screen or connect to an
existing one with your backend URL, admin API key, and group ID.

## Deploy

Static build (`npm run build` → `dist/`) — deploy to Vercel same as the
other Wayne E Solutions frontends.
