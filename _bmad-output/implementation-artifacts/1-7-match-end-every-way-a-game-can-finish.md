# Story 1.7: Match end — every way a game can finish

Status: done

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills Dev Agent Record (Completion Notes, File List) at completion.
     Do NOT run bmad-dev-story as designed on this story. -->

## Story

As a player,
I want matches to end correctly by conquest, attrition cap, or elimination,
so that every game reaches a true result.

## Acceptance Criteria

1. **Given** a player reaches zero cards, **when** state updates, **then** the opponent holds all 32 cards and the match ends with reason `allCards` (FR24). This covers both a normal decided round that empties the loser AND the story-1.6 FR23 tie-elimination (which already moves every card to one player).
2. **Given** round 100 completes, **when** evaluated, **then** the player with the **larger stack** wins with reason `roundCap` — the pot counts for **neither** player when deciding the winner; if stacks are **equal**, the match does NOT end and play continues (sudden death) until the next decided round breaks the tie (FR25).
3. **Given** any end state, **then** any cards still in the pot go to the match winner and exactly 32 cards are accounted for (FR25b) — asserted as an invariant by a long seeded random-play test that drives a full match to completion.
4. The ended state carries the winner, the `endReason`, and `roundsPlayed` (data the epic-2 result screen will read, FR26). No UI is built here.
5. **Given** a match that has already ended, **when** any command is applied, **then** it is rejected with a stable error code and the state is unchanged — the engine never acts on a finished match (this closes the 1.6-deferred `shift()!` crash). All earlier contracts (legality, tie→pot, Super Trump, transfer) are otherwise unchanged.

## Tasks / Subtasks

- [x] Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes
  - [x] **1a — How to represent "ended" in `MatchState`.** Recommended: a single nullable nested field, mirroring how `lastRound: RoundOutcome | null` already works — `result: MatchResult | null`, where `MatchResult = { winner: PlayerId; reason: EndReason }` and `null` means the match is still active. Benefit: winner and reason can never be half-set (you can't have a winner without a reason), and "is the match over?" is just `state.result !== null`. Alternative: two flat fields `winner: PlayerId | null` + `endReason: EndReason | null` — simpler but allows the invalid half-set state. Pick one and record it. (`createMatch` must initialise it to `null`/active.)
  - [x] **1b — The `EndReason` union.** This story needs `EndReason = 'allCards' | 'roundCap'`. A string-literal union, NOT free strings (same lesson as `CommandErrorCode`). `'forfeit'` is story 2.6 (disconnect) — do NOT add it now; the union just grows later. Architecture already reserves an `EndReason` type in `types.ts`.
  - [x] **1c — The finished-match guard + its error code.** Add a legality check at the TOP of `applyCommand` (before the chooser/stat checks): if the match is already ended, return `{ ok: false, error }` with a new stable `CommandErrorCode` — suggested `MATCH_OVER`. This is the thing that prevents the engine from ever reaching the unguarded `shift()!` on a 0-card state. Record the code name.
  - [x] **1d — Order of end checks + the round cap semantics.** After the round resolves (the existing 1.6 transfer/pot logic), evaluate end conditions in this order: (1) **conquest** — if either player now has 0 cards, the other wins, reason `allCards`; (2) **round cap** — else if `roundsPlayed >= 100`, compare stack sizes ignoring the pot: larger stack wins, reason `roundCap`; equal stacks → leave the match active (sudden death). Decide `>= 100` vs `=== 100` (recommended `>=`, it is a safety valve) and that conquest beats the cap when both could trigger.
  - [x] **1e — FR25b pot-to-winner on end.** When the match ends with a non-empty pot (only possible at the round cap right after a tie — a decided round already swept the pot in 1.6), move the entire pot to the winner's stack (reuse the 1.6 deterministic order) and empty the pot, so all 32 cards are always accounted for. Note: `roundsPlayed` counts decided rounds only (1.6 decision 1c), so "100 completed rounds" = `roundsPlayed === 100`. The 1.6 both-empty fallback (opponent-takes-all) already produces a 0-card player, so it is detected here as a normal `allCards` conquest — no special case needed (record this as how the 1.6 both-empty deferral is resolved).
- [x] Task 2: Extend the types in `packages/engine/src/types.ts` (AC: 1, 2, 4, 5)
  - [x] Add `EndReason` (per 1b) and the ended representation (per 1a). Add `MATCH_OVER` to `CommandErrorCode` (per 1c). Every new field `readonly`, deep-readonly like the rest of `MatchState`.
  - [x] Export the new types from the barrel `packages/engine/src/index.ts` (`export type` for `EndReason` and any new `MatchResult`; `MATCH_OVER` rides along inside `CommandErrorCode`). `.js` extensions on relative imports.
- [x] Task 3: Initialise the active state in `packages/engine/src/match/setup.ts` (AC: all)
  - [x] `createMatch` must set the new field to its active value (`result: null`). The 1.3 determinism test (`toEqual`) will catch the new field automatically — update its fixture/expectation.
- [ ] Task 4: Detect the end in `packages/engine/src/match/applyCommand.ts` (AC: 1, 2, 3, 5)
  - [x] Add the finished-match guard at the top (per 1c) — returns `MATCH_OVER`, state unchanged, no throw.
  - [x] After the existing transfer/pot resolution (and before building the returned state), run the end checks (per 1d): conquest → `allCards`; else round cap → `roundCap` (or stay active on equal stacks). On end, sweep any remaining pot to the winner (per 1e) and set the `result`.
  - [x] Do not change the tie→pot, Super Trump, or transfer logic — only add detection on top of the resolved state. Keep the no-throw rule: end conditions produce data, never throws.
- [ ] Task 5: Tests — extend `packages/engine/src/match/applyCommand.test.ts` (AC: all) — AI-permitted
  - [ ] Conquest (FR24): a decided round that takes the loser to 0 cards → `result.reason === 'allCards'`, `result.winner` holds all cards in play, loser has 0; 32-card multiset conserved (in the test's card set).
  - [ ] FR23 elimination ends the match: a tie that empties a player → the resulting state has a `result` with `allCards` (confirms 1.6's elimination state is now recognised as ended).
  - [ ] Round cap (FR25): build a state at `roundsPlayed = 99` with unequal stacks, play one decided round (→ 100) → `result.reason === 'roundCap'`, larger stack wins, pot (if any) swept to the winner. Mirror: equal stacks at the cap → `result === null` (still active, sudden death).
  - [ ] FR25b pot-to-winner: end on the cap with a non-empty pot → the pot cards land in the winner's stack and the 32-card total holds.
  - [ ] Guard (AC5): applying any command to an ended state → `{ ok: false }` with `MATCH_OVER`, state deep-equal unchanged (and crucially: no throw, even though a stack may be empty).
  - [ ] **Long seeded random-play test (FR25b headline):** start from `createMatch(onePieceDeck, players, mulberry32(seed))` and repeatedly apply `selectStat` for the current chooser, picking the stat from a seeded/rotating choice, until `state.result !== null`. Across several seeds assert: the match terminates within a sane bound (e.g. a few thousand commands — guard the loop), the 32-card multiset (stacks + pot) is conserved after EVERY command, and the final state has a valid `result` (a real `winner`, a known `reason`) with an empty pot.
  - [ ] Unchanged contracts: a mid-match decided round still passes the turn / sweeps the pot as in 1.6; legality (`NOT_CHOOSER`/`INVALID_STAT`) still returns first; purity holds.
- [ ] Task 6: Prove the loop (AC: all)
  - [ ] `npm test` — new suite green alongside the existing 92 tests; the 1.3 setup determinism test updated for the new field.
  - [ ] `npm run typecheck` — strict-clean.
  - [ ] `npm run format`.
  - [ ] Commit on `story/1.7`, push, open PR, run code-review per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews against this file + architecture.md — never paste-ready implementation code. **Exemptions: test files (Task 5) may be AI-written; AI fills the Dev Agent Record at completion.** [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]

### Scope guard

- This story is **engine match-end only**: detect the three end conditions, represent the ended state (winner + `endReason` + the already-present `roundsPlayed`), and guard against acting on a finished match. NOT here:
  - The result **screen** and **rematch** (FR26 UI) — epic 2. 1.7 only produces the *data* the screen will read.
  - **Forfeit** on disconnect (FR26 reason `forfeit`) — story 2.6. Do not add `'forfeit'` to `EndReason` yet.
  - Projection / hidden info (FR19, NFR2) — story 1.8.
  - Persistence of finished matches (FR27) — epic 3.
- No new dependencies. Engine stays pure and (for rule violations / finished-match commands) no-throw.

### Architecture constraints that bind this story

- **`EndReason` type lives in `types.ts`** (architecture reserves it: `types.ts # Card, StatKey, MatchState, PlayerView, EndReason…`). [Source: planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- **Functional core, no-throw for rule violations:** the finished-match guard returns a `CommandResult` error, never throws. [Source: architecture.md#Communication-State-Patterns]
- **Engine purity:** no Node APIs, I/O, `Math.random`, or Date. [Source: architecture.md#Architectural-Boundaries]
- **Stable error codes:** `MATCH_OVER` joins `NOT_CHOOSER`/`INVALID_STAT` as part of the contract. **Naming:** `endReason`, `roundCap`, `allCards`, `winner` — keep DB-facing vocabulary aligned (`end_reason` in epic 3). [Source: architecture.md#Format-Patterns, #Naming-Patterns]
- **Decoupling:** keep the round-cap rule and the (future) forfeit rule independent. [Source: architecture.md]

### Previous story intelligence (1.4 / 1.5 / 1.6 — all done & merged)

- **Current resolution flow** (`applyCommand`): legality (`NOT_CHOOSER`, `INVALID_STAT`) → copy stacks → `compareCards(...)` → `if/else if/else if` on `winner` (`null` tie → pot/elimination; `chooserId`/`opponentId` → `addCardsToWinnerStack(stack, chooserCard, opponentCard, pot)` then `pot = []`, `roundsPlayed++`). Your end-detection sits AFTER this block, reading the resolved `chooserStack`/`opponentStack`/`newPot`.
- **1.6 already produces terminal-looking states:** FR23 elimination moves all cards to one player (0-card loser). 1.7's conquest check is what finally labels these as ended. The 1.6 both-empty fallback (opponent-takes-all) lands here as a normal `allCards` conquest.
- **`roundsPlayed` counts decided rounds only** (1.6 decision 1c) — so "100 completed rounds" is `roundsPlayed === 100`. Ties don't advance the cap (they grow the pot instead).
- **Deterministic order helper** `addCardsToWinnerStack(winnerStack, chooserCard, opponentCard, pot)` → `push(...pot, chooserCard, opponentCard)`. Reuse it for the FR25b pot sweep if convenient.
- **`MatchState` is flat + deep-readonly** with the `X | null` nullable-field pattern already in use (`lastRound`). The `result: MatchResult | null` shape (1a recommendation) matches that exactly.
- **`shift()!` is still unguarded** — that has been the standing deferral since 1.4. The 1.7 guard (AC5) is what finally makes it unreachable: a finished match is rejected before any `shift()`. A player can only hit 0 cards as the *result* of a round, and the very next command is blocked by the guard.
- **Test idioms:** hand-built `MatchState` via `makeState` (now supports `chooser`, `roundsPlayed`, `superTrumpCardId`, `pot`); `structuredClone` for purity; multiset-conservation (sorted ids of stacks + pot) is the strongest invariant — the long random-play test leans on it.
- **Barrel** currently type-exports `Card, Deck, StatKey, StatDefinition, MatchState, PlayerId, Command, SelectStatCommand, CommandResult, CommandErrorCode, RoundOutcome`; value-exports `onePieceDeck, createMatch, mulberry32, defaultRng, applyCommand`. Add `EndReason` (+ `MatchResult` if 1a chooses the nested shape).
- **Review-cycle norm:** one review-fix commit per story (type-tightening, explicit branches). Write narrow literal types and explicit branches from the start.

### Git intelligence

- Rhythm: branch `story/1.7` → implement by hand → AI writes tests → green → commit → push → PR → code-review → fix → merge → artifacts commit.
- `main` after 1.6: 92 tests, strict typecheck, Prettier clean.

### Technical notes

- TS 6 / Vitest 4 / Node 24; no new packages.
- The random-play test must **bound its loop** (e.g. break after N commands and fail loudly) so a termination bug surfaces as a test failure, not a hang.
- `structuredClone(state)` before a call + `toEqual` after = purity check; reuse for the `MATCH_OVER` "state unchanged" assertion.

### Project Structure Notes

- Touched: `types.ts` (EndReason, ended representation, `MATCH_OVER`), `match/setup.ts` (init `result: null`) + `setup.test.ts` fixture, `match/applyCommand.ts` (guard + end detection), `index.ts` (export EndReason / MatchResult), tests in `match/applyCommand.test.ts`. No `round.ts` change expected (it reports the per-round winner; match-end is `applyCommand`'s job).

### References

- [Source: planning-artifacts/epics.md#Story-1.7] — story statement + ACs (verbatim)
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md] — FR24 (zero cards → opponent wins), FR25 (100-round cap, larger stack, sudden death), FR25b (pot to winner, 32 accounted for), FR26 (result data: winner, reason, rounds)
- [Source: planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `EndReason` in `types.ts`
- [Source: planning-artifacts/architecture.md#Communication-State-Patterns, #Format-Patterns] — functional core, stable error codes
- [Source: implementation-artifacts/1-6-ties-and-the-grand-line-pot.md] — tie→pot, FR23 elimination state, `roundsPlayed` decided-only, `addCardsToWinnerStack` order, both-empty fallback
- [Source: implementation-artifacts/deferred-work.md] — the `shift()!`/finished-match items this story closes

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted)

### Debug Log References

### Completion Notes List
1a - ended: MatchResult | null (mirrors lastRound | null pattern)
1b - EndReason = 'allCards' | 'roundCap'
1c - finished-match guard + MATCH_OVER code
1d - order of checks: conquest beats round cap; equal stacks at cap → sudden death
1e - FR25b pot-to-winner on end; both-empty fallback now lands here as normal allCards conquest

### File List

- `packages/engine/src/types.ts` (`EndReason`, `MatchResult`, `result` field, `MATCH_OVER` code)
- `packages/engine/src/index.ts` (export `EndReason`, `MatchResult`)
- `packages/engine/src/match/setup.ts` (init `result: null`)
- `packages/engine/src/match/applyCommand.ts` (MATCH_OVER guard, conquest + round-cap detection)
- `packages/engine/src/match/applyCommand.test.ts` (match-end suite + seeded random-play property test)

## Review Findings

_Code review 2026-06-21 (3 parallel layers). **AC1–5 all satisfied**, code matches recorded decisions 1a–1e, no throw on any legal play path, purity preserved. 99 tests green, typecheck clean. No decision-needed; no real High/Critical findings._

### Patches

- [x] [Review][Patch][Low] No dedicated test for the FR23 tie-elimination → ended path (conquest tests reached 0 via a decided round) — **RESOLVED:** added a test where a tie empties the chooser and the opponent collects all, asserting `result = { winner, reason: 'allCards' }`.
- [x] [Review][Patch][Low] Document the "pot is empty whenever `result` is set" invariant — **RESOLVED:** comment added above the end-detection block in `applyCommand.ts`.

### Deferred (engine trusts a well-formed 2-player state)

- [x] [Review][Defer] `find()!` (opponent lookup) and `shift()!` (top card) still assume exactly 2 non-empty players. The `MATCH_OVER` guard now closes the *realistic* case (every in-play 0-card state has `result` set, so it's rejected before any `shift`). The only way to reach an unguarded `shift()!` is a malformed input state (`createMatch` with <2 players, or a hand-built empty-stack-with-null-result) — out of scope; payload-shape validation lands at the 2.x zod boundary. (Standing item since 1.4; now mostly closed.)

### Dismissed (false positive / proven safe)

- **"False conquest on a draw" (Blind Hunter, Critical) — FALSE POSITIVE.** It assumed a tie that empties a stack leaves cards stranded in the pot. Verified against the code: a tie with an empty stack routes to the sweep branch (`applyCommand.ts:74/82`) — all cards go to the other player and `pot = []`; the pot-grow branch only runs when both stacks still hold cards. Conquest then correctly awards to the collector. Edge Hunter + Auditor independently confirmed.
- **Non-termination on perpetual ties** — cannot happen: each tie moves both top cards to the pot (stacks shrink by 2), so a tie chain depletes a stack within ≤16 ties → conquest; decided rounds increment toward the 100-round cap. Every path terminates (the 25-seed random-play test confirms empirically).
- **`throw`s in `conquestResultWinner` / `roundCapResultWinner`** — unreachable (each is called only after its `…Happened` predicate is true); architecture permits throws for programmer error. Compliant.