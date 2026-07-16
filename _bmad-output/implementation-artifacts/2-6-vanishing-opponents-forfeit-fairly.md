# Story 2.6: Vanishing opponents forfeit — fairly

Status: ready-for-dev

<!-- Process note (binding, per PRD addendum & D18): Danilo hand-writes ALL code.
     This story is a step-by-step guide + review contract, NOT a spec for a code-generating agent.
     AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills the Dev Agent Record (Completion Notes, File List) at completion;
     config/tooling/server-setup files AI may edit directly (confirmed 2026-06-22).
     Do NOT run bmad-dev-story as designed on this story. -->

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

- [ ] **Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes**
  - [ ] **6a — The ping config (AC1).** Set `pingInterval` + `pingTimeout` in the Socket.IO `Server` options (`server.ts`) so detection ≈10s — the architecture's example is `5000` + `5000`. Record the chosen values and the math (`pingInterval + pingTimeout ≈ detection`).
  - [ ] **6b — How a forfeit is represented. ⚠️ engine touch.** A forfeit isn't a game-rule end, so the engine never produces it — but the result screen needs `result.reason === 'forfeit'`. Decide: **add `'forfeit'` to the engine `EndReason`** and add a small **pure** engine helper `forfeitMatch(state, winnerId): MatchState` that returns `{ ...state, result: { winner: winnerId, reason: 'forfeit' } }`. The server calls it, then `projectFor` → `match:ended` (so `projectFor` stays the only door — the server does NOT hand-build a payload). Record. (Alternative — server hand-sets `result` on the state — rejected: keep state construction in the engine.)
  - [ ] **6c — Mapping a socket to its match.** On `disconnect` the handler only has `socket.id`. Add a store helper `findMatchBySocketId(socketId): MatchEntry | undefined` (scan the Map — fine at this scale; a socketId→matchId index is premature). Record.
  - [ ] **6d — What disconnect does, per match status.** Branch on the entry's `status`:
    - **`playing`** → forfeit: the OTHER player wins. `forfeitMatch(entry.state, otherPlayerId)` → `projectFor` → emit `match:ended` to the remaining player's socket → `deleteMatch` (evict).
    - **`waiting`** (creator left before anyone joined — 1 player) → just `deleteMatch` (evict the abandoned lobby; no one to notify).
    - **`ended`** (both on the result screen, maybe mid-rematch) → notify the remaining player their opponent left (clear their stuck "waiting for rematch" — see 6e) and `deleteMatch`.
    Record the branches.
  - [ ] **6e — Telling the remaining player on the result screen "opponent left."** If a player is sitting on the result screen (possibly having clicked Rematch → `rematchPending`) and the opponent disconnects, they must not be stuck. Recommended: emit a `match:error` (e.g. "Opponent left the match") to the remaining player — the reducer's `match/error` already **clears `rematchPending`** (added in the 2.5 review), so the button un-sticks and the message shows. Record. (This resolves the 2.5-deferred one-sided-rematch exit.)
  - [ ] **6f — Blip vs real disconnect (AC3).** No manual debounce needed: Socket.IO only fires `disconnect` *after* `pingTimeout` (a blip that recovers within the window never fires it). So AC3 falls out of the 6a config + relying on the built-in `disconnect` timing. Record that we lean on Socket.IO here, not a custom timer.
  - [ ] **6g — Eviction lands here (AC1 from 2.5 + AC2).** Add `deleteMatch(matchId)` to the store and call it on forfeit / abandoned-lobby / ended-cleanup. Note: a match where *both* players idle on the result screen forever (neither rematches nor disconnects) still isn't evicted — that abandoned-TTL stays deferred (`deferred-work.md`). Record.

- [ ] **Task 2: Engine — the forfeit end reason (AC: 2)** — `packages/engine`
  - [ ] `types.ts`: add `'forfeit'` to `EndReason` (`'allCards' | 'roundCap' | 'forfeit'`).
  - [ ] New pure helper (e.g. `match/forfeit.ts`): `forfeitMatch(state: MatchState, winnerId: PlayerId): MatchState` → returns the state with `result: { winner: winnerId, reason: 'forfeit' }` (immutable copy; no throw, no I/O). Export from `index.ts`. Co-located test.
  - [ ] Engine stays pure — no socket/server imports. [Source: architecture.md — engine boundary]

- [ ] **Task 3: Server — ping config + disconnect → forfeit + eviction (AC: 1, 2, 3, 4)** — `packages/server`
  - [ ] `server.ts`: add `pingInterval` + `pingTimeout` to the `new Server(httpServer, { … })` options (6a). Keep the existing `cors`.
  - [ ] `store/matchStore.ts`: add `findMatchBySocketId(socketId)` (6c) and `deleteMatch(matchId)` (6g).
  - [ ] `sockets/matchHandlers.ts`: inside `io.on('connection', (socket) => { … })`, add `socket.on('disconnect', () => { … })`. Look up the match by `socket.id`; if none, return. Branch by status (6d): `playing` → `forfeitMatch` (the other player wins) → `projectFor` → `io.to(remainingSocketId).emit('match:ended', view)` → `deleteMatch`; `waiting` → `deleteMatch`; `ended` → emit `match:error` "Opponent left" to the remaining player → `deleteMatch`.
  - [ ] Reuse `buildStartViews` / `projectFor` for the per-player emit; never hand-build a payload. The disconnected socket gets nothing (it's gone). [Source: architecture.md — Enforcement Guidelines]
  - [ ] A mid-match refresh (AC4) fires `disconnect` (transport close) → the same forfeit path; the refreshing player's reload starts fresh (home/join). Reconnect/grace-resume is the deliberate follow-up (D16), NOT this story.

- [ ] **Task 4: Client — render the forfeit + un-stick the result screen (AC: 2)** — `packages/client`
  - [ ] `components/ResultView.tsx`: add `forfeit` to the reason map (e.g. `forfeit: 'Opponent left — you win'`). The forfeit `match:ended` already flows through `match/ended` → `result` screen → ResultView (winner = you), so no new wiring beyond the label.
  - [ ] Confirm the "opponent left during result/rematch" path (6e): the `match:error` arrives → reducer `match/error` sets the message + clears `rematchPending` → ResultView shows it and the Rematch button un-sticks. (If you want a dedicated banner instead of reusing the error, decide and record.)
  - [ ] No ping/disconnect code on the client — Socket.IO handles the transport; the client only reacts to `match:ended` / `match:error`.

- [ ] **Task 5: Tests — AI-written**
  - [ ] Engine: `forfeitMatch` sets `result: { winner, reason: 'forfeit' }`, leaves the rest of the state intact, and does not mutate the input.
  - [ ] Store: `deleteMatch` removes the entry (`getMatch` → undefined after); `findMatchBySocketId` returns the entry containing that socketId, or undefined.
  - [ ] **Disconnect resolution — keep it socket-free:** extract the decision into a pure helper (e.g. `resolveDisconnect(entry, socketId) → { kind: 'forfeit', winnerId } | { kind: 'abandon' } | { kind: 'opponentLeft', remainingId } | { kind: 'none' }`) and unit-test the branches (playing → forfeit the other player; waiting → abandon; ended → opponentLeft). The `socket.on('disconnect')` handler then just executes the helper's decision. The live socket disconnect round-trip is manual-verified (the 2.1–2.5 stance).
  - [ ] Engine end rules unchanged — do NOT retest `allCards`/`roundCap`.
  - [ ] (If the client jsdom infra ever lands — still deferred — a ResultView forfeit-label render test; otherwise manual.)

- [ ] **Task 6: Prove it (AC: all)**
  - [ ] `npm run dev`, two tabs, mid-match. **Close** one tab → within ~10s the other tab flips to the ResultScreen as the **winner**, reason "Opponent left". (Manual smoke.)
  - [ ] **Refresh** one tab mid-match (AC4) → the other gets the forfeit win; the refreshed tab reloads to home/join. Confirm.
  - [ ] **Blip (AC3):** briefly toggle the network (DevTools offline → online quickly, within the window) → the match continues, no forfeit. (Best-effort manual check.)
  - [ ] Forfeit on the **result/rematch** screen: one player on the result screen, the other closes → the remaining player's "waiting for rematch" un-sticks with an "opponent left" message.
  - [ ] Confirm the match is **evicted** (a `selectStat`/`rematch` to the dead matchId → `MATCH_NOT_FOUND`).
  - [ ] `npm run typecheck` clean; `npm test` green; `npm run format`.
  - [ ] Commit on `story/2.6`, push, open PR, run `bmad-code-review` per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews — never paste-ready implementation code. **Exemptions:** scaffolding; test files (Task 5) may be AI-written; AI fills the Dev Agent Record; config/tooling/server-setup files AI may edit directly. [Source: addendum.md#Working-agreement; D18]

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
- [Source: addendum.md#Working-agreement; .decision-log.md#D18] — hand-write code; AI mentors

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted).

### Debug Log References

### Completion Notes List

Decisions (fill at implementation):
- 6a — ping config (pingInterval/pingTimeout values + ≈10s math):
- 6b — forfeit representation (`EndReason` += forfeit; `forfeitMatch` engine helper):
- 6c — socket→match lookup (`findMatchBySocketId`):
- 6d — disconnect behavior per status (playing/waiting/ended):
- 6e — "opponent left" notify on the result screen (match:error reuse vs dedicated):
- 6f — blip vs disconnect (lean on Socket.IO timing, no custom debounce):
- 6g — eviction (`deleteMatch`); abandoned-both-idle TTL still deferred:

### File List
