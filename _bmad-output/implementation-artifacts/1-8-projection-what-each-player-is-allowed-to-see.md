# Story 1.8: Projection — what each player is allowed to see

Status: ready-for-dev

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills Dev Agent Record (Completion Notes, File List) at completion.
     Do NOT run bmad-dev-story as designed on this story. -->

## Story

As a player,
I want to receive only my own view of the match,
so that my opponent's cards and the Super Trump's location stay secret.

## Acceptance Criteria

1. **Given** any `MatchState`, **when** `projectFor(state, playerId)` runs, **then** the returned `PlayerView` contains: my own top card, both stack counts, the pot count, the turn indicator (who is the chooser), and the `lastRound` reveal — and contains **NO** opponent card data, **NO** deck order, and **NO** Super Trump location (NFR2, FR4, FR30).
2. **Given** the Super Trump is **my** top card, **then** my view marks it (a boolean flag); **and given** it is anywhere else (my deeper stack, the opponent's stack, or the pot), **then** no view reveals it (FR19) — and in particular the raw `superTrumpCardId` value never appears in any view.
3. A test serializes a `PlayerView` to JSON and asserts the forbidden data is absent (the opponent's card ids, the Super Trump id when it is not my visible top card, and any full-stack/deck-order data). This is the NFR2 wire-safety check.
4. `projectFor` is a **pure** read-only derivation — it never mutates `state` and adds no randomness or I/O. The engine remains the single source of truth; `PlayerView` is the only shape that may leave it.

## Tasks / Subtasks

- [x] Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes
  - [x] **1a — The `PlayerView` shape.** It must carry exactly what FR30 + AC1 allow and nothing more. Suggested fields: `you: PlayerId`; `yourTopCard: Card | null` (null when your stack is empty); `yourStackCount: number`; `opponentStackCount: number`; `potCount: number`; `chooser: PlayerId` (turn indicator — derive `isYourTurn` in the client if wanted, or include it); `yourTopCardIsSuperTrump: boolean` (the FR19 marker — a boolean, never the id); `lastRound: RoundOutcome | null` (the FR12 reveal — both played cards are public once played); `result: MatchResult | null` (winner + reason once the match ends — public). Decide the exact field set and names and record them. **The view must NOT contain:** `superTrumpCardId`, the opponent's `Card[]`, your own full stack array, or any deck order.
  - [x] **1b — Location + signature.** Per the architecture tree this is a NEW module in its own directory: `packages/engine/src/projection/projectFor.ts`, signature `projectFor(state: MatchState, viewerId: PlayerId): PlayerView`. Co-locate `projectFor.test.ts`. (`projection/`, not `match/` — the architecture reserves a `projection/` folder; no `utils` dumping ground.)
  - [x] **1c — The Super Trump marker rule (FR19).** `yourTopCardIsSuperTrump = yourTopCard !== null && yourTopCard.id === state.superTrumpCardId`. Compute it ONLY for the viewer's own top card. Never compute or expose whether the opponent's top card is the trump, and never copy `state.superTrumpCardId` into the view. (Subtlety: when your own top card *is* the trump, `yourTopCard.id` legitimately equals the trump id — that is allowed, because it is your own visible card. The forbidden case is the id leaking when the trump is NOT your visible top card.)
  - [s] **1d — Unknown viewer.** If `viewerId` is not one of `state.players`, this is programmer error (projection is server-internal). Recommended: `throw` (the architecture reserves throws for programmer error) — NOT a `CommandResult`-style error, since `projectFor` returns a `PlayerView`, not a `CommandResult`. Decide and record.
  - [x] **1e — Counts only for hidden things.** The opponent is represented by `opponentStackCount` only (never their cards). The pot is represented by `potCount` only (never its contents). `lastRound` is the one place card identities appear, and only because those cards were played face-up (FR12). Confirm you are exposing counts, not arrays, for the hidden zones.
- [x] Task 2: Add the `PlayerView` type in `packages/engine/src/types.ts` (AC: 1, 2)
  - [x] Define `PlayerView` (per 1a), every field `readonly`, deep-readonly like the rest. Export it from the barrel `packages/engine/src/index.ts` (`export type`). `.js` extensions on relative imports. (Architecture already reserves `PlayerView` in `types.ts`.)
- [x] Task 3: Implement `packages/engine/src/projection/projectFor.ts` (AC: all)
  - [x] `projectFor(state, viewerId)`: resolve the opponent (the other player), read the viewer's top card (index 0, or null if empty), build the `PlayerView` with counts for the hidden zones and the FR19 marker boolean. Pure: read `state`, return a new `PlayerView`; no mutation, no Rng, no I/O.
  - [x] Construct the view by **explicitly listing** the allowed fields — do NOT spread `...state` or copy whole objects, or hidden data leaks by accident. The whole point of this module is that it is an allow-list, not a deny-list.
- [x] Task 4: Tests `packages/engine/src/projection/projectFor.test.ts` (AC: all) — AI-written
  - [x] Own view (AC1): top card, both counts, pot count, chooser, `lastRound`; each player sees their own top card.
  - [x] Trump marker (FR19, AC2): true on own top, false otherwise; trump on opponent's top → holder true, other false.
  - [x] NFR2 serialization (AC3): trump on opponent's top → JSON of the view contains neither the trump id, the opponent's card ids, nor the viewer's own deeper cards (only the top card). Mirrored for both players.
  - [x] Empty stack → null top card, zero count, no crash.
  - [x] Unknown viewer → throws (now an explicit `Unknown viewer` guard).
  - [x] Purity: input unchanged; view survives a JSON round-trip.
- [ ] Task 5: Prove the loop (AC: all)
  - [x] `npm test` — 109 passed (99 prior + 10 new).
  - [x] `npm run typecheck` — strict-clean.
  - [x] `npm run format`.
  - [ ] Commit on `story/1.8`, push, open PR, run code-review per process. (This closes Epic 1.)

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews against this file + architecture.md — never paste-ready implementation code. **Exemptions: test files (Task 4) may be AI-written; AI fills the Dev Agent Record at completion.** [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]

### Scope guard

- This story is **the pure projection function + the `PlayerView` type only.** NOT here:
  - The socket emit / `match:state` broadcast and the typed event protocol — story 2.x. 1.8 only produces the safe shape; sending it is later.
  - The client/UI that renders a `PlayerView` (FR30 rendering) — epic 2.
  - zod validation of inbound payloads — 2.x.
  - Persistence — epic 3.
- No new dependencies. `projectFor` is pure: no Node APIs, no I/O, no `Math.random`, no Date.

### Architecture constraints that bind this story

- **`projectFor` is the only door:** `projectFor(state, playerId): PlayerView` is the single path from `MatchState` to anything a client sees; clients receive `PlayerView`, never `MatchState`. Serializing full `MatchState` to a client is described as "the one unforgivable sin in this codebase." [Source: planning-artifacts/architecture.md — Hidden-info boundary, "Projection is the only door"]
- **File placement:** `packages/engine/src/projection/projectFor.ts` + co-located `projectFor.test.ts`; the test "MUST assert hidden info absent, trump marker rules." `PlayerView` lives in `types.ts`. [Source: architecture.md#Complete-Project-Directory-Structure]
- **Hidden-information enforcement is structural** (allow-list, not deny-list): the projection lists what may leave; it never starts from full state and removes fields. [Source: architecture.md — "Hidden-information enforcement is structural"]
- **Engine purity & deep-readonly:** same boundary as every prior engine story. [Source: architecture.md#Architectural-Boundaries]
- **Naming:** `PlayerView`, `projectFor`, `chooser`, `pot`, `superTrump` — PRD vocabulary; PascalCase types, camelCase files. [Source: architecture.md#Naming-Patterns]

### Previous story intelligence (1.1–1.7 — all done & merged)

- **`MatchState` (current, deep-readonly):** `players`, `playerStacks` (`Record<PlayerId, readonly Card[]>`, index 0 = top), `pot: readonly Card[]`, `superTrumpCardId: string`, `chooser: PlayerId`, `roundsPlayed: number`, `statDefinitions`, `lastRound: RoundOutcome | null`, `result: MatchResult | null`. Project FROM this; expose only the allow-listed slice.
- **`RoundOutcome`** = `{ stat, playedCards (keyed by real PlayerId), winner: PlayerId | null }` — already a public, post-play reveal. Safe to pass through as `lastRound` (those cards were played openly, FR12). `winner === null` = a tie.
- **`MatchResult`** = `{ winner: PlayerId; reason: EndReason }` — public once the match ends; include it so the client can show the result (epic 2 reads it).
- **`superTrumpCardId` is the secret** the whole story protects (FR19/NFR2). It must never appear in a `PlayerView` — only the per-viewer boolean. The exception is your own top card legitimately carrying that id (you may see your own card).
- **Stack convention:** index 0 = top. `yourTopCard = stack[0] ?? null`.
- **Test idioms:** hand-built `MatchState` works (the projection only reads); `createMatch(onePieceDeck, [ALICE, BOB], mulberry32(seed))` gives a realistic state. `structuredClone` for purity. The NFR2 test leans on `JSON.stringify(view)` + `not.toContain(secretId)` — a blunt but decisive wire-safety check.
- **Barrel** currently type-exports `Card, Deck, StatKey, StatDefinition, MatchState, PlayerId, Command, SelectStatCommand, CommandResult, CommandErrorCode, RoundOutcome, EndReason, MatchResult`; values `onePieceDeck, createMatch, mulberry32, defaultRng, applyCommand`. Add `PlayerView` (type) and `projectFor` (value).
- **Review-cycle norm:** one review-fix commit per story (type-tightening, explicit construction). Build the view by explicitly listing fields from line one — an accidental `...state` spread would be the NFR2 failure this whole story exists to prevent.

### Git intelligence

- Rhythm: branch `story/1.8` → implement by hand → AI writes tests → green → commit → push → PR → code-review → fix → merge → artifacts commit. This merge closes Epic 1.
- `main` after 1.7: 99 tests, strict typecheck, Prettier clean.

### Technical notes

- TS 6 / Vitest 4 / Node 24; no new packages.
- The NFR2 serialization test is the most important one in the story — it is the structural guarantee that a careless future change can't leak hidden info. Make it strict: assert the trump id AND the opponent's card ids are absent from the JSON.

### Project Structure Notes

- New: `src/projection/projectFor.ts`, `src/projection/projectFor.test.ts`. Extended: `src/types.ts` (`PlayerView`), `src/index.ts` (export `PlayerView` + `projectFor`). No change to `MatchState` or any `match/` file — projection is a read-only derivation. New `projection/` directory matches the architecture tree exactly.

### References

- [Source: planning-artifacts/epics.md#Story-1.8] — story statement + ACs (verbatim)
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md] — FR4 (server authoritative, client never sees forbidden info), FR19 (Super Trump holder-only marker), FR30 (what the view surfaces), FR12 (reveal of played cards), NFR2 (hidden-information integrity)
- [Source: planning-artifacts/architecture.md] — "Projection is the only door"; `projection/projectFor.ts` + test placement; structural hidden-info enforcement; `PlayerView` in `types.ts`
- [Source: implementation-artifacts/1-5-the-super-trump-and-its-counter.md] — `superTrumpCardId` semantics; the marker is per-holder
- [Source: implementation-artifacts/1-7-match-end-every-way-a-game-can-finish.md] — `MatchResult`/`result` shape now in state

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted)

### Debug Log References

### Completion Notes List
Agreed with suggestions from 1a-1e

- 1d: unknown viewer → explicit `throw new Error('Unknown viewer: ...')` guard at the top of `projectFor` (programmer error, per architecture).
- Tests (AI-written): `projectFor.test.ts` — own-view, FR19 marker (holder-only), the NFR2 `JSON.stringify` wire-safety check (trump id + opponent ids + own deeper cards all absent), empty stack, unknown-viewer throw, purity. 109 tests green, typecheck clean, formatted.

### File List

- `packages/engine/src/types.ts` (`PlayerView` type)
- `packages/engine/src/index.ts` (export `PlayerView` type + `projectFor` value)
- `packages/engine/src/projection/projectFor.ts` (the projection — allow-list, NFR2 door)
- `packages/engine/src/projection/projectFor.test.ts` (projection test suite)
