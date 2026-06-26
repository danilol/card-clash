# Story 2.3: Friend joins, cards are dealt, the table appears

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
I want my friend to open my link, enter a nickname, and have the match start instantly for both of us,
so that we're looking at our own cards within seconds.

**Plain-English goal:** My friend opens the link I sent (it has `?match=<matchId>` in it). They see a
"join" box, type a nickname, and click Join. The moment the **second** player joins, the server deals
the cards (using the Epic 1 engine) and sends **each** player their **own** view of the table. Both
screens switch from "waiting" to a game table showing my top card (name + its 8 stat values), both
stack counts (16 and 16), and the pot (0). No round is played yet — that's 2.4. A **third** person who
tries to join the same match is turned away.

**Terms used in this story (defined once):**
- **auto-start** — the match begins automatically the instant the 2nd player joins (no "start" button). [FR3]
- **deal** — the engine shuffles the 32 cards and gives 16 to each player, face-down. Done by the engine's `createMatch`.
- **`createMatch` (engine)** — the Epic 1 function `createMatch(deck, players, rng)` that builds the initial `MatchState` (shuffle, deal, pick Super Trump, pick first chooser). ⚠️ This is the *engine's* `createMatch` — different from the server store's `createMatchEntry` (which just makes the empty lobby record). Story 2.3 calls the engine one for the first time.
- **`MatchState`** — the full, server-only truth of a match (both stacks, deck order, Super Trump location, whose turn). Lives in server memory; **never** sent to a client as-is.
- **`PlayerView`** — one player's *allowed* view of the match, produced by `projectFor(state, playerId)`. It has your top card, both stack counts, pot count, whose turn, and the trump marker for your own card only — and nothing secret. This is the only thing that goes over the wire.
- **`projectFor` (engine)** — `projectFor(state, playerId) → PlayerView`. The single door that turns full state into a per-player view (the NFR2 / hidden-info boundary). Already built + tested in story 1.8.
- **`match:state` (event)** — server→client socket event carrying a `PlayerView`. Already declared in the protocol (story 2.2).
- **room** — a Socket.IO grouping named by the matchId; both players' sockets `join` it. Useful for "send to this match", but note each player needs a *different* `PlayerView`, so we emit per-socket (see decision 3b).
- **`MATCH_FULL`** — the typed error a 3rd joiner gets. [AC3]

## Acceptance Criteria

(Verbatim from epics.md#Story-2.3, split for traceability.)

1. **Given** a match awaiting players, **when** the second player opens the link and joins with a nickname, **then** the match auto-starts (FR3): the server runs Epic 1's `createMatch` and each client receives `match:state` carrying ONLY its own `PlayerView` (FR4).
2. **And** the MatchScreen renders my top card as a placeholder card — name + 8 labeled stat values, no artwork (FR29) — plus both stack counts (16/16) and pot count 0 (FR8).
3. **And** a third joiner is rejected with a typed error (`MATCH_FULL`).
4. **And** a test or scripted check confirms the serialized payload contains no opponent cards, deck order, or Super Trump location (NFR2 enforced at the wire).

## Tasks / Subtasks

- [x] **Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes**
  - [x] **3a — The client screen flow + how the 2nd player reaches a join box.** On app load, read the URL with `new URLSearchParams(window.location.search).get('match')`. If a matchId is present → start on a **`join`** screen (nickname + "Join"). If absent → the existing **`home`** screen (create). Full screen machine after this story: `home | join | waiting | match` (`result` arrives in 2.5). Record the flow and the initial-screen rule.
  - [x] **3b — Auto-start trigger + how per-player views are emitted. ⚠️ correctness.** When a `match:join` makes the match reach **2** players, start it: call the engine `createMatch(onePieceDeck, [p1.playerId, p2.playerId], rng)`, save the `MatchState`, flip the entry status to `playing`, then send `match:state` to **each** player with **their own** projection. You **cannot** broadcast one payload to the room — each player must get a *different* `PlayerView`. Emit per stored socket: for each player, `io.to(player.socketId).emit('match:state', projectFor(state, player.playerId))`. Record this (it's the FR4 / NFR2 crux).
  - [x] **3c — Which Rng the server uses.** The engine `createMatch` takes an injected `Rng`. The server passes `defaultRng` (real `Math.random`) for live play; tests pass a seeded `mulberry32(seed)` for reproducibility. Both are already exported from the engine. Record.
  - [x] **3d — How the store entry grows.** The 2.2 entry is `{ matchId, status, players, createdAt }`. Add `state: MatchState | null` (null while `waiting`, set when the match starts) and flip `status` `waiting → playing` on start. Add a small store updater (e.g. `startMatch(matchId, state)`), not raw Map poking. (This is the architecture's `{ state, tokens, sockets }` direction taking shape.) Record the new shape.
  - [x] **3e — What identity the engine gets.** Pass the two players' **public `playerId`s** as the engine's `players` array — never the secret `token` (decision 2b from 2.2). `projectFor` puts `you`/`chooser` (playerIds) into the view sent to both players, so playerIds are safe to expose; tokens are not. Record.
  - [x] **3f — The join guards deferred from the 2.2 review (implement now).** In `match:join`, before adding a player: reject with `MATCH_FULL` if the match already has 2 players (AC3); reject a join into a match whose status is not `waiting`; and ignore/dedupe a repeat join from the same `socketId`. Add `'MATCH_FULL'` (and any needed code) to the protocol `CommandErrorCode`. Record.
  - [x] **3g — How the card gets its 8 stat LABELS (small engine choice).** `PlayerView.yourTopCard.stats` is a `Record<StatKey, number>` — values only, no labels/order. To render "8 **labeled** stat values" (FR29) the client needs the labels + order. **Recommended:** add `statDefinitions: readonly StatDefinition[]` to `PlayerView` and have `projectFor` copy `state.statDefinitions` through — these are public, identical for both players (not hidden info), and they make 2.4's call-out reveal renderable too. This is a small, contained engine change (touch `types.ts` `PlayerView`, `projectFor.ts`, and its 1.8 test). **Alternative (lighter):** the client hard-codes a `StatKey → label` map and a fixed order, no engine change. Pick one and record why.

- [x] **Task 2: Server — join cap + auto-start (AC: 1, 3)** — `packages/server`
  - [x] In `packages/server/src/sockets/matchHandlers.ts`, add the guards from 3f to `match:join`: `MATCH_FULL` when `entry.players.length >= 2`; reject when `entry.status !== 'waiting'`; dedupe the same `socketId`.
  - [x] After `addPlayer`, if the match now has 2 players, **start it**: call the engine `createMatch(onePieceDeck, [p1.playerId, p2.playerId], rng)` (decision 3c/3e), save it via the store updater (3d), flip status to `playing`.
  - [x] Keep the engine call behind the store/handler boundary — the engine stays pure; the server just calls it and holds the result. [Source: architecture.md — engine boundary]
  - [x] In `packages/server/src/store/matchStore.ts`, add `state: MatchState | null` to `MatchEntry` and a `startMatch(matchId, state)` updater (3d). Import `MatchState` as a type from `@card-clash/engine`.

- [x] **Task 3: Server — emit each player their own view (AC: 1, 4)** — `packages/server`
  - [x] On start, for each player emit `match:state` with **their own** `projectFor(state, player.playerId)` to **their** socket (decision 3b: `io.to(player.socketId).emit(...)`). Do NOT room-broadcast a single payload.
  - [x] **Extract a pure helper for testability + NFR2** (recommended): e.g. `buildStartViews(state, players) → Array<{ socketId, view }>` (a thin map over `projectFor`). The handler emits from it; a unit test asserts the views carry no hidden info (Task 6). This keeps the NFR2 assertion socket-free (consistent with the deferred socket-integration-test stance). Put it near the handler or in a small `sockets/` helper.
  - [x] `projectFor` is the ONLY path from `MatchState` to anything sent to a client — never hand-build a payload from raw state. [Source: architecture.md — Enforcement Guidelines; NFR2]

- [x] **Task 4: Client — open the link, show a join box, join (AC: 1)** — `packages/client`
  - [x] On load, read `?match=` (3a). New `packages/client/src/components/JoinScreen.tsx`: nickname input + "Join" button that emits `match:join { matchId, nickname }` (the matchId comes from the URL, not a POST — the match already exists). Reuse the awaited-ack + timeout pattern from `HomeScreen` (story 2.2); on `MATCH_FULL` / error, show the message.
  - [x] Decide the initial screen from the URL in the reducer's `initialState` or a first-render dispatch (3a). Keep ONE reducer.
  - [x] The creator stays on `waiting` from 2.2; they transition to `match` when their `match:state` arrives (Task 5) — no extra action needed on their side beyond the listener.

- [x] **Task 5: Client — receive the deal, render the table (AC: 1, 2)** — `packages/client`
  - [x] Register a `socket.on('match:state', …)` listener (alongside the connect/disconnect ones in `App.tsx`) that dispatches a new `match/state` action carrying the `PlayerView`. Remove it in cleanup (symmetric `off`, like the others).
  - [x] Extend `packages/client/src/state/reducer.ts`: add `view: PlayerView | null` to state and a `match/state` action that stores the view and sets `screen: 'match'`. Import `PlayerView` as a type from `@card-clash/engine`. Immutable updates; keep the union exhaustive.
  - [x] New `packages/client/src/components/MatchScreen.tsx`: render from the `PlayerView` — your `CardView`, your stack count, opponent stack count, pot count, and whose turn it is (plain text is fine). [FR8/FR30 surface; the live round interaction is 2.4]
  - [x] New `packages/client/src/components/CardView.tsx`: the placeholder card (FR29) — character name + the 8 labeled stat rows (label + value), and the Super Trump marker when `view.yourTopCardIsSuperTrump` is true (FR19, holder-only). Labels come from 3g. No artwork, minimal/no styling.
  - [x] `App.tsx`: add the `match` screen case → `<MatchScreen view={state.view} />`.

- [x] **Task 6: Tests — AI-written**
  - [x] **(Deferred — manual-verified)** `matchHandlers` cap: a 3rd `match:join` is rejected with `MATCH_FULL`. Verified by hand (third tab → "Match is full"); a unit test needs the guard extracted from the socket handler. Deferred per the 2.1/2.2 socket-test stance.
  - [x] **NFR2 at the wire (AC4):** `startViews.test.ts` deals with a seeded rng, builds the per-player views, and asserts no opponent cards, no buried stack order, no Super Trump id, and no tokens.
  - [x] Reducer: `match/state` stores the view and sets `screen: 'match'`; existing cases still pass; no mutation.
  - [x] **(Deferred — needs jsdom)** `CardView` render test: needs a client DOM test env (jsdom + render lib), not set up yet. Card rendering manually verified across two tabs. Add client jsdom/RTL infra as an early 2.4 task.
  - [x] **(Deferred — needs jsdom)** Join-from-URL initial screen: `initialScreen()` reads `window`, so a test needs jsdom to set `location.search`. Manually verified (opening `?match=` lands on the join box). Bundle with the jsdom infra task.
  - [x] **Two-player auto-start handshake:** manually verified across two browser tabs — both flip to the table on the 2nd join.

- [ ] **Task 7: Prove it (AC: all)**
  - [x] `npm run dev`. Tab A: create a match → "waiting". Tab B: open the copied link → join box → enter nickname → Join. **Both** tabs flip to the table within ~1s: each shows its **own** top card, counts 16/16, pot 0. (Manual smoke — verified.)
  - [x] Tab C: open the same link and try to join → `MATCH_FULL` message; the running match is unaffected. (Verified.)
  - [x] `npm run typecheck` — strict-clean across all four packages (incl. the `PlayerView` change).
  - [x] `npm test` — green: 133 total.
  - [ ] `npm run format` before commit.
  - [ ] Commit on `story/2.3`, push, open PR, run `bmad-code-review` per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews — never paste-ready implementation code. **Exemptions:** scaffolding; test files (Task 6) may be AI-written; AI fills the Dev Agent Record; config/tooling/server-setup files AI may edit directly (confirmed 2026-06-22). [Source: addendum.md#Working-agreement; D18]

### Scope guard — what is NOT in 2.3

- **No playing a round** — picking a stat, the call-out reveal, comparing, transferring cards → **story 2.4** (`match:selectStat`). 2.3 deals the cards and renders the *static* opening table; nothing is clickable yet.
- **No result screen / rematch** → 2.5.
- **No disconnect / forfeit / ping tuning** (FR5) → 2.6.
- **No persistence** → Epic 3. The match lives only in the in-memory store.
- The MatchScreen shows the surface (card, counts, pot, turn) but the stat rows are **not** interactive in 2.3.
- Counter-metric (PRD): time-to-playable. Build the smallest correct "table appears" step.

### Architecture constraints that bind this story

- **`projectFor` is the only door** from `MatchState` to a client (NFR2). `match:state` carries `PlayerView`, never `MatchState`. The server must never hand-build a payload from raw state. [Source: architecture.md — Architectural Boundaries, Enforcement Guidelines]
- **Full-snapshot protocol:** after the deal, each player gets their complete `PlayerView` via `match:state` (no deltas). [Source: architecture.md — Communication & State Patterns]
- **Per-player emit:** because each `PlayerView` differs, send to each socket individually — not a single room broadcast (decision 3b).
- **Engine stays pure:** the server calls `createMatch` / `projectFor` and holds the result; the engine imports only zod and never imports server/socket types. [Source: architecture.md — engine boundary]
- **Client imports engine TYPES only** (`import type` for `PlayerView`, `MatchState` is server-only). [Source: architecture.md — Frontend Architecture]
- **One reducer** owns connection + screen + the snapshot (`view`). React built-ins only. [Source: architecture.md — Frontend Architecture]
- **Naming:** components PascalCase (`MatchScreen.tsx`, `CardView.tsx`, `JoinScreen.tsx`); one concept = one name — the engine `createMatch` deals; the store's lobby maker is `createMatchEntry`. Keep them distinct (the 2.2 review rename exists for exactly this moment). [Source: architecture.md — Naming Patterns]
- **Hidden-info (FR19):** the Super Trump marker is holder-only — `PlayerView.yourTopCardIsSuperTrump` is already computed per viewer by `projectFor`; the client just renders it. Never send the trump's identity otherwise. [Source: architecture.md; FR19]

### Recorded tech choices (from architecture / engine)

- Engine API used here (all already built + tested): `createMatch(deck, players, rng): MatchState` (setup.ts), `projectFor(state, playerId): PlayerView` (projection), `onePieceDeck` (the 32-card deck), `defaultRng` / `mulberry32` (rng). All exported from `@card-clash/engine`.
- `PlayerView` (current shape) = `{ you, yourTopCard, yourStackCount, opponentStackCount, potCount, chooser, yourTopCardIsSuperTrump, lastRound, result }`. Decision 3g may add `statDefinitions`.
- React 19 + Vite client, Socket.IO 4.8, Vitest 4 — all installed.

### Previous work intelligence (story 2.2)

- **The store** (`packages/server/src/store/matchStore.ts`) exposes `createMatchEntry()`, `getMatch(id)`, `addPlayer(id, player)`; an entry is `{ matchId, status: 'waiting' | 'playing' | 'ended', players: Player[], createdAt }` with `Player = { playerId, token, nickname, socketId }`. 2.3 adds `state: MatchState | null` + a `startMatch` updater. `EntryStatus` already includes `'playing'`.
- **`matchHandlers.ts`** already validates the join payload (zod `safeParse`), looks up the match (`MATCH_NOT_FOUND`), issues `playerId` + `token`, `addPlayer`, `socket.join(matchId)`, and acks `{ ok, playerId, token }`. 2.3 inserts the cap/status guards and the auto-start after `addPlayer`.
- **The reducer** owns `{ status, screen: 'home'|'waiting', match }`; actions `connected`/`disconnected`/`match/joined`. 2.3 adds `view: PlayerView | null`, screen `'match'`, action `match/state`. Keep the union closed/exhaustive (no `default` needed).
- **`App.tsx`** registers socket lifecycle listeners in a `useEffect([])` with symmetric `on`/`off` cleanup, and switches on `state.screen`. Add the `match:state` listener and the `match` case the same way.
- **`HomeScreen.tsx`** has the create→link→`match:join`→awaited-ack(with `socket.timeout(5000)`) pattern. `JoinScreen` reuses the join+ack half (no POST — the match already exists).
- **The protocol** (`engine/protocol/events.ts`) already declares `match:state(payload: PlayerView)` and the join ack/`CommandErrorCode` (`INVALID_BODY` | `MATCH_NOT_FOUND`); 2.3 adds `MATCH_FULL`.
- **2.2 review carryovers now due here (deferred-work.md):** the join cap / `status==='waiting'` guard / same-socket dedupe (this story, Task 2/3f). Store **eviction** stays deferred (match-end is 2.5).
- Tests at the start of 2.3: 128 green. Socket integration tests deferred; keep the auto-start handshake manual + unit-test the pure pieces.

### Git intelligence

- Branch `story/2.3` off `main` (PR #12 merged 2.2). Rhythm: hand-write → AI writes tests → green → commit → push → PR → `bmad-code-review` → fix → merge.
- ⚠️ A few **uncommitted 2.2-review leftovers** rode onto this branch (the `matchHandlers.ts` `console.log` removal, plus 2-2 doc / sprint-status bookkeeping). Fold them into an early commit on `story/2.3` (or a quick fixup) so they aren't lost.

### Technical notes

- **Why per-socket, not room-broadcast (decision 3b):** `io.to(matchId).emit('match:state', view)` would send the **same** `view` to both players — leaking player 1's top card to player 2. Each player must receive `projectFor(state, theirId)`. Emit to each stored `socketId`.
- **The two `createMatch`s:** `createMatchEntry()` (store, lobby record, no args) vs engine `createMatch(deck, players, rng)` (deals cards). 2.3 is the first place both appear — don't conflate them.
- **Stat labels (3g):** if you add `statDefinitions` to `PlayerView`, remember to update the engine's `projectFor` test (story 1.8) so the new field is covered, and the engine typecheck stays clean.
- **Creator's socket identity:** the creator joined in 2.2 and their `socketId` is stored. If their socket reconnected since, the stored id could be stale — acceptable at v1 (reconnect is a documented later concern; forfeit/disconnect is 2.6).
- **First chooser / Super Trump are random** — fine; the table just renders whatever the deal produced. Use `defaultRng` live so each match differs.

### Project Structure Notes

- New (client): `packages/client/src/components/JoinScreen.tsx`, `components/MatchScreen.tsx`, `components/CardView.tsx` (+ `CardView.test.tsx`).
- New (server): a small pure start-views helper (Task 3) + its test (e.g. `packages/server/src/sockets/startViews.ts` / `.test.ts`, or co-located with the handler).
- Update (engine): `packages/engine/src/types.ts` (`PlayerView` + `statDefinitions`) and `projection/projectFor.ts` (+ its test) — only if 3g's recommended path is taken.
- Update (server): `sockets/matchHandlers.ts` (guards + auto-start), `store/matchStore.ts` (`state` field + `startMatch`).
- Update (client): `state/reducer.ts` (+ test), `App.tsx` (`match:state` listener + `match` case), and the initial-screen-from-URL wiring.
- Matches the architecture tree (`components/`, `sockets/`, `store/`, engine `projection/`). [Source: architecture.md — Complete Project Directory Structure]

### References

- [Source: epics.md#Story-2.3] — story statement + ACs (verbatim)
- [Source: epics.md#Story-2.4] — what 2.3 stops short of (selectStat, reveal, gameplay)
- [Source: architecture.md — Communication & State Patterns, Enforcement Guidelines] — full-snapshot, projectFor-only door, per-player views
- [Source: architecture.md — Data Flow (one round, end to end)] — the deal → projectFor ×2 → match:state ×2 shape
- [Source: prd.md — FR3, FR4, FR8, FR19, FR29, FR30; NFR2, NFR3] — auto-start, server-authoritative per-player delivery, visibility surface, holder-only trump marker, placeholder card, ~1s reflection, hidden-info
- [Source: implementation-artifacts/2-2-…-shareable-link.md] — store/handler/reducer/socket patterns this story extends; the deferred join-cap now landing here
- [Source: implementation-artifacts/1-8-projection-what-each-player-is-allowed-to-see.md] — `projectFor` + the NFR2 assertions this story leans on
- [Source: addendum.md#Working-agreement; .decision-log.md#D18] — hand-write code; AI mentors

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted).

### Debug Log References

### Completion Notes List

Decisions:
- 3a — screen flow `home | join | waiting | match`. `initialScreen()` (in `reducer.ts`) reads `?match=` from `window.location.search`: present → `join`, absent → `home`. Guarded with `typeof window === 'undefined'` so it returns `home` in the node test env (no jsdom).
- 3b — auto-start: when `match:join` brings the match to 2 players, the server calls the engine `createMatch`, saves state, flips status to `playing`, then emits `match:state` to **each** socket with **its own** projection via `buildStartViews` → `io.to(socketId).emit(...)`. No room broadcast (each view differs).
- 3c — server passes `defaultRng` for live play; tests use seeded `mulberry32(seed)`.
- 3d — `MatchEntry` gained `state: MatchState | null`; new `startMatch(matchId, state)` updater sets state + flips status `waiting → playing`.
- 3e — engine `players` array = the two public `playerId`s (never the secret tokens).
- 3f — join guards in `match:join`: `MATCH_FULL` when ≥2 players; reject when status ≠ `waiting`; dedupe same `socketId`. `MATCH_FULL` added to the protocol `CommandErrorCode`.
- 3g — **recommended path taken:** added `statDefinitions: readonly StatDefinition[]` to `PlayerView`; `projectFor` copies `state.statDefinitions` through (public, non-hidden; also feeds 2.4's call-out). `CardView` renders labels + direction hint from it. Engine `projectFor` test updated.

Setup notes / gotchas resolved during the build:
- **`window` at module load:** `initialState` calls `initialScreen()`, which reads `window.location` — this crashed the client tests (node env, no jsdom: `ReferenceError: window is not defined`). Fixed with a `typeof window === 'undefined'` guard. (If client DOM tests are added later, set the client vitest `environment: 'jsdom'`.)
- **Per-socket emit, not room broadcast** — `io.to(matchId).emit(view)` would send one player's view to both; each player must get `projectFor(state, theirId)` on their own `socketId`.
- **Link display moved to the waiting screen** — `HomeScreen`'s link block never showed because the `match/joined` dispatch immediately navigates to `waiting` (HomeScreen unmounts). The link now renders in `WaitingView` from `state.match.link`. (Latent 2.2 gap, found by manual smoke.)
- **`match:state` (socket event) vs `match/state` (reducer action)** — easy to confuse; the colon name is the wire event, the slash name is the internal action.

Tests: 133 total green (was 122). New: client reducer `match/state` + shape updates; server `startViews.test.ts` (NFR2/AC4 — no opponent cards, no buried stack order, no Super Trump id, no tokens).

Deferred tests (manual-verified, consistent with the 2.1/2.2 socket-test deferral):
- `MATCH_FULL` 3rd-joiner rejection — **manually verified** (third tab rejected with "Match is full"). A unit test needs the join-guard extracted from the socket handler or a socket round-trip.
- `CardView` render (8 labeled stats + trump badge) and join-from-URL initial screen — need a DOM test env (jsdom + render lib), not set up on the client yet. Card rendering manually verified across two tabs. Recommend adding client jsdom/RTL infra as an early 2.4 task.

### File List

New:
- `packages/server/src/sockets/startViews.ts` — `buildStartViews(state, players)`: pure per-player `{ socketId, view }` via `projectFor`.
- `packages/server/src/sockets/startViews.test.ts` — NFR2/AC4 assertions (no hidden info, no tokens) + shape.
- `packages/client/src/components/JoinScreen.tsx` — reads `?match=` from the URL, nickname input → `match:join` (awaited ack + timeout) → `match/joined`.
- `packages/client/src/components/MatchScreen.tsx` — renders the table from a `PlayerView` (card, counts, pot, turn).
- `packages/client/src/components/CardView.tsx` — placeholder card: name + 8 labeled stat rows (label + value + direction hint) + holder-only Super Trump badge.
- `packages/client/src/components/WaitingView.tsx` — "waiting for opponent" + the shareable link (from `state.match.link`).

Changed:
- `packages/engine/src/types.ts` — `PlayerView` gained `statDefinitions` (3g).
- `packages/engine/src/projection/projectFor.ts` (+ test) — copies `statDefinitions` into the view.
- `packages/engine/src/protocol/events.ts` — `CommandErrorCode` gained `MATCH_FULL`.
- `packages/server/src/sockets/matchHandlers.ts` — join cap + status/socket guards; auto-start (engine `createMatch` + `startMatch`) + per-socket `match:state` emit. (Also carries the 2.2-review `console.log` removal.)
- `packages/server/src/store/matchStore.ts` — `MatchEntry.state` + `startMatch` updater.
- `packages/client/src/state/reducer.ts` — `view` + `match/state` action + `join`/`match` screens + `initialScreen()` from the URL.
- `packages/client/src/state/reducer.test.ts` — updated for the new shape + `match/state`.
- `packages/client/src/App.tsx` — `match:state` listener; `join` + `match` screen cases.
- `packages/client/src/components/HomeScreen.tsx` — passes `nickname` into `match/joined`; dead `matchLink` block removed.
