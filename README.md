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
- **New:** Add-member form collects risk:reward ratio (auto profit-booking)
  and a WhatsApp number for real-time trade alerts; group creation collects
  the broker's own WhatsApp number for the research digest. Broker type
  select offers Kite Connect (Indian equities) alongside MetaTrader — no
  longer marked "not wired up", since it now is.
- **New:** Each strategy row shows whether it has a SEBI Algo-ID set (green
  pill) or not (amber warning — equities orders on it are rejected until
  one is set), with a "Set/Update Algo-ID" action.
- **New: Transparency feed section** — every real-time trade notification
  sent to an investor, and every research digest sent to the broker, in one
  auto-refreshing list, reading `waynetrade-backend`'s
  `GET /dashboard/group/:groupId/notifications`.
- **New: Research assistant section** — the AI news-analysis feed (Layer 2),
  reading `GET /research/feed`, with a "Run scan now" button (there's no
  scheduler on the backend yet, so this is currently the only way to
  trigger a scan from the UI). Shows both the news-based confidence tag and
  the forecast engine's own historical read, side by side, when both exist
  for an article.
- **New: a genuinely separate investor view** at `#investor` (own connect
  screen, own `localStorage` key, own credential type — a per-member view
  token, never the admin API key). Shows only that one member's own recent
  orders, transparency feed, and audit trail — no kill-switch, no
  onboarding, no visibility into anyone else. The main connect screen links
  to it ("Are you an investor?"); it links back to the admin dashboard.
  Optionally link out to a Saaf Signal deployment (track record/forecasts)
  from the investor view's header — prompts once, remembers the URL.
  Closes the "one shared dashboard for both roles" gap below, at least for
  investors — brokers/admins still share the one `ADMIN_API_KEY`.
- **New: "Remove" action on each member row** (admin dashboard) — calls
  the backend's new `DELETE /onboarding/member/:id` (soft delete to
  `REMOVED`, reason required via the same `ReasonPrompt` pause/resume
  already uses). Once removed, no further action shows on that row —
  matches the backend having no "un-remove" route.
- **New: "Get a new view token" in the investor view** — self-service
  rotation, calling the backend's new `POST
  /investor/:memberId/view-token/regenerate` with the investor's own
  current token. The new token is shown once in a modal and this session
  updates itself immediately, no re-login needed.
- **New: Saaf Signal section** (`src/SignalApp.jsx`) in the admin/broker
  dashboard — a direct port of the formerly-separate `saaf-signal-frontend`
  site's core functionality (ticker checker with plain-English + technical
  views, a permanent Truth Board of hits/misses, a watchlist) onto this
  same React shell, calling `waynetrade-backend`'s newly in-process
  `/signal`, `/predict`, `/track-record`, `/watchlist` routes. Deliberately
  **not** shown in the investor view — see
  `docs/RA_RIA_DECISION_SUPPORT.md` in `waynetrade-backend` for why a
  forward-looking forecast surfaced to retail is the thing this project
  otherwise avoids. Verified end-to-end against a real backend + Postgres
  (watchlist add/remove); the ticker checker's actual forecast call
  correctly shows a graceful error in this sandbox, since outbound calls to
  Yahoo Finance are blocked here — see the backend README's honest-gaps
  section.

## What is NOT built (still open)

- **No live P&L or live position data.** Everything shown comes from our own
  database (orders + risk_decisions), not a live poll of MetaApi/Kite
  account equity or open positions. That's a separate integration.
- **No login/user accounts.** The "admin API key" is one shared secret for
  whoever has it — there's no concept of an individual logged-in user here.
  Anyone with the key can pause anyone or create groups/strategies.
- **No charts/visualizations of P&L over time** — only per-order and
  per-decision list views.
- **Members can now be removed, but strategies still can't be
  edited/removed** — only created (a member's risk:reward ratio can be
  changed via the backend's `PUT /onboarding/member/:id/risk-profile`
  directly, no UI for it yet).
- **No mobile-specific layout testing** beyond basic responsive CSS.
- **View tokens still have no expiry** — self-service rotation exists now
  (above), but only if the investor still HAS a working token. If it's
  actually lost (not just suspected leaked), only an admin can issue a new
  one (`POST /onboarding/member/:id/view-token/regenerate`) — there's no
  "forgot my token" recovery flow, because there's nothing else to verify
  the requester's identity against.
- **The standalone `saaf-signal-frontend` site's chat page wasn't ported.**
  The new Saaf Signal section (above) covers the ticker checker, truth
  board, and watchlist, but not that site's free-form conversational chat
  UI — the same plain-English `explain()` output it used is available via
  the checker view here, just not as a back-and-forth thread.
  `saaf-signal-frontend` itself still exists as a separate legacy
  deployment (see its own README) and is no longer the current source for
  this functionality.

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
- **As an investor**: go to `/#investor` (or click "View your own trades" on
  the main connect screen), and enter the backend URL plus the member ID
  and view token your broker/admin gave you when they added you.

## Deploy

Static build (`npm run build` → `dist/`) — deploy to Vercel same as the
other Wayne E Solutions frontends.
