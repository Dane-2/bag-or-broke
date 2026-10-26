# Bag or Broke: NIL Money Moves: Developer Ledger

A living record of how the companion web app works and what has changed. It is updated after
every meaningful fix. Names in `code style` are the exact names used in the code, so a question
like "where does the year come from?" can be answered with a field or function name.

Last updated: 2026-10-26 (Fix Log v1.2).
This document contains no passwords, API keys, access tokens or private player data.

---

## 1. Version and system map

| Item | Current value |
|---|---|
| App | `bag-or-broke-app` (React 19 web app, built with Create React App and Tailwind) |
| Rules version (`RULESET_ID`) | `BOB-DIGITAL-ASSEMBLY-20261013-v1` (in `src/rules/config/core.json`) |
| NIL tier table | `BOB-NIL-RESET-2026-01` (in `src/rules/config/nil_tiers.json`) |
| Board | `BOB-ORIGINAL-40-DIGITAL-v1`: 40 spaces, numbered 0–39 (in `src/rules/config/board.json`) |
| Save format | Browser saves start with `bagorbroke_v2_save_` (`SAVE_PREFIX`). Older `bagorbroke_save_` saves are deleted on load. |
| Group play backend | Supabase: database tables, realtime updates, and small server functions ("edge functions") |
| AI summary | A separate Node server (`server/server.js`, hosted on Render) writes the end-of-game summary |

How the parts fit:

- **Rules engine (`src/rules/`)**: every money and game rule lives here. The main file is
  `ledger.js`. Every player action is an *operation* (for example `roll`, `buy`, `pay_taxes`)
  passed to `applyOp(state, op)`, which returns the new game state. Each operation has a unique id,
  and the same id is never applied twice, so retries and reconnects cannot double-charge or
  double-move a player. Money is stored in whole cents (`integer_cents`) and rounded half-up.
- **Screens (`src/components/`)**: `PlayerDashboard.js` is the main game screen. It holds the game
  state through `useLedger` (`src/hooks/useLedger.js`) and only *displays* values from it.
  `TurnTracker.jsx` logs rolls and shows lap/year. `FinancePanel.jsx` shows cash, loans and taxes.
  `RoomHUD.jsx` is the group leaderboard.
- **Group play (`src/utils/roomApi.js`, `supabase/functions/`)**: `createRoom`, `joinRoom`,
  `startGame`, `leaveRoom`, `rejoinRoom`, `cleanupRooms`.
- **Saves**: the device save is in browser storage. Group players also get a server copy
  (`player_saves` table, `src/utils/saveApi.js`).
- **Tests**: `src/rules/__tests__/`, `src/components/__tests__/`, `src/__tests__/`.
  Run with `CI=true npx react-scripts test --watchAll=false`.

## 2. Game-state fields

The full game state for one player is the ledger object made by `createLedger()` in
`src/rules/ledger.js`. Everything else on screen is calculated from it. The most important fields:

| Field | Meaning |
|---|---|
| `progress` | Total board steps taken since the start. One lap = `boardSize` (40) steps. The single source of truth for position, lap and year. |
| `totalLaps` | Game length: 5 or 10 laps. |
| `diceCount` | 1 or 2 dice, locked at the first roll. |
| `turn` | Number of the player's own turns so far. Used for deadlines and "next turn" timing. |
| `cash` | Available Cash, in cents. |
| `taxBucket` | Money set aside for taxes (20% of NIL income), in cents. |
| `taxIncome`, `taxBills`, `closedLaps` | Taxable income per lap, the tax bill made when each lap closes, and which laps are closed. |
| `loans`, `creditScore`, `checkpoints` | Borrowing, credit score, and the credit checks at lap closes. |
| `assets` | Everything owned: investments, property and renovations, luxury items, insurance, annuities, tokens, company stakes. |
| `opportunity`, `requireLanding` | The current landing (which space the player is on and whether its action has been used). |
| `tasks`, `scheduled`, `payables` | Pending tasks, scheduled future events, and bills still owed. |
| `points` | REP and Career points (`points.rep`, `points.career`). |
| `scenario`, `scenarioHistory` | The curveball card being answered and past curveballs. |
| `yellow`, `yellowHistory` | NIL opportunity (yellow space) in progress and past ones. |
| `career` | Career (purple space) progress. |
| `nilTier`, `nilPaidToDate` | The player's NIL tier and NIL paid so far. NIL valuation is not cash. |
| `journal`, `seq` | Running log of every change and its sequence number. `seq` increases by 1 per change. |
| `receipts` | The result of every operation id already applied (this is what blocks duplicates). |
| `snapshot` | Set when the player finishes; freezes the final score. |

Calculated values (functions, not stored):

| Function | Meaning |
|---|---|
| `completedLaps(state)` | Laps fully finished: `progress / 40`, rounded down, capped at `totalLaps`. |
| `currentYear(state)` | Year in progress. **One lap = one year**: the year equals the lap being played (`completedLaps + 1`), and stays at the last year once all laps are done. Same as `incomeLap(state)`. |
| `position(state)` | Board space 0–39. |
| `inFinalWindow(state)` | All laps complete; only settling up and finishing remain. |
| `totalBorrowing`, `taxesOwed`, `eventLiabilities` | Debt totals. |
| `scoreBreakdown` (`portfolio.js`) | Net worth and score at the end. |

Group leaderboard row (`player_state` table), a short public summary of each player:
`room_id`, `player_id`, `name`, `avatar`, `cash` (whole dollars, Available Cash + Tax Bucket),
`debt`, `credit`, `rep`, `laps` (completed laps), `redCurveballLoss`, `blueCurveballLoss`,
`investments`, `luxuries`, `updated_at` (last time the player's device checked in).

Room (`rooms` table): `id`, `code`, `status` (`lobby`, `started`, `completed`, `abandoned`),
`host_player_id`, `host_name`, `total_laps`, `updated_at`.

## 3. Multiplayer and offline recovery

**Rule: a player stays in their group until they press "Leave room". Closing the tab, refreshing,
losing signal or the phone sleeping never removes them.**

How it works:

1. **Joining.** `joinRoom` adds a seat (`player_state` row) while the room is in the lobby. Names
   must be unique in a room, because the name identifies the seat when rejoining from another device.
2. **While playing.** Every change is saved to the device right away. The leaderboard row is updated
   (`syncToRoom`), and a check-in (heartbeat) is sent every 10 seconds. A server copy of the full
   game is uploaded 3 seconds after the latest change (`putServerSave` → `player_save_put`).
3. **Going offline.** After 30 seconds without a check-in, other players see "Offline · still in
   group". The offline player's seat, score and holdings stay. Changes made while offline are kept
   in a queue (`pendingSyncRef`) and retried with growing waits (2 s up to 30 s) until they reach
   the group. A yellow banner says "Reconnecting to your group…". The realtime connection retries
   with no limit.
4. **Coming back on the same device.** On return to the tab or when the internet comes back, the app
   reconnects at once, reloads every player's row, and resends this player's full row
   (`pushFullStateRef`). If the page was closed, reopening the app asks "Rejoin your group game
   (room CODE) as NAME?" and returns the player to the **same room and seat** (`rejoinRoom` with
   `roomId` + `playerId`), never to a private copy.
5. **Coming back on another device.** Enter the same room code and the same name on the Join screen.
   If that seat is offline, `rejoinRoom` (with `code` + `name`) returns the player to it with the
   server copy of their game. An active seat (checked in within 30 seconds) cannot be taken.
6. **Which copy wins.** If the device copy and the server copy differ, the one further along wins:
   higher `progress` first, then higher `seq` (`newerSave`). The server refuses to replace a copy
   with an older one. Because operations are never applied twice (`receipts`), a restored game does
   not repeat turns, charges, or penalties.
7. **Leaving on purpose.** "Leave room" calls `leaveRoom`, which removes the seat and its server save.
   Declining the "Rejoin?" prompt asks a second time ("Leave that group game for good?"), so one
   wrong tap does not remove anyone.

Everything listed in Fix Log #5 is recovered because it is all part of the ledger: score/net worth,
cash, investments, property and renovations, debt, board position, lap, year, turn status, completed
and pending tasks. Group membership is the `player_state` seat, which is now kept.

## 4. Board categories and rules

40 spaces, numbered 0–39, starting bottom left and going up the left edge (`board.json`).

| Color (code name) | App category label | Count | What the app does on landing |
|---|---|---|---|
| Start (`start`), shown white `#FFFFFF` | Start | 1 (space 0) | Passing it closes the lap/year: lap award, tax bill, credit check. Landing exactly on it (not on the final lap) only gives a receipt and ends the turn. |
| Green (`green`) | Investments | 9 | Opens the Invest tab; one purchase per landing. |
| Diamond (`diamond`), pale aqua `#A6F1FE` | Lifestyle and Luxury | 7 | Opens the Luxury tab; one purchase per landing. |
| Red (`red`) | Financial Curveballs | 7 | Draws a financial curveball card. |
| Blue (`blue`) | Lifestyle and Sport Curveballs | 4 | Draws a lifestyle/sport curveball card. |
| Purple (`purple`) | Career and Professional Development | 6 | Career opportunity. |
| Yellow (`yellow`) | NIL Opportunities | 6 | NIL deal offer. |

Lap and year: one lap = one year. The year advances when the player's roll passes Start.
Every year-based rule (taxes, lap award, loan interest, credit checks, scheduled events) uses
the same `progress` value, so it stays correct after a reconnect.

**Open:** the "white board space" in Fix Log #4. In the app, the only white space is Start (space 0).
The diamond spaces are a very pale aqua and may look white on the printed board. Not changed until
confirmed (see section 6).

## 5. Recent changes

| Date | Issue | Cause | Change | Affected areas | Test result |
|---|---|---|---|---|---|
| 2026-10-26 | #3 Group play: players disappear after going offline and continue privately | Closing or refreshing the page called `leaveRoom`, which deleted the player's seat. Reopening the app always resumed in **offline** mode. Reconnects stopped after 5 tries; failed updates were dropped after 3 tries. | Removed leave-on-close. Saves now remember the room and seat (`room` in the save). Reopening asks to rejoin the same room. New `rejoinRoom` function. Unlimited reconnects, plus an immediate reconnect when the tab or internet comes back. Offline players show "Offline · still in group" instead of crossed out. "Leave room" warning now says it removes you. Duplicate names are blocked at join. | `PlayerDashboard.js`, `App.js`, `RoomScreen.jsx`, `RoomHUD.jsx`, `roomApi.js`, `supabase/functions/rejoinRoom`, `supabase/functions/joinRoom` | Automated tests pass (`src/__tests__/sessionRecovery.test.js`). Live multi-device test with Jabari: **pending**. |
| 2026-10-26 | #5 Session recovery: progress or group lost on reconnect | Same as #3, and there was no server copy of a player's game, so another device or a cleared browser started over. | Server copy of each group player's game (`player_saves` table, `player_save_put`, `player_save_get`). It only accepts newer copies. Rejoin restores the furthest-along copy. Failed changes are queued and merged until they land. Full row is resent after every reconnect. | `supabase/migrations/20261026000000_player_saves.sql`, `saveApi.js`, `PlayerDashboard.js` | Automated tests pass. Database functions tested on Postgres 16 (older copy refused, same copy refused, newer accepted, non-member refused, save removed on leave). Live test: **pending**. |
| 2026-10-26 | #6 Lap and year counters out of sync ("Lap 4 of 5" with "Year 5") | The tracker showed laps **completed** ("4 / 5 complete") while the header showed the year **in progress** (5). Both were right, but they read as different numbers. | One lap = one year, from one function (`currentYear`). Header: "Year 5 of 5 · Lap 5". Tracker: "Year 5 of 5 · Lap 5" with "4 of 5 laps complete" underneath. Tax bills: "Year 1 tax (Lap 1)". | `ledger.js`, `TurnTracker.jsx`, `PlayerDashboard.js`, `FinancePanel.jsx` | Automated tests pass, including after a restored save. Live test: **pending**. |
| 2026-10-26 | #4 White board space | Unclear which space and category are meant. | **No change**, waiting for confirmation (see section 6). | none | n/a |
| 2026-10 | NIL tier reset (BOB-NIL-RESET-2026-01) | New approved tier names and valuations. | `nil_tiers.json` updated; valuation shown separately from cash. | `nil_tiers.json`, `tiers.js`, `NilPanel` | Tests pass |
| 2026-10 | Spec packets (bobupdates phases 0–7 + follow-ups) | New rules from the spec packets. | Central rules engine, finance, holdings, NIL, career, curveballs, reveal, Coach J-Bo credits, shared sports-complex share market. | `src/rules/`, most screens | Tests pass |

## 6. Known issues and open decisions

**Needs a decision from Jabari**

- **#4 White board space.** Which space is it (space number or position on the printed board)?
  Is it (a) the Start corner, (b) the pale diamond spaces (Lifestyle and Luxury), or (c) a space
  that is printed white on the board but mapped to a different color in the app? What category
  and action should it have? Not changed until confirmed.
- **Stale rooms.** Offline players now keep their seats, so a room stays open until everyone
  presses Leave. Suggested rule: close a started room after 7 days with no check-ins. Not built yet.

**Known limits**

- **Same seat open on two devices at once.** The copy that is further along wins, so moves made on
  the other device at the same time can be lost. Play each seat on one device at a time.
- **Rejoining from another device uses room code + name** (there are no accounts). Anyone with the
  code and name could take a seat while it is offline. Mitigated: active seats cannot be taken, and
  names are unique per room.
- **Turn order is not enforced by the app.** Each player logs their own rolls; "turn status" is per
  player (`turn`, `opportunity`).

**Waiting on deployment (needed before live testing)**

- Apply the database migrations: `npx supabase db push`
  (`20261013000000_shared_ventures.sql`, `20261026000000_player_saves.sql`).
- Deploy the server functions: `npx supabase functions deploy rejoinRoom` and
  `npx supabase functions deploy joinRoom`.
- Redeploy `server/server.js` on Render (AI summary uses the rules-assigned result).

**Waiting on approval**

- Numbers in `authored_producers.json` (marked as recommendations).
- NIL payout timing and opening-cash policy (reopened by BOB-NIL-RESET-2026-01).
