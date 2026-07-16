---
baseline_commit: 15fe76762de587e131ad7655c7226a9d45bcc09c
---

# Story 2.6: Vanishing opponents forfeit — fairly

Status: done

<!-- Process note (revised 2026-07-16, PRD D23 — supersedes the D18 note that was here):
     AI implements this story fully via bmad-dev-story, including tests, commit, PR, and merge.
     Danilo approved by marking it ready-for-dev. Keep summaries in plain, simple English. -->

<!-- Writing note (from the Epic 1 retro): keep this spec in plain, simple English. Short sentences.
     Define each new term the first time it appears. Prefer examples over abstract description. -->

## Story

As a player,
I want to win by forfeit when my opponent truly disconnects, but not when their Wi-Fi hiccups,
so that matches end fairly.

**Plain-English goal:** Today, if your opponent closes their tab mid-game, nothing happens — you're
stuck. This story makes the server **notice** when a player really leaves and end the match in your
favor (a "forfeit"). The trick is telling a *real* disconnect from a *momentary* blip: Socket.IO is
configured so a vanished player is detected in about **10 seconds**, and a quick hiccup inside that
window does nothing. When a forfeit fires, you (the one still here) land on the result screen as the
winner, and the finished match is cleaned out of server memory. This is the last Epic 2 story — it also
lands the **eviction** that was deferred from 2.5.

**Terms used in this story (defined once):**
- **disconnect** — Socket.IO fires a `disconnect` event on a socket when the connection is lost (tab closed, refresh, network gone) — but only after the ping window decides the client is really gone.
- **`pingInterval` / `pingTimeout`** — Socket.IO server settings. The server pings every `pingInterval`; if no pong comes back within `pingTimeout`, the client is declared gone. Detection time ≈ `pingInterval + pingTimeout`. Defaults (~25s + 20s ≈ 45s) are too slow for FR5; we set them so it's ≈10s.
- **forfeit** — a match ending because a player *left*, not because of the game rules. The remaining player wins. A new end reason `'forfeit'` (alongside `allCards` / `roundCap`).
- **eviction** — removing a finished/abandoned match from the in-memory `matchStore` (`deleteMatch`). The clause deferred from story 2.5's AC1.
- **blip** — a momentary connection wobble that recovers inside the ping window; it must NOT forfeit.

## Acceptance Criteria

(Verbatim from epics.md#Story-2.6, split for traceability.)

1. **Given** the server's Socket.IO config, **then** `pingInterval`/`pingTimeout` are explicitly set so a vanished client is detected in ≈10s, not the ~45s defaults (FR5).
2. **Given** my opponent's connection drops past the window (or closes cleanly), **when** the server detects it, **then** the match ends with reason `forfeit`, I see the ResultScreen as winner, and the store entry is evicted.
3. **Given** a momentary blip within the window, **then** the match continues unaffected.
4. **And** a mid-match page refresh counts as a disconnect → forfeit (documented v1 behavior; reconnect is the planned follow-up).

## Tasks / Subtasks

- [x] **Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes**
  - [x] **6a — The ping config (AC1).** Set `pingInterval` + `pingTimeout` in the Socket.IO `Server` options (`server.ts`) so detection ≈10s — the architecture's example is `5000` + `5000`. Record the chosen values and the math (`pingInterval + pingTimeout ≈ detection`).
  - [x] **6b — How a forfeit is represented. ⚠️ engine touch.** A forfeit isn't a game-rule end, so the engine never produces it — but the result screen needs `result.reason === 'forfeit'`. Decide: **add `'forfeit'` to the engine `EndReason`** and add a small **pure** engine helper `forfeitMatch(state, winnerId): MatchState` that returns `{ ...state, result: { winner: winnerId, reason: 'forfeit' } }`. The server calls it, then `projectFor` → `match:ended` (so `projectFor` stays the only door — the server does NOT hand-build a payload). Record. (Alternative — server hand-sets `result` on the state — rejected: keep state construction in the engine.)
  - [x] **6c — Mapping a socket to its match.** On `disconnect` the handler only has `socket.id`. Add a store helper `findMatchBySocketId(socketId): MatchEntry | undefined` (scan the Map — fine at this scale; a socketId→matchId index is premature). Record.
  - [x] **6d — What disconnect does, per match status.** Branch on the entry's `status`:
    - **`playing`** → forfeit: the OTHER player wins. `forfeitMatch(entry.state, otherPlayerId)` → `projectFor` → emit `match:ended` to the remaining player's socket → `deleteMatch` (evict).
    - **`waiting`** (creator left before anyone joined — 1 player) → just `deleteMatch` (evict the abandoned lobby; no one to notify).
    - **`ended`** (both on the result screen, maybe mid-rematch) → notify the remaining player their opponent left (clear their stuck "waiting for rematch" — see 6e) and `deleteMatch`.
    Record the branches.
  - [x] **6e — Telling the remaining player on the result screen "opponent left."** If a player is sitting on the result screen (possibly having clicked Rematch → `rematchPending`) and the opponent disconnects, they must not be stuck. Recommended: emit a `match:error` (e.g. "Opponent left the match") to the remaining player — the reducer's `match/error` already **clears `rematchPending`** (added in the 2.5 review), so the button un-sticks and the message shows. Record. (This resolves the 2.5-deferred one-sided-rematch exit.)
  - [x] **6f — Blip vs real disconnect (AC3).** No manual debounce needed: Socket.IO only fires `disconnect` *after* `pingTimeout` (a blip that recovers within the window never fires it). So AC3 falls out of the 6a config + relying on the built-in `disconnect` timing. Record that we lean on Socket.IO here, not a custom timer.
  - [x] **6g — Eviction lands here (AC1 from 2.5 + AC2).** Add `deleteMatch(matchId)` to the store and call it on forfeit / abandoned-lobby / ended-cleanup. Note: a match where *both* players idle on the result screen forever (neither rematches nor disconnects) still isn't evicted — that abandoned-TTL stays deferred (`deferred-work.md`). Record.

- [x] **Task 2: Engine — the forfeit end reason (AC: 2)** — `packages/engine`
  - [x] `types.ts`: add `'forfeit'` to `EndReason` (`'allCards' | 'roundCap' | 'forfeit'`).
  - [x] New pure helper (e.g. `match/forfeit.ts`): `forfeitMatch(state: MatchState, winnerId: PlayerId): MatchState` → returns the state with `result: { winner: winnerId, reason: 'forfeit' }` (immutable copy; no throw, no I/O). Export from `index.ts`. Co-located test.
  - [x] Engine stays pure — no socket/server imports. [Source: architecture.md — engine boundary]

- [x] **Task 3: Server — ping config + disconnect → forfeit + eviction (AC: 1, 2, 3, 4)** — `packages/server`
  - [x] `server.ts`: add `pingInterval` + `pingTimeout` to the `new Server(httpServer, { … })` options (6a). Keep the existing `cors`.
  - [x] `store/matchStore.ts`: add `findMatchBySocketId(socketId)` (6c) and `deleteMatch(matchId)` (6g).
  - [x] `sockets/matchHandlers.ts`: inside `io.on('connection', (socket) => { … })`, add `socket.on('disconnect', () => { … })`. Look up the match by `socket.id`; if none, return. Branch by status (6d): `playing` → `forfeitMatch` (the other player wins) → `projectFor` → `io.to(remainingSocketId).emit('match:ended', view)` → `deleteMatch`; `waiting` → `deleteMatch`; `ended` → emit `match:error` "Opponent left" to the remaining player → `deleteMatch`.
  - [x] Reuse `buildStartViews` / `projectFor` for the per-player emit; never hand-build a payload. The disconnected socket gets nothing (it's gone). [Source: architecture.md — Enforcement Guidelines]
  - [x] A mid-match refresh (AC4) fires `disconnect` (transport close) → the same forfeit path; the refreshing player's reload starts fresh (home/join). Reconnect/grace-resume is the deliberate follow-up (D16), NOT this story.

- [x] **Task 4: Client — render the forfeit + un-stick the result screen (AC: 2)** — `packages/client`
  - [x] `components/ResultView.tsx`: add `forfeit` to the reason map (e.g. `forfeit: 'Opponent left — you win'`). The forfeit `match:ended` already flows through `match/ended` → `result` screen → ResultView (winner = you), so no new wiring beyond the label.
  - [x] Confirm the "opponent left during result/rematch" path (6e): the `match:error` arrives → reducer `match/error` sets the message + clears `rematchPending` → ResultView shows it and the Rematch button un-sticks. (If you want a dedicated banner instead of reusing the error, decide and record.)
  - [x] No ping/disconnect code on the client — Socket.IO handles the transport; the client only reacts to `match:ended` / `match:error`.

- [x] **Task 5: Tests — AI-written**
  - [x] Engine: `forfeitMatch` sets `result: { winner, reason: 'forfeit' }`, leaves the rest of the state intact, and does not mutate the input.
  - [x] Store: `deleteMatch` removes the entry (`getMatch` → undefined after); `findMatchBySocketId` returns the entry containing that socketId, or undefined.
  - [x] **Disconnect resolution — keep it socket-free:** extract the decision into a pure helper (e.g. `resolveDisconnect(entry, socketId) → { kind: 'forfeit', winnerId } | { kind: 'abandon' } | { kind: 'opponentLeft', remainingId } | { kind: 'none' }`) and unit-test the branches (playing → forfeit the other player; waiting → abandon; ended → opponentLeft). The `socket.on('disconnect')` handler then just executes the helper's decision. The live socket disconnect round-trip is manual-verified (the 2.1–2.5 stance).
  - [x] Engine end rules unchanged — do NOT retest `allCards`/`roundCap`.
  - [x] (If the client jsdom infra ever lands — still deferred — a ResultView forfeit-label render test; otherwise manual.)

- [x] **Task 6: Prove it (AC: all)**
  - [x] `npm run dev`, two tabs, mid-match. **Close** one tab → within ~10s the other tab flips to the ResultScreen as the **winner**, reason "Opponent left". (Manual smoke.)
  - [x] **Refresh** one tab mid-match (AC4) → the other gets the forfeit win; the refreshed tab reloads to home/join. Confirm.
  - [x] **Blip (AC3):** briefly toggle the network (DevTools offline → online quickly, within the window) → the match continues, no forfeit. (Best-effort manual check.)
  - [x] Forfeit on the **result/rematch** screen: one player on the result screen, the other closes → the remaining player's "waiting for rematch" un-sticks with an "opponent left" message.
  - [x] Confirm the match is **evicted** (a `selectStat`/`rematch` to the dead matchId → `MATCH_NOT_FOUND`).
  - [x] `npm run typecheck` clean; `npm test` green; `npm run format`.
  - [x] Commit on `story/2.6`, push, open PR, run `bmad-code-review` per process.

### Review Findings

Code review 2026-07-16 (three parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor; auditor verdict: all 4 ACs + all architecture constraints satisfied). Triage: 3 patch, 4 defer, 8 dismissed as noise.

- [x] [Review][Patch] `match/ended` did not clear a stale in-match error, which the new ResultView error line would then display [packages/client/src/state/reducer.ts] — fixed: `error: null` on `match/ended` + reducer test.
- [x] [Review][Patch] Rematch button still offered after forfeit/opponent-left although the match entry is evicted (click → MATCH_NOT_FOUND loop) [packages/client/src/components/ResultView.tsx] — fixed: button hidden when `reason === 'forfeit'` or an error is shown.
- [x] [Review][Patch] `playing` forfeit with `state: null` would evict silently, stranding the survivor with no event [packages/server/src/sockets/matchHandlers.ts] — fixed: defensive `match:error OPPONENT_LEFT` fallback (invariant makes it unreachable today).
- [x] [Review][Defer] Never-joined POST matches leak forever (no socketId to clean up by) — deferred, pre-existing; folded into the TTL sweep item in deferred-work.md.
- [x] [Review][Defer] Forfeited player who silently reconnects is stuck on a dead match screen — deferred; this is the D16 grace-period-reconnect follow-up.
- [x] [Review][Defer] One socket can join two `waiting` matches; disconnect cleans only the first — deferred, pre-existing join-hardening gap (deferred-work.md).
- [x] [Review][Defer] In-flight selectStat racing the forfeit shows a stray "Match not found" on the result screen — deferred, cosmetic race (deferred-work.md).

## Dev Notes

### Working agreement (binding)

- Revised 2026-07-16: AI implements everything in this story (code, tests, Dev Agent Record, git). Danilo's role is feature request + approval; this story counts as approved (ready-for-dev). [Source: addendum.md#Working-agreement; D23]

### Scope guard — what is NOT in 2.6

- **No reconnect / grace-resume.** A dropped or refreshed player forfeits; they do not get to rejoin the same match. Reconnect (using the per-player token seam) is the **deliberate first follow-up** (decision D16) — explicitly out of scope.
- **No persistence** (FR27/28) → Epic 3.
- **No abandoned-match TTL** for matches where both players idle on the result screen forever (neither rematches nor disconnects) — still deferred (`deferred-work.md`). 2.6 evicts on disconnect/forfeit, which covers the real cases.
- **No new game rules** — the engine's round/end logic is untouched; `forfeit` is a server-driven end reason, represented via the small `forfeitMatch` state helper.
- Counter-metric (PRD): time-to-playable — this is the last correctness story for Epic 2; keep it tight.

### Architecture constraints that bind this story

- **Disconnect detection is configured, not defaulted:** Socket.IO defaults (~45s) violate FR5's ~10s window; set `pingInterval`/`pingTimeout` explicitly. [Source: architecture.md — API & Communication Patterns; "Disconnect detection configured, not defaulted"]
- **Disconnect (transport) feeds a game-level rule (forfeit), kept decoupled:** the transport layer detects the drop; the forfeit is a match-end the server applies via the engine helper + `projectFor`. [Source: architecture.md — Cross-Cutting Concerns #5]
- **`projectFor` is the only door:** the forfeit `match:ended` payload is a `PlayerView` from `projectFor(forfeitedState, winnerId)` — never a hand-built object. [Source: architecture.md — Enforcement Guidelines; NFR2]
- **Eviction:** finished matches are removed from `matchStore` (the architecture's "evict after `match:ended`"); this story adds `deleteMatch` and the disconnect triggers that finally exercise it. [Source: architecture.md — Validation Issues Addressed #1]
- **In-memory state + instant forfeit are mutually consistent** (server restart kills in-flight matches — accepted; reconnect later). [Source: architecture.md — Data Architecture]
- **Engine pure; client TYPES only; one reducer; `domain:action` events.** [Source: architecture.md]

### Recorded tech choices / engine API used (already built + tested)

- `projectFor(state, playerId): PlayerView` — reused to project the forfeited state (it already carries `result` + `roundsPlayed`).
- `MatchResult = { winner: PlayerId, reason: EndReason }`; `EndReason` gains `'forfeit'` (2.6).
- Socket.IO 4.8 `Server` options: `pingInterval`, `pingTimeout` (numbers, ms).
- `match:ended` (server→client, `PlayerView`) and `match:error` (server→client) — both already in the protocol; reused, no new events needed.

### Previous work intelligence (story 2.5 + the deferred list)

- **No `disconnect` handler exists yet** — `io.on('connection')` in `matchHandlers.ts` registers only `match:join` / `match:selectStat` / `match:rematch`. 2.6 adds `socket.on('disconnect', …)`.
- **The store** is `MatchEntry { matchId, status: 'waiting'|'playing'|'ended', players: Player[]{playerId,token,nickname,socketId}, createdAt, state, rematchAccepted }` with `createMatchEntry/getMatch/addPlayer/startMatch/updateMatchState/endMatch/acceptRematch`. 2.6 adds `findMatchBySocketId` + `deleteMatch`. `status: 'ended'` is set by `endMatch` (2.5 review).
- **2.5 review carryovers that land here:** the **eviction** (no `deleteMatch` existed — AC1 was unmet) and the **one-sided-rematch stuck "waiting"** (now resolved via the disconnect → `match:error` path; the reducer's `match/error` already clears `rematchPending`).
- **`buildStartViews(state, players)`** projects per player → reuse for the forfeit emit (only the remaining player's socket actually receives it). Name is start-flavored; rename to `buildPlayerViews` someday.
- **The reducer already routes `match:ended` → `result` screen** and `match:error` → message + clears `rematchPending`. So 2.6's client work is mostly the forfeit reason label.
- **socket.id changes across connections** — that's exactly why a refresh = a *new* socket = the old one disconnects → forfeit (AC4), and why reconnect (token-based) is deferred.
- Tests at the start of 2.6: 149 green. Socket integration + client DOM tests deferred throughout — keep the disconnect logic in a pure, testable helper.

### Git intelligence

- Branch `story/2.6` off `main` (2.5 merged via PR #15). Rhythm: hand-write → AI writes tests → green → commit → push → PR → `bmad-code-review` → merge. This is the **last Epic 2 story** — after merge, the epic-2 retrospective (optional) can run.

### Technical notes

- **Detection math (6a):** `pingInterval + pingTimeout` is the worst-case detection time. `5000 + 5000 = 10000 ms` ≈ the FR5 window. A clean tab close fires `disconnect` faster (transport close), so forfeits on a real close are near-instant; only a *silent* network drop waits the full window.
- **Forfeit winner = the player who is NOT the disconnected one.** With 2 players, find the entry's other player by `playerId !== disconnectedPlayerId` (resolve the disconnected player from the entry via `socket.id`).
- **Only emit to the survivor.** The disconnected socket is gone — emitting to it is a no-op; emit to the remaining player's stored `socketId`.
- **Evict after emitting**, not before — build views + emit, then `deleteMatch`.
- **Keep the disconnect *decision* pure** (`resolveDisconnect`) so it's unit-testable without a live socket; the handler is then a thin "decide → execute → evict".

### Project Structure Notes

- Update (engine): `types.ts` (`EndReason` += `'forfeit'`); new `match/forfeit.ts` (+ test); `index.ts` export.
- Update (server): `server.ts` (ping options); `store/matchStore.ts` (`findMatchBySocketId`, `deleteMatch`); `sockets/matchHandlers.ts` (`disconnect` handler; optional pure `resolveDisconnect` helper + test).
- Update (client): `components/ResultView.tsx` (forfeit reason label).
- Matches the architecture tree; no new packages. [Source: architecture.md — Complete Project Directory Structure]

### References

- [Source: epics.md#Story-2.6] — story statement + ACs (verbatim)
- [Source: architecture.md — API & Communication Patterns; Cross-Cutting Concerns #5; Validation Issues Addressed #1] — ping config for ~10s; disconnect→forfeit decoupling; eviction
- [Source: prd.md — FR5; NFR2] — disconnect detection window + forfeit; hidden-info
- [Source: .decision-log.md#D16] — instant forfeit in v1; grace-period reconnect named as the first follow-up
- [Source: implementation-artifacts/2-5-…-result-screen-and-a-rematch.md] — ResultView/match:ended/match:error wiring + the deferred eviction & one-sided-rematch exit this story closes
- [Source: addendum.md#Working-agreement; .decision-log.md#D23] — AI implements; Danilo approves

## Dev Agent Record

<!-- AI fills File List & Completion Notes at completion.
     The review workflow (bmad-code-review) uses this section. -->

### Agent Model Used

claude-fable-5 (first story under the D23 full-automation agreement; Danilo had already made the Task 2 EndReason type change by hand before handoff).

### Debug Log References

### Completion Notes List

Decisions:
- 6a — ping config: `pingInterval: 5000` + `pingTimeout: 5000` in `server.ts` → worst-case detection ≈ 5000 + 5000 = 10000 ms (FR5). A clean close (tab closed, refresh) fires `disconnect` near-instantly via transport close.
- 6b — forfeit representation: `EndReason` += `'forfeit'` (types.ts) + pure `forfeitMatch(state, winnerId)` in `packages/engine/src/match/forfeit.ts`, exported from `index.ts`. Server calls it, then `projectFor(forfeited, winnerId)` → `match:ended`. No hand-built payload (NFR2). Alternative (server hand-sets `result`) rejected per story.
- 6c — socket→match lookup: `findMatchBySocketId(socketId)` in `matchStore.ts` — linear scan of the Map; index deemed premature at this scale.
- 6d — disconnect per status, kept as a pure decision helper `resolveDisconnect(entry, socketId)` (`packages/server/src/sockets/resolveDisconnect.ts`) returning `forfeit { winnerId, remainingSocketId } | abandon | opponentLeft { remainingSocketId } | none`. Handler executes: playing → forfeit other player, emit `match:ended` to survivor; waiting → evict silently; ended → `match:error` to survivor; then `deleteMatch` (except `none`).
- 6e — "opponent left" on result screen: reused `match:error` with a new wire code `OPPONENT_LEFT` (added to `WireErrorCode` in engine protocol). Reducer already clears `rematchPending` on `match/error`. **Addition decided here:** ResultView did not render `state.error`, so an `error` prop was added to ResultView (rendered with `role="alert"`) and App passes `state.error` — otherwise the message would be invisible on the result screen. No dedicated banner; the error line suffices for v1 UI.
- 6f — blip vs disconnect: rely on Socket.IO — `disconnect` only fires after the ping window; no custom debounce/timer added.
- 6g — eviction: `deleteMatch(matchId)` added to the store; called on all three disconnect branches. Both-players-idle-forever TTL stays deferred (`deferred-work.md`).

Verification:
- TDD: 12 new tests written first (red: module-not-found/function-missing), then implementation (green). Suite: 149 → 161 tests, all green. `npm run typecheck` clean, `npm run format` applied.
- Live smoke (automated socket-level, replacing the two-browser-tabs manual): real server + two `socket.io-client` connections. Verified: mid-match disconnect → survivor receives `match:ended` with `reason: 'forfeit'`, `winner === you`, in <0.1s on clean close (AC2); `selectStat` to the dead matchId → `MATCH_NOT_FOUND` (eviction, AC2); abandoned waiting lobby evicted (6d); an idle match inside the ping window does not forfeit (AC3, best-effort — a true mid-transfer network blip was not simulated). AC4 (refresh) shares the exact clean-close code path (old socket fires `disconnect`); browser-level refresh/DevTools-offline spot-checks left as optional follow-up.
- First story implemented under the D23 full-automation agreement.

### Change Log

- 2026-07-16 — Story 2.6 implemented (forfeit on disconnect, ~10s detection, match eviction, opponent-left un-stick on result screen). Engine: `EndReason` += forfeit, `forfeitMatch` helper. Server: ping config, `findMatchBySocketId`/`deleteMatch`, `disconnect` handler + pure `resolveDisconnect`. Protocol: `OPPONENT_LEFT` wire code. Client: forfeit reason label + error line on ResultView. Tests 149 → 161.
- 2026-07-16 — Addressed code review findings: 3 patches applied (clear error on `match/ended`; hide Rematch when the opponent is gone; defensive fallback emit on null-state forfeit), 4 items deferred to deferred-work.md, 8 dismissed as noise. Tests 161 → 162. Story → done.

### File List

- packages/engine/src/types.ts (modified — `EndReason` += `'forfeit'`; hand-edited by Danilo pre-handoff, kept)
- packages/engine/src/match/forfeit.ts (new)
- packages/engine/src/match/forfeit.test.ts (new)
- packages/engine/src/index.ts (modified — export `forfeitMatch`)
- packages/engine/src/protocol/events.ts (modified — `OPPONENT_LEFT` in `WireErrorCode`)
- packages/server/src/server.ts (modified — `pingInterval`/`pingTimeout`)
- packages/server/src/store/matchStore.ts (modified — `findMatchBySocketId`, `deleteMatch`)
- packages/server/src/store/matchStore.test.ts (modified — 4 new tests)
- packages/server/src/sockets/resolveDisconnect.ts (new)
- packages/server/src/sockets/resolveDisconnect.test.ts (new)
- packages/server/src/sockets/matchHandlers.ts (modified — `disconnect` handler)
- packages/client/src/components/ResultView.tsx (modified — forfeit label, error prop; review patch: hide Rematch when opponent gone)
- packages/client/src/App.tsx (modified — pass `state.error` to ResultView)
- packages/client/src/state/reducer.ts (modified — review patch: clear `error` on `match/ended`)
- packages/client/src/state/reducer.test.ts (modified — review patch regression test)
- _bmad-output/implementation-artifacts/deferred-work.md (modified — 4 deferred review findings)
