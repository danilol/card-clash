# Story 1.5: The Super Trump and its Counter

Status: in-progress

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills Dev Agent Record (Completion Notes, File List) at completion.
     Do NOT run bmad-dev-story as designed on this story. -->

## Story

As a player,
I want the Super Trump to dominate any round except against Buggy,
so that the signature mechanic works exactly as the rules say.

## Acceptance Criteria

1. **Given** the Super Trump is played in a round, **when** the round resolves, **then** its holder wins regardless of the stat values (FR17) — including a round whose stat values are equal (a would-be tie). The winner takes both cards to stack bottom in 1.4's order (FR14) and becomes the next chooser (FR15).
2. **Given** the Super Trump and Buggy (the fixed Counter card) are played in the **same** round, **when** the round resolves, **then** Buggy's holder wins instantly (FR18), regardless of who is chooser, which stat was chosen, or the values.
3. The 1.4 contract is unchanged: legality checks still run first (non-chooser → `NOT_CHOOSER`, unknown stat → `INVALID_STAT`, state untouched, no throw for rule violations), the winner still takes both cards and becomes chooser, `roundsPlayed` still increments, and `lastRound` still records the outcome (stat, both played cards, winner).

## Tasks / Subtasks

- [ ] Task 1: Decide how the Super Trump identity reaches round resolution (AC: 1, 2) ⚠️ BLOCKING: decide before writing code
  - [x] The problem: the Super Trump is **per-match data** — it lives in `state.superTrumpCardId` (set by `createMatch` in 1.3). It is NOT a property of a card. Buggy is the opposite: the Counter is a **card property** (`counterCard?: true`, already on `buggy-the-clown` in the deck). Today `round.ts`'s `compareCards(...)` only sees the two cards and the stat — it has no way to know which card is this match's Super Trump.
  - [x] Option A (recommended): extend the round-resolution function in `round.ts` to take `superTrumpCardId` as a parameter. `applyCommand` already holds `state.superTrumpCardId`, so it just passes it down. Benefit: `applyCommand(state, command)` stays as-is, `round.ts` stays a small pure function over (cards + match facts), and it is trivially unit-testable.
  - [ ] Option B: pass the whole `MatchState` into `round.ts`. Rejected unless you argue otherwise — it widens the pure comparison function's surface and couples it to the full state shape. The function only needs the two cards, the stat direction, and the trump id.
  - [x] Record your choice and reason in Completion Notes.
- [x] Task 2: Implement the resolution order in `packages/engine/src/match/round.ts` (AC: 1, 2)
  - [x] Detect two facts for the round: **trump played** = either played card's `id === superTrumpCardId`; **counter played** = either played card's `counterCard === true`.
  - [x] Apply the rules in this fixed order, and STOP at the first match:
    1. **trump played AND counter played** → the **Counter holder** wins (FR18). Buggy beats the Super Trump.
    2. **trump played** (and not the above) → the **trump holder** wins (FR17), regardless of stat values.
    3. **neither** → the existing 1.4 stat comparison (Age low-wins, etc.), which may still tie.
  - [x] Map the winning **card** back to a `PlayerId` for `RoundOutcome.winner`: the function knows which card each player played, so the trump/counter holder's id is known. Keep `winner` a real `PlayerId` (the 1.4 review fix — never the `'chooser'`/`'opponent'` tokens).
  - [x] No hardcoding by name. Do NOT write `if (card.id === 'buggy-the-clown')`. Read the `counterCard` flag — same theme-seam lesson as "don't special-case Age by name" in 1.4. The Super Trump, by contrast, is correctly identified by id, because it IS per-match id data (not a theme constant).
  - [x] Why here: the architecture places FR17–19 trump logic in `round.ts` (`round.ts # FR11–16 comparison … FR17–19 trump`). Keep it out of `applyCommand.ts`.
- [ ] Task 3: Wire it through `packages/engine/src/match/applyCommand.ts` (AC: 1, 2, 3)
  - [x] Pass `state.superTrumpCardId` into the round-resolution call. Nothing else in `applyCommand` changes: the transfer (winner takes both cards at the bottom, `[own, opponent]`), the turn pass (`chooser = winner`), `roundsPlayed + 1`, and `lastRound` all stay exactly as 1.4 built them. A Super Trump round is always **decided**, so the winner simply takes both cards like any decided round.
  - [x] ⚠️ Ordering interaction with the 1.6 tie placeholder: the trump/counter rules MUST be evaluated **before** the tie throw. FR17 says the Super Trump wins "including tie-breaker rounds" — so a round with equal stat values AND a trump in play is a **trump win**, not a throw. Only a tie with **no** trump involved still hits the `throw new Error('tie resolution lands in story 1.6')` placeholder. Convince yourself the order in your code guarantees this.
- [x] Task 4: Tests — extended `packages/engine/src/match/applyCommand.test.ts` (AC: all) — test files are the working-agreement exemption; AI-written
  - [x] Trump auto-win (FR17): the trump holder plays a card that would **lose** on the chosen stat → trump holder still wins. Both arrangements covered (chooser holds the trump; opponent holds the trump).
  - [x] Trump wins a would-be tie (FR17, the key edge): equal `bounty` (LAW vs KID) AND one card is the Super Trump → trump holder wins and **no throw** happens. Both arrangements.
  - [x] Counter beats trump (FR18): Super Trump + Buggy are the two played cards → **Buggy's holder** wins. Both arrangements.
  - [x] Counter is inert without the trump: Buggy (haki 10) loses to LUFFY (haki 92) when no trump is in play → `counterCard` does nothing.
  - [x] Transfer + turn pass on a trump win: winner's bottom two are `[own, opponent]`, loser shrank by one, `chooser` becomes the winner, `roundsPlayed` +1, 32-card multiset conserved.
  - [x] Legality still wins first: a non-chooser command returns `NOT_CHOOSER` with an unchanged state even when a Super Trump is the top card.
  - [x] Purity: input state deep-equal unchanged after a trump win.
- [ ] Task 5: Prove the loop (AC: all)
  - [x] `npm test` — 86 passed (76 prior + 10 new). 
  - [x] `npm run typecheck` — strict-clean.
  - [x] `npm run format`.
  - [ ] Commit on `story/1.5`, push, open PR, run code-review per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews against this file + architecture.md — never paste-ready implementation code. **Exemptions: test files (Task 4) may be AI-written; AI fills the Dev Agent Record at completion.** [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]

### Scope guard

- This story is **the two Super Trump win rules only** (FR17, FR18). NOT here:
  - Tie → pot mechanics (FR20–23) — story 1.6. A tie with **no** trump involved still hits the 1.6 throw placeholder from 1.4. Do not build the pot here.
  - Match end / elimination / round cap (FR24–25) — story 1.7.
  - Projection and the **FR19 holder-only Super Trump marker** — story 1.8. FR19 is about who is *allowed to see* the trump's identity; it is a projection concern, NOT a win-logic concern. In 1.5 you only make the trump **win**. Do not add any "marker" field or visibility logic.
  - zod validation / socket protocol — 2.x. The engine trusts payload SHAPE; it enforces game LEGALITY.
- `applyCommand` still needs no `Rng`. No new dependencies.

### Architecture constraints that bind this story

- **Trump logic lives in `round.ts`:** `round.ts # FR11–16 comparison incl. Age low-wins, FR17–19 trump`. [Source: planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- **Functional core (hard rule):** `applyCommand(state, command) → CommandResult`; the engine never throws for rule violations — throws are reserved for programmer error (the 1.6 tie placeholder is the only sanctioned throw until 1.6 ships). [Source: planning-artifacts/architecture.md#Communication-State-Patterns]
- **Engine purity:** no Node APIs, no I/O, no `Math.random`, no Date. [Source: planning-artifacts/architecture.md#Architectural-Boundaries]
- **Naming contract:** `superTrump`, `counter`, `chooser`, `stat`, `stack`, `pot` — PRD vocabulary, one concept = one name. [Source: planning-artifacts/architecture.md#Naming-Patterns]
- **Hidden info:** the engine may hold the trump id in state, but 1.5 must not surface it anywhere new — visibility is enforced in 1.8 (NFR2/FR19). [Source: planning-artifacts/prd.md FR19, NFR2]

### Previous story intelligence (1.4 — done 2026-06-21, review fixes in 113b6a0)

- **Current round-resolution shape:** `compareCards(chooserId, chooserCard, opponentId, opponentCard, stat: StatDefinition): RoundOutcome` in `round.ts`, with a private `compareStats(chooserStat, opponentStat, direction): ComparisonResult`. Task 1 here extends this with the trump id.
- **`RoundOutcome`** = `{ stat: StatKey; playedCards: PlayerStacks; winner: PlayerId | null }`. `winner` is a real `PlayerId` (or `null` only for a no-trump tie). `playedCards` is keyed by the real player ids — keep both invariants.
- **The tie throw** (`throw new Error('tie resolution lands in story 1.6')`) lives in `applyCommand` and fires only on `winner === null`. Your trump rules must resolve a winner before this point so a trump never reaches the throw.
- **`Command = SelectStatCommand`** (1.4 review fix); `applyCommand(state, command: Command)`. Do not reintroduce the `'start'|'end'` string members.
- **`pot` is threaded** (`pot: state.pot`, 1.4 review fix) — leave it; the pot stays empty until 1.6.
- **Stack convention:** index 0 = top; bottom = end of array; "place at bottom" = append. Winner gets `[own played, opponent played]` appended.
- **Deep readonly is the standard:** copy on transition; the compiler fighting you is the design working.
- **ESM `.js` extensions on ALL relative imports.** **Prettier** (singleQuote) before commit.
- Barrel (`index.ts`) currently value-exports `applyCommand`, `createMatch`, `mulberry32`, `defaultRng`; type-exports `Card`, `Deck`, `StatKey`, `StatDefinition`, `MatchState`, `PlayerId`, `Command`, `SelectStatCommand`, `CommandResult`, `CommandErrorCode`, `RoundOutcome`. 1.5 likely needs no new public exports (the win rules are internal to round resolution) — confirm before adding any.

### Deck facts you will use in tests

- Buggy: `id: 'buggy-the-clown'`, `counterCard: true`. It is excluded from the Super Trump draw (FR9), so `superTrumpCardId` is never Buggy's id.
- Cards that share a stat value (handy for the would-be-tie + trump test): `trafalgar-d-water-law`, `eustass-kid`, `monkey-d-luffy`, `kuzan-aokiji` all have `bounty 3_000_000_000`.
- Hand-build `MatchState` values in tests with a chosen `superTrumpCardId` and known top cards (the plain-value payoff from 1.3/1.4).

### Git intelligence

- Proven rhythm: branch (`story/1.5`) → implement by hand → AI writes tests → green → commit → push → PR → code-review → fix findings (one review-fix commit is normal) → merge → artifacts commit.
- `main` after 1.4 merge: 76 tests, strict typecheck, Prettier clean.

### Technical notes

- TS 6 / Vitest 4 / Node 24 proven in-repo; no version research; no new packages.
- `structuredClone(state)` before a call + `expect(state).toEqual(clone)` after is the purity idiom (Node 24 global).
- Discriminated-union narrowing on `CommandResult` (`if (!result.ok) ...`) should be second nature by now.

### Project Structure Notes

- Touched: `src/match/round.ts` (the win rules), `src/match/applyCommand.ts` (pass `superTrumpCardId` through). New/extended tests under `src/match/`. Likely no change to `types.ts` (the existing `superTrumpCardId`, `counterCard`, and `RoundOutcome` already cover it) — but if you add an internal helper type, keep it module-local (recall the 1.4 review nit about `ComparisonResult` living in `types.ts`).

### References

- [Source: planning-artifacts/epics.md#Story-1.5] — story statement + ACs (verbatim)
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md] — FR17 (Super Trump auto-win incl. tie-breakers), FR18 (Buggy beats Super Trump), FR19 (holder-only marker — note: 1.8, not here), FR9 (draw excludes Buggy)
- [Source: planning-artifacts/architecture.md#Complete-Project-Directory-Structure] — `round.ts` owns FR17–19 trump logic
- [Source: planning-artifacts/architecture.md#Communication-State-Patterns] — functional core, no-throw rule
- [Source: implementation-artifacts/1-4-round-resolution-compare-transfer-pass-the-turn.md] — round-resolution baseline, RoundOutcome shape, tie placeholder, deep-readonly, stack convention

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted)

### Debug Log References

### Completion Notes List
- The super trump identity reaches round resolution through the `superTrumpCardId` parameter passed to the `compareCards` function in `round.ts`.
- Task 1 decision: Option A — `compareCards` takes `superTrumpCardId`; `applyCommand` passes `state.superTrumpCardId` down. Keeps `applyCommand(state, command)` and a small pure `round.ts`.
- Resolution order in `round.ts`: trump-played short-circuits the stat comparison; `superTrumpResolution` reads the `counterCard` flag for FR18, then `resolveWinnerId` maps the relative winner to a real `PlayerId`. The trump branch runs before the tie throw in `applyCommand`, so a trump wins a would-be tie without throwing. No card name hardcoded.
- Task 4 (AI-written tests): extended `applyCommand.test.ts` with 10 tests — FR17 (auto-win incl. would-be tie, both arrangements), FR18 (counter beats trump, both arrangements; counter inert without trump), and the unchanged 1.4 contract (transfer, turn pass, legality-first with a trump on top, purity). Hardened `makeState`: its Super Trump now defaults to a sentinel id (`__no-super-trump__`) so the 1.4 stat-comparison tests genuinely exercise the stat path instead of the trump branch.
- Loop: `npm test` 86 passed, `npm run typecheck` clean, `npm run format` applied (also collapsed a stray double blank line in `applyCommand.ts`/`round.ts`). Commit/PR/review pending.

### File List

- `packages/engine/src/match/round.ts` (modified — FR17/FR18 trump + counter resolution)
- `packages/engine/src/match/applyCommand.ts` (modified — passes `superTrumpCardId` into resolution)
- `packages/engine/src/match/applyCommand.test.ts` (modified — Super Trump / Counter test suite + `makeState` trump knob)

## Review Findings

_Code review 2026-06-21 (3 parallel layers). Acceptance Auditor found **no spec violations** — AC1 (FR17 auto-win incl. would-be tie, no 1.6 throw), AC2 (FR18 Buggy beats trump, both arrangements), AC3 (1.4 contract intact), and every constraint (trump logic in `round.ts`, no-throw core, purity, counter read via flag not name, naming, deep-readonly, `.js` imports, no new deps, scope) are satisfied. 86 tests green, typecheck clean. Only two low-severity cleanups._

### Patches

- [ ] [Review][Patch][Low] Tighten the winner-token types in `round.ts` — `superTrumpResolution(): string | null` and `resolveWinnerId(comparisonWinner: string | null, …)` traffic in bare `string`. A typo like `'choser'` would compile and silently fall through to `null` (no winner). Use the existing literal union: `superTrumpResolution` returns `'chooser' | 'opponent' | null`, and `resolveWinnerId` takes `ComparisonResult | null` (`ComparisonResult` is already defined and used by `compareStats`). Restores the compiler safety the 1.4 code had.
- [ ] [Review][Patch][Low] Make `superTrumpResolution`'s two branches mutually exclusive — the second `if (isSuperTrump(opponentCard…))` is independent of the first, so if both played cards ever matched `superTrumpCardId` the chooser branch's result would be silently overwritten. Cannot happen with unique ids + Buggy excluded from the draw (FR9), so it is defensive only. Use `else if` to make the intent explicit and guarantee the result is assigned exactly once.

### Dismissed (noise / by-design / unreachable)

- Counter keyed off the `counterCard` flag rather than Buggy's id — **by design and spec-required** (no name hardcoding; theme seam).
- Trump card being Buggy / the trump also carrying `counterCard` — impossible: FR9 excludes Buggy from the Super Trump draw.
- "No trump in play" encoded as a non-matching id — a real match always has a Super Trump (`createMatch` always sets one); only a test sentinel concern.
- `superTrumpResolution` returning `null` while a trump is in play — structurally impossible today (same predicate gates entry); the `else if` patch above also closes this.
- A hypothetical second `counterCard:true` deck card — only Buggy carries the flag; future-deck speculation.
