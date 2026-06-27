# Story 2.4: Play rounds — choose, call out, reveal, repeat

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
I want to pick a stat on my turn and watch the duel resolve on both screens,
so that we can actually play the game.

**Plain-English goal:** The table is already on screen (2.3). Now make it *playable*: on my turn I
click one of my 8 stat rows; the server runs the Epic 1 rules engine to resolve the round, and
**both** screens update — showing the call-out (both played cards, the chosen stat's two values, the
winner), the new stack counts, the pot, and whose turn it is next. If it is **not** my turn, my stats
are locked and a click is rejected (only I see the error). The good news: the engine already knows all
the rules (compare, Age-low-wins, ties→pot, Super Trump, match end). This story is mostly **wiring**
the existing `applyCommand` through the socket and **rendering** the result.

**Terms used in this story (defined once):**
- **`match:selectStat`** — the new client→server socket message: "I pick this stat." Carries the matchId, my token, and the stat key.
- **`applyCommand` (engine)** — the Epic 1 transition function `applyCommand(state, command) → CommandResult`. It enforces every rule and returns either `{ ok: true, state: nextState }` or `{ ok: false, error: { code, message } }`. It never throws for a rule violation. Built + tested in stories 1.4–1.7.
- **`SelectStatCommand`** — the command object the engine expects: `{ type: 'selectStat', playerId, stat }`. The server builds it (it supplies the trusted `playerId`).
- **call-out / reveal** — after a round, both screens show what happened: both played cards face-up, the chosen stat's value on each, and the winner highlighted (FR12). This is read from `PlayerView.lastRound`.
- **`lastRound`** — the revealed outcome of the most recent round, on every `PlayerView`: `{ stat, playedCards (BOTH players' played cards), winner }`. Revealed-once info is no longer hidden, so showing both cards here is correct.
- **token** — the secret per-player id issued at join (2.2). 2.4 is where it finally gets **used**: the client sends it with `match:selectStat`, and the server uses it to know which player is acting (impersonation guard).
- **`match:error`** — the existing server→client event used to tell **only the sender** that their command was rejected (wrong turn, bad stat, match over). State does not change.

## Acceptance Criteria

(Verbatim from epics.md#Story-2.4, split for traceability.)

1. **Given** it is my turn, **when** I tap one of my 8 stat rows, **then** `match:selectStat` flows zod-parse → `applyCommand` → `projectFor` ×2 → `match:state` ×2, and both screens show the call-out reveal — both played cards, the chosen stat's values, winner highlighted (FR11, FR12) — within ~1s on a local network (NFR3).
2. **Given** it is NOT my turn, **then** my stats are locked and I see a clear "opponent is choosing…" state (FR16); a command sent anyway returns a typed error to me only, state unchanged.
3. **Given** my top card is the Super Trump, **then** I see its marker and my opponent sees nothing until it is played (FR19).
4. **And** the full surface stays live through ties and trump rounds: top card, counts, pot, turn indicator, last result (FR30).

## Tasks / Subtasks

- [ ] **Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes**
  - [ ] **4a — `match:selectStat` identity = the token.** Payload is `{ matchId, token, stat }`. The server looks the match up, finds the player whose `token` matches, and uses **that player's `playerId`** to build the `SelectStatCommand`. This is where the per-player token (issued in 2.2, unused until now) finally becomes the impersonation guard. If no player in the match has that token → typed error to the sender (e.g. `NOT_IN_MATCH`). Record. (Alternative — map by `socket.id` — rejected: the token is the durable identity per the architecture, and reconnect will reuse it.)
  - [ ] **4b — Errors are an event to the sender, success is `match:state` to both.** On any failure (zod-bad payload, bad token, or an `applyCommand` rule rejection) emit **`match:error`** to the **sender's socket only**; state is unchanged. On success, save the new state and emit **`match:state`** to **both** sockets (per-player projection, as in 2.3). `match:selectStat` takes **no ack** (unlike `match:join`) — this matches the architecture's error standard ("a typed error *event* to the sender only"). Record.
  - [ ] **4c — Unify the wire error codes. ⚠️ typing.** The engine's `applyCommand` returns codes `NOT_CHOOSER | INVALID_STAT | MATCH_OVER` (engine `CommandErrorCode` in `types.ts`). The protocol's `ErrorPayload.code` is a *different* union, also called `CommandErrorCode`, in `protocol/events.ts` (`INVALID_BODY | MATCH_NOT_FOUND | MATCH_FULL | MATCH_STARTED | ALREADY_JOINED`). To relay a rule error over `match:error`, the wire union must include the engine's codes (plus an identity code like `NOT_IN_MATCH`). Decide how: **recommended** — rename the protocol union to `WireErrorCode` and define it as the lobby codes **+** the engine's command codes (import the engine's `CommandErrorCode` and compose: `type WireErrorCode = LobbyErrorCode | EngineCommandErrorCode | 'NOT_IN_MATCH'`), so the two same-named types stop colliding and `match:error` can carry any failure with full type-safety. Record the chosen shape.
  - [ ] **4d — Apply + save the new state.** In the handler, call `applyCommand(entry.state, command)`. On `{ ok: true }`, persist `result.state` via a store updater (add e.g. `updateMatchState(matchId, state)`, or generalize the 2.3 `startMatch`). The engine owns ALL rules (compare, Age low-wins, transfer order, ties→pot, Super Trump, match end) — the server only persists and projects; it must not re-implement any rule. Record.
  - [ ] **4e — The reveal renders from `view.lastRound`.** Decide a small `RoundResult` (call-out) component or a `MatchScreen` section that shows, from `lastRound`: both players' played cards, the chosen `stat` and each side's value for it, and the winner highlighted (a tie → "PUSH / pot grows"). `lastRound.playedCards` carries BOTH cards (revealed info — safe). Record what it renders.
  - [ ] **4f — Client lock is UX-only; the server is the gate.** Stats are disabled when `view.chooser !== view.you` (the `CardView` buttons already do this) and an "opponent is choosing…" indicator shows (FR16). But the real enforcement is server-side: `applyCommand` returns `NOT_CHOOSER` for an off-turn command, which becomes a `match:error` to the sender, state unchanged (AC2). Record that the disable is convenience only.
  - [ ] **4g — How the client shows a `match:error`.** Recommended: a transient `error: string | null` in the reducer set by a new `match/error` action and **cleared on the next `match/state`**. (Or local `MatchScreen` state.) Record.
  - [ ] **4h — Client test infrastructure (deferred from 2.3 — decide now).** 2.4 is interactive (click → emit) and has a reveal to render. Recommended: set the client vitest `environment: 'jsdom'` + add a render lib (e.g. `@testing-library/react`) so the click-to-emit and reveal rendering get real component tests (and the 2.3-deferred `CardView`/join-from-URL tests can land). Alternative: keep deferring and rely on manual smoke. Record the choice.

- [ ] **Task 2: Protocol — the selectStat command + wire error codes (AC: 1, 2)** — `packages/engine/src/protocol/`
  - [x] `commands.ts`: add `selectStatCommandSchema = z.object({ matchId: z.string(), token: z.string(), stat: <StatKey enum> })`. The `stat` is a zod enum over the 8 keys (`'bounty' | 'age' | 'haki' | 'loyalty' | 'devilFruitMastery' | 'fearFactor' | 'speed' | 'battleIQ'`); keep it in sync with the engine `StatKey`. Export the schema + its inferred type.
  - [x] `events.ts`: add `'match:selectStat': (payload: <SelectStat payload>) => void` to `ClientToServerEvents` (no ack). Apply the 4c error-code decision (rename to `WireErrorCode` / compose with the engine codes); update `ErrorPayload.code`. Re-export from `index.ts`.
  - [x] Keep the engine pure — `protocol/` imports only `zod` + engine types. [Source: architecture.md — engine boundary]

- [ ] **Task 3: Server — the `match:selectStat` handler (AC: 1, 2)** — `packages/server/src/sockets/`
  - [x] In `matchHandlers.ts`, register `socket.on('match:selectStat', …)`: zod-parse the payload (4b boundary rule) → `getMatch` (→ `match:error MATCH_NOT_FOUND` if missing) → find the player by `token` (→ `match:error NOT_IN_MATCH` if none) → build `{ type: 'selectStat', playerId, stat }` → `applyCommand(entry.state, command)`.
  - [x] On `{ ok: false }` → emit `match:error` (engine's `error.code`/`message`) to the **sender only**; do not touch state.
  - [x] On `{ ok: true }` → save `result.state` (4d store updater) → emit `match:state` to **each** player via the per-player projection helper (reuse the 2.3 `buildStartViews` — consider renaming it `buildPlayerViews` since it's no longer start-only).
  - [x] If `result.state.result !== null` the match has ended — for 2.4 just keep emitting `match:state` (the table shows the final position). The dedicated `match:ended` event + `ResultScreen` + store eviction are **story 2.5** — do NOT build them here. [Source: epics.md#Story-2.5]
  - [x] `applyCommand`/`projectFor` are the only engine calls; never re-implement a rule or hand-build a payload. [Source: architecture.md — Enforcement Guidelines]

- [ ] **Task 4: Client — pick a stat, show the reveal, handle errors (AC: 1, 2, 3, 4)** — `packages/client`
  - [ ] Wire `onSelectStat`: in `App.tsx`, pass `onSelectStat={(stat) => socket.emit('match:selectStat', { matchId, token, stat })}` to `<MatchScreen>` (read `matchId`/`token` from `state.match`). The `CardView` buttons already call `onSelectStat?.(def.key)` and disable off-turn — this just connects them.
  - [ ] Render the reveal (4e): a `RoundResult`/call-out from `view.lastRound` — both played cards, the chosen stat's two values, winner highlighted; first round (`lastRound === null`) shows nothing. Keep the live surface (FR30): top card, both counts, pot, turn indicator all already render from the `match:state` snapshot — verify they update each round.
  - [ ] "opponent is choosing…" (FR16): when `view.chooser !== view.you`, show the waiting indicator (the turn banner already differentiates) and keep stats locked.
  - [ ] `match:error` (4g): add a `socket.on('match:error', …)` listener in `App.tsx` (symmetric `off` cleanup) → dispatch `match/error` → show the message on the MatchScreen; clear it on the next `match/state`.
  - [ ] Super Trump marker (FR19, AC3) already renders from `view.yourTopCardIsSuperTrump` (holder-only) — verify it shows for the holder and not the opponent, including the round it is played.

- [ ] **Task 5: Client reducer — the error field (AC: 2)** — `packages/client/src/state/reducer.ts`
  - [ ] Add `error: string | null` to state; new `match/error` action sets it; `match/state` clears it (`error: null`). Keep the union exhaustive; immutable updates. Update `reducer.test.ts`.

- [ ] **Task 6: Tests — AI-written**
  - [ ] `commands.ts`: `selectStatCommandSchema` accepts a valid `{ matchId, token, stat }` and rejects an unknown/missing stat and a missing token.
  - [ ] Server selectStat flow — keep socket-free where possible: if a pure helper is extracted for "resolve player by token + apply + build views / map error", unit-test it (valid stat → per-player views with updated counts; off-turn → `NOT_CHOOSER`; bad token → `NOT_IN_MATCH`). Otherwise note the socket round-trip as manual-verified (the 2.1–2.3 stance).
  - [ ] Reducer: `match/error` sets the message; `match/state` clears it; existing cases pass; no mutation.
  - [ ] NFR2 still holds after a round — extend or mirror the `startViews`/projection check on a post-`applyCommand` state (lastRound reveals both *played* cards, which is allowed; buried stacks + trump location still hidden).
  - [ ] If 4h taken (jsdom): `CardView` click calls `onSelectStat` only when it's your turn; the reveal renders both cards + winner from `lastRound`. Else: manual-verify and note.
  - [ ] Engine rules (compare/ties/trump/Age/end) are already covered by the 109 engine tests — do NOT retest them here.

- [ ] **Task 7: Prove it (AC: all)**
  - [ ] `npm run dev`, two tabs, full match started (2.3). Play several rounds: on the chooser's tab, click a stat → **both** tabs show the call-out (both cards, the stat's values, winner), counts/pot update, and the turn passes to the winner — within ~1s. (Manual smoke.)
  - [ ] Force a **tie** (equal values) → both cards go to the pot, pot count grows, same chooser picks again (engine handles it; just confirm the surface reflects it). Play a **Super Trump** round → holder wins; confirm the opponent only learns the trump when it's played.
  - [ ] On the **non-chooser** tab, confirm stats are locked + "opponent is choosing…"; a forced/duplicate click surfaces a `match:error` to that tab only, with no state change.
  - [ ] `npm run typecheck` clean; `npm test` green; `npm run format`.
  - [ ] Commit on `story/2.4`, push, open PR, run `bmad-code-review` per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews — never paste-ready implementation code. **Exemptions:** scaffolding; test files (Task 6) may be AI-written; AI fills the Dev Agent Record; config/tooling/server-setup files AI may edit directly. [Source: addendum.md#Working-agreement; D18]

### Scope guard — what is NOT in 2.4

- **No result screen / rematch.** When the engine ends a match mid-play (`state.result` set via `allCards`/`roundCap`), 2.4 just keeps showing the final table via `match:state`. The `match:ended` event, `ResultScreen`, and store eviction are **story 2.5**.
- **No disconnect / forfeit** (FR5) → 2.6.
- **No persistence** → Epic 3.
- **No new rules** — every rule (comparison incl. Age low-wins, transfer order, ties→pot, chained ties, Super Trump, Buggy counter, match end, round cap) already lives in the engine. If a rule seems wrong, fix the engine + its tests, not the server.
- Counter-metric (PRD): time-to-playable. The round loop is the goal; resist gold-plating the reveal animation/UI.

### Architecture constraints that bind this story

- **Data flow (one round) — the exact pattern this story implements:** chooser clicks → `match:selectStat` → server zod-parses → `applyCommand(state, cmd)` → on ok: store updated → `projectFor` per player → `match:state` ×2 → both reducers update → both screens re-render. [Source: architecture.md — Data Flow; Pattern Examples]
- **Validation timing:** zod-parse the socket payload at the boundary BEFORE the engine; the engine then enforces game legality (two layers, two jobs). [Source: architecture.md — Process Patterns]
- **Error flow:** invalid/illegal command → typed `match:error` to the **sender only**, state unchanged, nothing logged above debug (it's normal traffic). [Source: architecture.md — Process Patterns, API & Communication Patterns]
- **Full-snapshot + projection-only door:** every accepted command re-sends each player their complete `PlayerView` via `match:state`; `projectFor` is the only path to a client payload. No deltas, no hand-built payloads. [Source: architecture.md — Communication & State Patterns; NFR2]
- **Engine purity / functional core:** `applyCommand(state, command) → CommandResult` is pure and never throws for rule violations; randomness/IO stay out. The server holds state and calls the engine. [Source: architecture.md — engine boundary]
- **Identity:** the per-player token is sent with every in-match socket event (impersonation guard; reconnect seam). 2.4 is where it starts being enforced. [Source: architecture.md — Authentication & Security]
- **Naming:** socket events `domain:action` camelCase (`match:selectStat`); one concept = one name (`stat`, `chooser`, `pot`). [Source: architecture.md — Naming Patterns]

### Recorded tech choices / engine API used (all already built + tested)

- `applyCommand(state, command): CommandResult` (`match/applyCommand.ts`) — the round transition; `Command = SelectStatCommand { type:'selectStat', playerId, stat }`; errors `NOT_CHOOSER | INVALID_STAT | MATCH_OVER`.
- `projectFor(state, playerId): PlayerView` — includes `lastRound` (the reveal) and `result` (set when the match ends).
- `PlayerView.lastRound: RoundOutcome | null` = `{ stat, playedCards (both players), winner: PlayerId | null }`.
- `StatKey` (8): `bounty, age, haki, loyalty, devilFruitMastery, fearFactor, speed, battleIQ`.
- Engine, server, client already wired through 2.1–2.3; Socket.IO 4.8, zod 4, React 19, Vitest 4.

### Previous work intelligence (story 2.3)

- **The deal + per-player emit pattern exists.** `matchHandlers.ts` already: parses, looks up the match, and (on the 2nd join) calls engine `createMatch`, `startMatch(matchId, state)`, then `buildStartViews(state, players)` → `io.to(socketId).emit('match:state', view)`. 2.4 adds a second handler (`match:selectStat`) that reuses the SAME per-player-emit tail — extract/reuse `buildStartViews` (rename to `buildPlayerViews`).
- **The store holds `state: MatchState | null`.** 2.3 added `startMatch`; 2.4 adds an `updateMatchState(matchId, state)` (or generalizes it). `Player` has `{ playerId, token, nickname, socketId }` — the `token` lookup for 4a is `entry.players.find(p => p.token === payload.token)`.
- **The client renders entirely from `state.view` (a `PlayerView`).** `MatchScreen` + `CardView` already show the card, counts, pot, turn, and the holder-only trump badge, and `CardView` renders the 8 stat buttons with `disabled={!isYourTurn}` and `onClick={() => onSelectStat?.(def.key)}`. 2.4 wires `onSelectStat` (currently never passed) and adds the `lastRound` reveal. The buttons + turn-gating built early in 2.3 now get used.
- **`statDefinitions` is on `PlayerView`** (2.3, decision 3g) — labels/order/direction for rendering the reveal's stat values come from there.
- **The reducer owns `{ status, screen, match, view }`**, updates `view` on `match/state`. 2.4 adds `error` + a `match/error` action. Keep the union closed (no `default`).
- **Two `CommandErrorCode` types already coexist** (engine `types.ts` vs protocol `events.ts`) — 2.4's decision 4c resolves this collision when unifying wire errors.
- **Tests at the start of 2.4: 134 green.** Socket integration + client DOM tests deferred so far (4h is the chance to add the DOM env).

### Git intelligence

- Branch `story/2.4` off `main` (2.3 merged via PR #13). Rhythm: hand-write → AI writes tests → green → commit → push → PR → `bmad-code-review` → fix → merge.
- Deferred items now relevant: client jsdom/RTL infra (2.3 review → "early 2.4", decision 4h). Disconnect/reconnect items stay deferred (2.6+).

### Technical notes

- **Why the token, not `socket.id` (4a):** `socket.id` changes on reconnect; the token is stable and is the documented identity carried on every in-match event. Using it now is the seam reconnect will reuse. The server never trusts a client-supplied `playerId` — it derives `playerId` from the matched token.
- **The reveal is already "hidden-info safe":** `lastRound.playedCards` are the cards that were *played* this round (now public). Buried stacks and the un-played Super Trump location stay hidden because `projectFor` never includes them. No special handling needed — just render `lastRound`.
- **Match-end during a round:** `applyCommand` may return a state with `result` set (someone hit 0 cards / round cap). 2.4 sends that final state as a normal `match:state`; the screen shows the final position. Wiring a real end-of-match experience is 2.5 — keep the boundary clean.
- **`match:error` is sender-only:** emit on `socket` (the sender's socket), not to the room — the opponent must not see your rejected attempt.

### Project Structure Notes

- Update (engine): `protocol/commands.ts` (`selectStatCommandSchema`), `protocol/events.ts` (`match:selectStat` + `WireErrorCode`), `index.ts` (exports).
- Update (server): `sockets/matchHandlers.ts` (selectStat handler), `store/matchStore.ts` (`updateMatchState`), possibly rename `sockets/startViews.ts` → `buildPlayerViews`.
- Update (client): `App.tsx` (wire `onSelectStat`, `match:error` listener), `components/MatchScreen.tsx` + new `RoundResult` (reveal), `state/reducer.ts` (`error` + `match/error`).
- New tests: `commands` selectStat schema, reducer `match/error`, the server flow helper (if extracted); optional jsdom component tests (4h).
- Matches the architecture tree; no new packages. [Source: architecture.md — Complete Project Directory Structure]

### References

- [Source: epics.md#Story-2.4] — story statement + ACs (verbatim)
- [Source: epics.md#Story-2.5, #Story-2.6] — boundaries: result screen/rematch (2.5), disconnect/forfeit (2.6)
- [Source: architecture.md — Data Flow, Communication & State Patterns, Process Patterns, Enforcement Guidelines] — the command→snapshot loop, validation timing, error-to-sender, projection-only
- [Source: prd.md — FR11, FR12, FR16, FR19, FR30; NFR2, NFR3] — stat selection, call-out reveal, opponent-choosing lock, holder-only trump, live surface, hidden-info, ~1s reflection
- [Source: implementation-artifacts/1-4-…-round-resolution.md, 1-5-…-super-trump, 1-6-…-ties, 1-7-…-match-end] — the engine rules this story renders (already tested)
- [Source: implementation-artifacts/2-3-…-table-appears.md] — the deal/emit/render patterns this story extends; the `onSelectStat` scaffolding now wired
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
- 4a — selectStat identity via token (server resolves playerId):
- 4b — failures → match:error to sender; success → match:state to both; no ack:
- 4c — wire error-code unification (WireErrorCode = lobby + engine command codes + NOT_IN_MATCH):
- 4d — apply + save the new state (store updater):
- 4e — the reveal component/section from lastRound:
- 4f — client lock UX-only; server is the authority:
- 4g — client match:error display (reducer error field, cleared on match/state):
- 4h — client test infra (jsdom/RTL now vs keep deferring):

### File List
