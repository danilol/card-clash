# Story 2.5: Every ending lands on a result screen — and a rematch

Status: done

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
I want a clear result screen with a rematch button,
so that finished games end gracefully and grudges can be settled.

**Plain-English goal:** Right now (after 2.4) when a match ends the board just freezes — there's no
ending. This story fixes that. When the engine says the match is over (someone took all the cards, or
the 100-round cap hit), **both** players see a **result screen**: who won, why it ended, and how many
rounds were played. From there, either player can hit **Rematch**; when **both** accept, a brand-new
game starts between the same two players (new shuffle, new Super Trump). And the finished match is
cleaned out of the server's memory.

**Terms used in this story (defined once):**
- **match end** — the engine sets `state.result` (a `MatchResult`) when the game is decided. `applyCommand` returns this in its `ok` state; it never needs a separate "end" call.
- **`MatchResult`** — `{ winner: playerId, reason: EndReason }`. **`EndReason`** = `'allCards'` (won every card) or `'roundCap'` (100-round safety cap, larger stack wins).
- **`match:ended`** — the server→client event (already declared) carrying the final `PlayerView`. The client switches to the result screen on it.
- **ResultScreen** — the new screen showing the outcome (you won / you lost), the end reason, and rounds played (FR26), plus a **Rematch** button.
- **rounds played** — `MatchState.roundsPlayed`. FR26 needs it on the result screen, so this story adds `roundsPlayed` to `PlayerView` (the field deferred since 2.3).
- **`match:rematch`** — the new client→server event: "I want to play again." A rematch starts only when **both** players send it.
- **eviction** — removing a finished match from the in-memory `matchStore` so memory doesn't grow.

## Acceptance Criteria

(Verbatim from epics.md#Story-2.5, split for traceability.)

1. **Given** the engine reports an ended match, **when** clients receive `match:ended`, **then** both render the ResultScreen: winner, end reason (all cards / round cap), rounds played (FR26). **And** the match is evicted from the in-memory store after the ended event fires.
2. **Given** both players accept rematch, **then** a fresh matchId starts a new match between the same two players with a new shuffle and Super Trump.

## Tasks / Subtasks

- [x] **Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes**
  - [x] **5a — Detect end and emit `match:ended` (not `match:state`).** In the `match:selectStat` handler, after `applyCommand` succeeds, branch on `result.state.result`: if it's **non-null** the match ended → save the state, then emit **`match:ended`** (per-player `projectFor` view) to both sockets. If it's null → the existing `match:state` to both, unchanged. Record.
  - [x] **5b — Add `roundsPlayed` to `PlayerView` (FR26).** The result screen shows "rounds played," but `PlayerView` doesn't carry it. Add `roundsPlayed: number` to `PlayerView` (`types.ts`) and copy `state.roundsPlayed` through in `projectFor` (+ update the `projectFor` test). This is the field deferred in 2.3/2.4. It's public (same for both players), so it's safe in the projection. Record.
  - [x] **5c — Result-screen content + the client screen/action.** Add a `result` screen and a new reducer action (recommend `match/ended` carrying the final view; it sets `screen: 'result'` and stores the view). The ResultScreen renders from the final `PlayerView`: outcome from the **viewer's** POV (`result.winner === you` → "You won" else "You lost"), the **reason** (`allCards` → "All cards captured", `roundCap` → "Round cap reached"), and **rounds played**. No nickname needed (the engine works in playerIds; viewer-POV is enough — nicknames aren't in `PlayerView`). Record.
  - [x] **5d — Rematch handshake. ⚠️ the complex piece.** Add a `match:rematch` client→server event (payload `{ matchId, token }`). When a player sends it, record their acceptance on the (still-present) match entry. When **both** players have accepted, the server deals a fresh match (`createMatch(onePieceDeck, [p1.playerId, p2.playerId], defaultRng)`) for the **same two players** and sends them both back into play. Record the acceptance tracking (e.g. a `rematchAccepted: Set<playerId>` on the entry) and the both-accepted trigger.
  - [x] **5e — Rematch identity: reuse or fresh matchId? (decide).** AC2 says "a fresh matchId." Two options:
    - **Option A (simplest, recommended for now):** re-deal into the **same** entry/matchId (reset `state` via `createMatch`, clear the rematch set, status → `playing`), emit `match:state` to both. No client matchId change needed. Slight wording deviation from "fresh matchId," but functionally a new game; cleanest for two already-connected players. (Note: when persistence lands in Epic 3, each finished match is a row — a fresh id per game is tidier then; revisit.)
    - **Option B (literal AC):** create a **new** entry with a new matchId carrying the same players (same tokens/socketIds), evict the old entry, and tell both clients the new matchId (e.g. a `match:rematchReady { matchId }` event or an ack) so their next `match:selectStat` targets it; then emit `match:state`.
    Pick one and record why. (Recommend A unless you want the literal fresh id now.)
  - [x] **5f — Eviction timing vs rematch (resolve the AC1 tension).** AC1 says evict "after the ended event fires," but the rematch needs the player pairing to survive. Recommended: on `match:ended` mark `status: 'ended'` and **keep** the entry (no more moves are accepted — `applyCommand` returns `MATCH_OVER`); evict/clean it when the rematch resolves (Option A reuses it; Option B evicts the old one when the new match starts) or when a player disconnects. A standalone abandoned-match TTL stays deferred (already in `deferred-work.md`). Add a store `deleteMatch(matchId)` / eviction helper. Record the chosen lifecycle and note the AC1-wording interpretation.
  - [x] **5g — "Waiting for rematch" UI state.** After a player clicks Rematch, show "waiting for opponent to accept…" until the other accepts (or they leave). Decide the client signal — a reducer field (e.g. `rematchPending: boolean`) set on click, cleared when the new `match:state` arrives. Record.
  - [x] **5h — Client test infra (jsdom/RTL) — overdue, decide now.** Deferred since 2.3 and flagged at the 2.4 close. 2.5 adds the ResultScreen + rematch UI on top of 2.4's still-untested reveal/error/pending UI. **Strong recommendation: set up the client `vitest environment: 'jsdom'` + `@testing-library/react` in this story** (it's logged in `deferred-work.md`), then add the deferred component tests (ResultScreen, CardView click, the reveal). Record the choice.

- [x] **Task 2: Engine — `roundsPlayed` on the view (AC: 1)** — `packages/engine`
  - [x] `types.ts`: add `readonly roundsPlayed: number` to `PlayerView`.
  - [x] `projection/projectFor.ts`: set `roundsPlayed: state.roundsPlayed`. Update `projectFor.test.ts` to assert it. Engine stays pure (no new imports). [Source: architecture.md — engine boundary]

- [x] **Task 3: Protocol — the rematch event (AC: 2)** — `packages/engine/src/protocol/`
  - [x] `commands.ts`: add `rematchCommandSchema = z.object({ matchId: z.string(), token: z.string() })` + its inferred type. (Same shape as a token-authenticated command.)
  - [x] `events.ts`: add `'match:rematch': (payload: RematchPayload) => void` to `ClientToServerEvents`. If Option B (5e), also add the `match:rematchReady`/identity event to `ServerToClientEvents`. `match:ended` already exists. Export new schema/types from `index.ts`.

- [x] **Task 4: Server — end detection, eviction, rematch (AC: 1, 2)** — `packages/server/src/sockets/` + `store/`
  - [x] `matchHandlers.ts` `match:selectStat`: after a successful `applyCommand`, if `result.state.result !== null` → `updateMatchState`, set status `ended` (5f), emit `match:ended` (per-player view) to both; else the existing `match:state` path.
  - [x] New `match:rematch` handler: zod-parse → find match + player by token (reuse the guards) → record acceptance (5d). When both accepted → fresh `createMatch` deal for the two players, per 5e (reuse the same entry, or new id + evict old), reset/clear the rematch set, emit `match:state` to both (Option B: signal the new matchId first).
  - [x] `store/matchStore.ts`: add the rematch-acceptance field to `MatchEntry`, a `deleteMatch(matchId)` (eviction), and whatever updater the chosen 5e path needs. Keep the engine call (`createMatch`) behind the handler; the store just holds state.
  - [x] Reuse `buildStartViews` for the per-player emits (it projects any state).

- [x] **Task 5: Client — ResultScreen + rematch (AC: 1, 2)** — `packages/client`
  - [x] `App.tsx`: add a `match:ended` listener → dispatch `match/ended` (symmetric `off` cleanup). Add the `result` screen case → `<ResultScreen view={state.view} onRematch={…} rematchPending={…} />`. The rematch button emits `match:rematch { matchId, token }` (from `state.match`) and sets `rematchPending`.
  - [x] New `packages/client/src/components/ResultScreen.tsx`: renders outcome (you won/lost from `view.result`), reason, `view.roundsPlayed`, and a Rematch button; shows "waiting for opponent…" when `rematchPending`.
  - [x] `state/reducer.ts`: add `screen: 'result'`; `match/ended` action (sets `screen: 'result'`, stores the final view); `rematchPending` field (5g) set on rematch-click, cleared on the next `match/state` (which means the rematch started). Keep the union exhaustive. Update `reducer.test.ts`.
  - [x] When the rematch's `match:state` arrives, the reducer already routes to the `match` screen (Option A); for Option B also update `match.matchId` from the new-id signal.

- [x] **Task 6: Tests — AI-written**
  - [x] Engine: `projectFor` exposes `roundsPlayed` (add to the existing test).
  - [x] Protocol: `rematchCommandSchema` accepts `{ matchId, token }`, rejects missing token.
  - [x] Reducer: `match/ended` → `screen: 'result'` + stores view; `rematchPending` set/cleared; existing cases pass; no mutation.
  - [x] Server rematch logic — keep socket-free where possible: if the "both-accepted → fresh deal" decision is extracted into a pure helper, unit-test it (one acceptance → still waiting; both → new dealt state for the same two players). Otherwise note manual-verify (the 2.1–2.4 stance).
  - [x] If 5h taken (jsdom): `ResultScreen` renders won/lost + reason + rounds; the deferred `CardView` click + reveal tests land too.
  - [x] Engine end rules (allCards / roundCap / pot disposition) are already covered by the story-1.7 tests — do NOT retest.

- [x] **Task 7: Prove it (AC: all)**
  - [x] `npm run dev`, two tabs, play a match to the end (fastest: let one player win via Super Trump dominance, or hand-play toward all-cards). On end, **both** tabs show the ResultScreen with the correct winner, reason, and rounds played.
  - [x] Click **Rematch** on one tab → it shows "waiting for opponent…"; click it on the other → a fresh match deals and both tabs return to the table (new cards). Confirm the old match is gone from memory (a stale `selectStat` to the old matchId → `MATCH_NOT_FOUND`/`MATCH_OVER`).
  - [x] `npm run typecheck` clean; `npm test` green; `npm run format`.
  - [ ] Commit on `story/2.5`, push, open PR, run `bmad-code-review` per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews — never paste-ready implementation code. **Exemptions:** scaffolding; test files (Task 6) may be AI-written; AI fills the Dev Agent Record; config/tooling/server-setup files AI may edit directly. [Source: addendum.md#Working-agreement; D18]

### Scope guard — what is NOT in 2.5

- **No persistence.** FR27 (write the finished match to Postgres) and FR28 (recent-matches list) are **Epic 3**. 2.5 evicts from memory but writes nothing to a DB. (The architecture's "evict after match:ended **+ FR27 write**" — the FR27 half is Epic 3; 2.5 does the eviction half.)
- **No disconnect/forfeit** (FR5) → story 2.6. (Note: 2.6 is the last Epic-2 story; a disconnect during the result/rematch screen is 2.6's concern.)
- **No new game rules** — match-end logic (allCards, roundCap, pot disposition, FR25b) is already in the engine (story 1.7). 2.5 only *renders* the end and re-deals on rematch.
- Counter-metric (PRD): time-to-playable. Keep the ResultScreen simple; the rematch handshake is the real work — don't gold-plate the screen.

### Architecture constraints that bind this story

- **`projectFor` is the only door**; `match:ended` carries a `PlayerView`, never `MatchState`. Adding `roundsPlayed` keeps it a projection (public field). [Source: architecture.md — Enforcement Guidelines; NFR2]
- **Full-snapshot:** the final `PlayerView` is the complete end state; the client renders what it's told. [Source: architecture.md — Communication & State Patterns]
- **Per-player emit** for `match:ended` and the rematch `match:state` — each player their own projection, addressed to their socket (as in 2.3/2.4). [decision 3b lineage]
- **Eviction:** matches are removed from `matchStore` after they end (architecture: "evict after `match:ended` + the FR27 write; rematch = fresh matchId in a fresh store entry"). The FR27 write is Epic 3; honor the eviction + fresh-entry intent here (5e/5f). [Source: architecture.md — Validation Issues Addressed #1]
- **Token identity** authenticates the rematch (same as `selectStat`); the server never trusts a client-sent playerId. [Source: architecture.md — Authentication & Security]
- **Engine stays pure; client imports TYPES only; one reducer; `domain:action` event names.** [Source: architecture.md]

### Recorded tech choices / engine API used (already built + tested)

- `applyCommand` returns the ended state with `result: MatchResult` set (stories 1.7). `MatchResult = { winner: PlayerId, reason: 'allCards' | 'roundCap' }`. `state.roundsPlayed` is maintained by the engine.
- `createMatch(onePieceDeck, [p1, p2], defaultRng)` — reused for the rematch deal (fresh shuffle + Super Trump). Seeded `mulberry32` in tests.
- `projectFor` already returns `result` on the view; 2.5 adds `roundsPlayed`.

### Previous work intelligence (story 2.4)

- **The selectStat handler is the hook for end-detection.** It currently does `updateMatchState` + `match:state` ×2 unconditionally; 2.5 inserts the `result.state.result !== null` branch → `match:ended`. (2.4 deliberately left match-end emitting `match:state` — that's the gap this story closes.)
- **`match:ended` is already declared** in `ServerToClientEvents` (payload `PlayerView`) — just start emitting it.
- **The reducer pattern**: `{ status, screen, match, view, error }`; `match/state` sets `view` + clears `error`; screens `home|waiting|join|match`. 2.5 adds `result` + `match/ended` + `rematchPending`. Keep the union closed (no `default`).
- **The store**: `MatchEntry { matchId, status: 'waiting'|'playing'|'ended', players: Player[]{playerId,token,nickname,socketId}, createdAt, state }`; `createMatchEntry`, `getMatch`, `addPlayer`, `startMatch`, `updateMatchState`. 2.5 adds rematch-acceptance + `deleteMatch`. `status: 'ended'` already exists in the type.
- **`buildStartViews(state, players)`** projects per player → reuse for `match:ended` and rematch emits. (Name is start-flavored but works for any state; rename to `buildPlayerViews` if you like — noted in 2.4 too.)
- **The `pending` lock pattern** (2.4) is a good model for `rematchPending` (set on click, cleared on the server response).
- **jsdom is STILL not set up** (deferred 2.3 → flagged 2.4). 2.5 (5h) is the recommended place to finally add it; the 2.4 UI (reveal, error banner, pending) is all manually-verified-only until then.
- Tests at the start of 2.5: 143 green.

### Git intelligence

- Branch `story/2.5` off `main` (2.4 merged via PR #14). Rhythm: hand-write → AI writes tests → green → commit → push → PR → `bmad-code-review` → fix → merge.
- Deferred items now in play: `roundsPlayed` on `PlayerView` (5b — predicted in 2.3/2.4), client jsdom infra (5h). Disconnect/forfeit stays for 2.6.

### Technical notes

- **End detection is data, not a new call:** don't add an "end" command — just read `result.state.result` after the normal `applyCommand`. The engine already decided.
- **Why keep the entry briefly after end (5f):** rematch needs the two players' tokens/sockets. Fully deleting on `match:ended` would orphan the pairing. Keep `status: 'ended'`; no moves are accepted (engine → `MATCH_OVER`); clean up on rematch-start or disconnect.
- **Rematch is the hard part — keep it minimal.** The simplest correct shape (Option A) re-deals into the same entry; the client needs no new matchId, just the incoming `match:state`. Don't over-engineer the "both accept" coordination — a `Set<playerId>` of accepters on the entry, checked for size 2, is enough.
- **Result screen has no nickname:** `PlayerView` is engine-projected (playerIds only). Show "You won / You lost" from `result.winner === view.you`. Nicknames live in the server store and reach the DB in Epic 3, not the screen here.
- **A rematch is a brand-new `MatchState`** — new shuffle, new Super Trump, new random first chooser — exactly what `createMatch` produces. Same two players (their playerIds), fresh deal.

### Project Structure Notes

- Update (engine): `types.ts` (`PlayerView.roundsPlayed`), `projection/projectFor.ts` (+ test), `protocol/commands.ts` (rematch schema), `protocol/events.ts` (`match:rematch`, optional `match:rematchReady`), `index.ts` (exports).
- Update (server): `sockets/matchHandlers.ts` (end branch + `match:rematch` handler), `store/matchStore.ts` (rematch-accept field, `deleteMatch`, rematch updater).
- New (client): `components/ResultScreen.tsx`. Update `App.tsx` (`match:ended` listener, `result` case, rematch wiring), `state/reducer.ts` (+ test) (`result` screen, `match/ended`, `rematchPending`).
- Possibly new: client `vitest` jsdom config + `@testing-library/react` (5h).
- Matches the architecture tree; no new packages. [Source: architecture.md — Complete Project Directory Structure]

### References

- [Source: epics.md#Story-2.5] — story statement + ACs (verbatim)
- [Source: epics.md#Story-2.6] — boundary: disconnect/forfeit is the next story
- [Source: architecture.md — Validation Issues Addressed #1, Communication & State Patterns, Enforcement Guidelines] — eviction + rematch = fresh entry; full-snapshot; projection-only
- [Source: prd.md — FR26; FR25/FR25b (end reasons), NFR2] — result screen (winner, reason, rounds) + rematch; end conditions; hidden-info
- [Source: implementation-artifacts/1-7-match-end-every-way-a-game-can-finish.md] — the end rules this story renders (already tested)
- [Source: implementation-artifacts/2-4-…-play-rounds.md] — the selectStat handler hook, the reducer/screen patterns, the pending-lock model, the jsdom deferral
- [Source: addendum.md#Working-agreement; .decision-log.md#D18] — hand-write code; AI mentors

## Review Findings

_Code review 2026-06-28 (3 parallel layers) on branch `story/2.5` vs `main`. AC1 result-screen ✅; AC2 rematch ✅ (matchId reused — documented deviation). typecheck clean, 148 tests. But the review found **one real correctness bug** (final state not persisted on end), **one product/scope decision** (card artwork contradicts FR29 and is out of 2.5 scope), and the **AC1 eviction clause is unmet** (no `deleteMatch`)._

### Decision needed

- [x] [Review][Decision] **(Resolved 2026-06-28 — KEEP + amend FR29.)** FR29 updated in `prd.md` + `epics.md` to allow card artwork with a placeholder fallback; artwork kept (images stay in git as-is; IP revisit-before-public note carried). **Card artwork contradicts FR29 and is out of 2.5 scope.** `CardView` now renders `<img src="/images/cards/{id}.png">` (with a `.jpg` fallback + emoji placeholder) and **32 character images** were committed (one ~520 KB). FR29 says a card is "a simple placeholder: character name plus 8 labeled stat values — **no artwork**," and 2.5's scope is the result screen + rematch. This isn't a bug — it's a deliberate feature against a written requirement. **Decide:** (a) keep it and amend FR29/the PRD to allow artwork (per the architecture's "if reality disproves a decision, amend the doc first") — and move the artwork to its own story/commit; or (b) revert to the placeholder for 2.5. Side notes: the images are copyrighted One Piece art (the PRD's own OQ1 deferred IP "before public"), and a 520 KB PNG in git is repo-bloat worth `.gitignore`/Git-LFS thought.

### Patches — recommended

- [x] [Review][Patch][Med] **The match end doesn't persist the final state → a late `selectStat` resolves another round.** The end-branch emits `match:ended` and `return`s **without** `updateMatchState`, so the store keeps the *pre-final* state (`result === null`). A stray/queued `match:selectStat` after the end (double-click before the screen switches, re-delivery) passes the `!entry.state` guard, `applyCommand` runs on the stale state (no `MATCH_OVER` because the stored state isn't terminal), and resolves an extra round — yanking both clients back into a "finished" match. Fix: in the end-branch, `updateMatchState(parsed.data.matchId, result.state)` (and set `status: 'ended'`) **before** emitting `match:ended`; then a late command hits the terminal state → `MATCH_OVER` → `match:error`. [`sockets/matchHandlers.ts`] (all 3 layers)

### Patches — quality (your call)

- [x] [Review][Patch][Low] **Rematch error leaves the button stuck.** `match/error` doesn't clear `rematchPending`, so if the rematch emit errors the button stays "Waiting for opponent…". Clear `rematchPending` in the `match/error` reducer case. [`state/reducer.ts`]
- [x] [Review][Patch][Low] **Debug JSON panel re-introduced** ("Inspect JSON Engine State" → `JSON.stringify(view)`) in `MatchScreen` — this is a regression of the 2.4 P4 fix. Remove it, or dev-gate it (`import.meta.env.DEV`). [`MatchScreen.tsx`]
- [x] [Review][Patch][Low] **`match:ended` is wrongly in `ClientToServerEvents`** (`() => void`) — it's a server→client event only. Remove that line (leave it in `ServerToClientEvents`). [`protocol/events.ts`]
- [x] [Review][Patch][Low] **Rematch handler uses raw `payload.token`** instead of the validated `parsed.data.token`; and (after the Med fix) guard that the match actually ended (`entry.state.result !== null` / status `ended`) before accepting a rematch. [`sockets/matchHandlers.ts`]
- [x] [Review][Patch][Low] **Dead/fragile `entry.state = null`** just before `startMatch` (which overwrites it) — and if `createMatch` ever threw, the match would be left nulled. Remove the line (build then swap). [`sockets/matchHandlers.ts`]
- [x] [Review][Patch][Low] **`case 'result'` declares `const` without a block** (unlike `case 'match'`) — `no-case-declarations` hygiene; wrap the body in `{ }`. [`App.tsx`]
- [x] [Review][Patch][Low] **(optional)** ResultView shows the raw reason (`allCards`/`roundCap`); map to the human strings the spec suggested ("All cards captured" / "Round cap reached"). [`ResultView.tsx`]

### Deferred

- [x] [Review][Defer] **AC1 eviction unmet — no `deleteMatch`.** Finished matches stay in the in-memory Map; an abandoned (un-rematched) match leaks. This is in tension with Option A (rematch reuses the entry), so eviction needs a different trigger — disconnect cleanup (**story 2.6**) + an abandoned-match TTL (already deferred). The literal AC1 "evict after ended" lands with 2.6.
- [x] [Review][Defer] **One-sided rematch has no exit.** If a player accepts and the opponent never does, the accepter is stuck on "Waiting for opponent…" forever (no decline/timeout). The "opponent left" half lands with disconnect/forfeit (2.6); a rematch-decline/timeout is a small follow-up.

### Dismissed

- `buildStartViews` reused for `match:ended` — cosmetic naming (`projectFor` handles a terminal state fine); rename to `buildPlayerViews` someday.
- `CardView` `onError` stale-closure — minor, and moot if the artwork is reverted (see the decision above).

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted).

### Debug Log References

### Completion Notes List

Decisions (fill at implementation):
- 5a — In `match:selectStat`, after `applyCommand` success: if `result.state.result` non-null → emit `match:ended` to both and return; else the existing `match:state` path.
- 5b — Added `roundsPlayed: number` to `PlayerView`; `projectFor` copies `state.roundsPlayed` (test asserts it).
- 5c — Component is `ResultView` (not `ResultScreen`). New `result` screen + `match/ended` action carrying the final view → `screen: 'result'`, stores `view`. Renders `result.winner === you` → "You won!"/"Opponent won!", `result.reason`, `roundsPlayed`. Viewer-POV (no nickname — not in `PlayerView`).
- 5d — `match:rematch { matchId, token }`; acceptance = `rematchAccepted: string[]` on the entry + `isRematchAccepted` dedupe guard + `acceptRematch` helper. `length === 2` → `createMatch` fresh deal + `startMatch` + `match:state` to both.
- 5e — **Option A (reuse the same entry/matchId):** rematch re-deals into the same entry via `startMatch`; no new matchId. Conscious deviation from AC2's literal "fresh matchId" (functionally a new game; a literal fresh id is tidier once Epic 3 persistence lands).
- 5f — On `match:ended` the entry is **kept** (so rematch can reuse it). **No `deleteMatch`/eviction added** — un-rematched finished matches stay in the Map; the AC1 "evict after ended" half is effectively the deferred abandoned-match TTL (in `deferred-work.md`). Follow-up.
- 5g — `rematchPending: boolean`; `match/rematchPending` sets it (on Rematch click); cleared by `match/state` and `match/ended`.
- 5h — **kept deferred** (no jsdom/RTL). ResultView + rematch manually verified (two-tab smoke). Client DOM test infra stays the logged next infra task.

Setup notes / gotchas resolved during the build:
- **`match:ended` is server→client** — the rematch handler is `socket.on('match:rematch', …)` (client→server), not `match:ended` (the emit-vs-listen direction trap again).
- **The final view must be captured:** `onMatchEnded(view)` passes the payload into `match/ended`, and the reducer stores it — otherwise `ResultView` rendered the stale pre-end view (result `null` → always "Opponent won!").
- **`rematchPending` is only *cleared* by the reducer** — it must be *set* by `match/rematchPending` dispatched on the Rematch click, or the "waiting…" state never shows.
- **Debug aid:** temporarily lowering the round cap (`applyCommand.ts` `>= 100` → `>= 1`) forces an instant end for manual testing — reverted to `100` before commit (the engine round-cap test asserts 100).

Tests: 148 total green. New: `commands.test.ts` rematch-schema; reducer `match/ended` + `match/rematchPending`. `projectFor` `roundsPlayed` already covered.

Deferred (manual-verified): client DOM tests (jsdom/RTL — ResultView, CardView click, reveal) and the live socket round-trip — consistent with the 2.1–2.4 stance.

### File List

New:
- `packages/client/src/components/ResultView.tsx` — result screen (outcome / reason / rounds + Rematch).

Changed (engine):
- `types.ts` — `PlayerView.roundsPlayed`.
- `projection/projectFor.ts` (+ test) — copies `roundsPlayed`.
- `protocol/commands.ts` (+ `commands.test.ts`) — `rematchCommandSchema` + `RematchCommand`.
- `protocol/events.ts` — `match:rematch` in `ClientToServerEvents`.
- `index.ts` — export rematch schema/type.

Changed (server):
- `sockets/matchHandlers.ts` — `selectStat` end-branch (`match:ended`); `match:rematch` handler (dedupe-accept → both-accepted → fresh deal).
- `store/matchStore.ts` — `MatchEntry.rematchAccepted`, `acceptRematch`, `isRematchAccepted`.

Changed (client):
- `App.tsx` — `match:ended` listener; `result` screen case; rematch emit + `match/rematchPending`.
- `state/reducer.ts` (+ `reducer.test.ts`) — `result` screen, `match/ended` (stores view), `match/rematchPending`, `rematchPending`.
