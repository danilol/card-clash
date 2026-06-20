# Story 1.4: Round resolution — compare, transfer, pass the turn

Status: in-progress

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills Dev Agent Record (Completion Notes, File List) at completion.
     Do NOT run bmad-dev-story as designed on this story. -->

## Story

As a player,
I want my chosen stat compared correctly and cards transferred to the winner,
so that basic rounds work.

## Acceptance Criteria

1. **Given** a match in progress, **when** the chooser submits `selectStat` via `applyCommand`, **then** the higher value wins — except Age, where the lower value wins (FR13) — and the winner takes both cards to stack bottom in deterministic order (FR14) and becomes next chooser (FR15).
2. **Given** a command from the non-chooser, or an invalid stat, **when** applied, **then** the result is `{ok: false, error}` with a stable error code and state is unchanged (no throws for rule violations).
3. The round outcome is recorded in state (this feeds `lastRound` in story 1.8).

## Tasks / Subtasks

- [x] Task 1: Make the deferred 1.3 decision — where do stat directions come from? (AC: 1) ⚠️ BLOCKING: decide this before writing any code
  - [x] The problem: Age is "low wins". That fact lives in `StatDefinition.direction`. But the signature is `applyCommand(state, command)` — there is no deck parameter. So the function needs another way to reach the directions.
  - [x] Option A (recommended): `MatchState` carries the stat definitions. `createMatch` copies `deck.stats` into a new readonly field (for example `statDefinitions: readonly StatDefinition[]`). Cost: a small change to `MatchState` and `setup.ts` + its test fixture. Benefit: the state is self-contained, `applyCommand` stays `(state, command)`, and the theme seam survives — a future deck just flows through setup.
  - [ ] Option B: `applyCommand` imports `onePieceDeck` directly. Rejected by the architecture unless you argue otherwise: it hard-wires the engine to one theme and breaks the deck-behind-interface seam.
  - [ ] Option C: change the signature to `applyCommand(state, command, deck)`. Works, but deviates from the architecture and the epics AC. If you prefer this, the architecture document must be amended FIRST (it is the source of truth).
  - [x] Record your choice and reason in Completion Notes. If Option A: also update `createMatch` and re-run the 1.3 tests — the determinism test (`toEqual`) will catch the new field automatically.
- [x] Task 2: Extend `packages/engine/src/types.ts` with the command types (AC: 1, 2, 3)
  - [x] `SelectStatCommand` — the first command. Suggested shape: `{ type: 'selectStat'; playerId: PlayerId; stat: StatKey }`. The `type` field is the discriminant: every later command (1.5+, rematch in 2.x) joins a `Command` union on it. Define `Command` now even if it has one member — `applyCommand` takes `Command`, not `SelectStatCommand`.
  - [x] `CommandResult` — the discriminated union from the architecture: success carries the next state, failure carries an error. Decision to make: the error shape. The format pattern for server errors is `{ code, message }` with stable machine codes. Aligning the engine error to the same shape (`{ ok: false; error: { code: CommandErrorCode; message: string } }`) means 2.x can pass it straight through. Decide and record.
  - [x] `CommandErrorCode` — a string-literal union, NOT free strings. This story needs two codes: one for "you are not the chooser" (suggested: `NOT_CHOOSER`) and one for "that stat does not exist" (`INVALID_STAT` — this exact code appears in the architecture). Stable means: tests and the client can match on them forever.
  - [x] `RoundOutcome` — what AC 3 records. Minimal fields that 1.8's reveal needs: the chosen stat, both played cards (who played what), and the winner. Suggested: `{ stat: StatKey; playedCards: PlayerStacks-style readonly record; winner: PlayerId }`. 1.6 will extend it with pot info — do not pre-build that.
  - [x] Extend `MatchState`: add `lastRound: RoundOutcome | null` (null before the first round) — plus `statDefinitions` if Task 1 chose Option A. Every new field `readonly`, deep-readonly like the 1.3 review taught (field AND contents).
  - [x] ⚠️ A note on `| null` here vs the 1.3 review: `chooser` dropped its `null` because setup always assigns it. `lastRound` is different — "no round played yet" is a real state the type must express. Be ready to defend the difference.
- [x] Task 3: Implement the comparison in `packages/engine/src/match/round.ts` (AC: 1)
  - [x] One small pure function. Suggested shape: take the two played cards, the chosen stat, and its direction; return who won — or a tie. A 3-way result type (for example `'chooser' | 'opponent' | 'tie'`) keeps it honest: ties exist in this deck (three cards share Bounty 3,000,000,000; Roger and Shanks share Haki 100).
  - [x] Direction rule: `direction: 'high'` → bigger value wins. `direction: 'low'` (Age only) → smaller value wins. No special-casing "age" by name — read the direction from the `StatDefinition`. A hardcoded `if (stat === 'age')` is a review finding: the theme seam means a future deck decides its own directions.
  - [x] Why its own file: the architecture tree places round logic in `match/round.ts`. 1.5 (trump) extends this file's logic; keeping it out of `applyCommand.ts` keeps the transition function readable.
- [x] Task 4: Implement `applyCommand` in `packages/engine/src/match/applyCommand.ts` (AC: all)
  - [x] Signature: `applyCommand(state: MatchState, command: Command): CommandResult`. Pure: no mutation of `state` or `command`, no I/O, no randomness (this function needs no Rng — note: nothing random happens in a round).
  - [x] Legality checks first, in a fixed order, each returning `{ok: false, error}` with its stable code: (1) `command.playerId !== state.chooser` → not-chooser error. (2) `command.stat` is not one of the deck's stat keys → invalid-stat error. On ANY error: return the ORIGINAL state untouched — the caller keeps using it.
  - [x] Resolve the round: both players' top cards are at index 0 (the documented stack convention from 1.3). Compare with the Task 3 function.
  - [x] Winner case — build the next state with copies (the deep-readonly types force this; that is the point): winner's new stack = rest of their stack + their own played card + the loser's played card, appended at the BOTTOM (end of array) in exactly that order (FR14: own card first, then opponent's; pot cards come in 1.6). Loser's new stack = their stack minus the top card. `chooser` = winner (FR15). `roundsPlayed` + 1. `lastRound` = the new `RoundOutcome`.
  - [x] ⚠️ Tie case — scope decision, decide consciously: ties are story 1.6 (pot mechanics). Recommended for 1.4: an explicit loud placeholder — `throw new Error('tie resolution lands in story 1.6')`. The architecture reserves throws for programmer error, and "we shipped 1.4 without 1.6 and hit a tie" is exactly that. The alternative (a `TIE_NOT_IMPLEMENTED` error result) abuses the error channel: a tie is a legal play, not an illegal command. Pick one, record it. Tests will avoid tie pairs until 1.6.
  - [x] What does winning the round MEAN for the cards' owner? Nothing in 1.4 beyond the transfer — no win/end detection (a player reaching 0 cards is story 1.7's business; in 1.4 it cannot happen anyway, a round moves cards between stacks but the loser only loses their top card after... think it through: loser had N cards, now has N−1; at N=1 they hit 0 — but match end is 1.7. The state simply records it; nothing explodes. Tests stay away from end states).
- [x] Task 5: Export the new surface from the barrel `packages/engine/src/index.ts` (AC: all)
  - [x] `export type` for `Command`, `SelectStatCommand`, `CommandResult`, `CommandErrorCode`, `RoundOutcome` (verbatimModuleSyntax: types and values export separately). Value export for `applyCommand`.
  - [x] `.js` extensions on every relative import — bit 1.2 twice; write it correctly from line one.
- [ ] Task 6: Tests `packages/engine/src/match/applyCommand.test.ts` (AC: all) — test files are the working-agreement exemption; AI may write these
  - [ ] Fixture: build states with `createMatch(onePieceDeck, players, mulberry32(seed))`. For controlled comparisons, tests may also hand-build a minimal `MatchState` value with known top cards (it is a plain object — that is the payoff of AC 4 in 1.3).
  - [ ] High-wins (FR13): chooser's top card has the higher value on the chosen stat → chooser wins; also the mirror case (opponent wins).
  - [ ] Age low-wins (FR13): on `age`, the LOWER value wins — both directions.
  - [ ] Transfer (FR14): winner's stack grew by 2 at the bottom, in order [own card, opponent's card]; loser's stack shrank by 1 from the top; the 32-card multiset is conserved.
  - [ ] Turn passing (FR15): `chooser` after the round === the round winner; `roundsPlayed` incremented by exactly 1.
  - [ ] Outcome recording (AC 3): `lastRound` carries the chosen stat, both played cards, and the winner.
  - [ ] Legality (AC 2): non-chooser command → `{ok: false}`, stable code, returned/original state deep-equal unchanged; invalid stat string (cast through `as` to simulate a runtime-bad value) → same guarantees.
  - [ ] Purity: input state deep-equal unchanged after a successful command (compare against a structuredClone taken before); result state survives JSON round-trip (still a plain value).
  - [ ] No tie-pair tests — ties land in 1.6 (the placeholder from Task 4 is intentionally untested or asserted-to-throw, per your Task 4 decision).
- [ ] Task 7: Prove the loop (AC: all)
  - [ ] `npm test` — new suite green alongside the 61 existing tests; 1.3's setup tests still green (they catch the Task 1 state-shape change)
  - [ ] `npm run typecheck` — strict-clean
  - [ ] `npm run format` (or format-on-save)
  - [ ] Commit on `story/1.4`, push, open PR, run code-review per process

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews against this file + architecture.md — never paste-ready implementation code. **Exemptions: test files (Task 6) may be AI-written; AI fills the Dev Agent Record at completion.** [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]

### Scope guard

- This story is **decided rounds only**. NOT here: Super Trump / counter-card logic (1.5), tie→pot mechanics (1.6 — only the loud placeholder branch), match end / elimination / round cap (1.7), projection (1.8), zod validation and the socket protocol (2.x — the engine trusts payload SHAPE; it enforces game LEGALITY).
- The two legality checks in Task 4 are NOT "input validation" (which the engine skips by design). They are game rules: FR15 says only the chooser acts; FR11 says the stat must be one of the 8. That is why they get error results, not trust.
- `applyCommand` needs no Rng. Do not add one "for later".
- No new dependencies. zod stays declared-but-unused until 2.2.

### Architecture constraints that bind this story

- **Functional core (hard rule):** `applyCommand(state, command) → CommandResult`, a discriminated union; the engine never throws for rule violations — throws are reserved for programmer error. [Source: planning-artifacts/architecture.md#Communication-State-Patterns]
- **Engine purity:** no Node APIs, no I/O, no `Math.random`, no Date. Same boundary as 1.3. [Source: planning-artifacts/architecture.md#Architectural-Boundaries]
- **Stable error codes:** machine codes like `INVALID_STAT` are part of the contract; the error format downstream is `{ code, message }`. [Source: planning-artifacts/architecture.md#Format-Patterns]
- **Naming contract:** `match`, `stat`, `stack`, `pot`, `superTrump`, `chooser` — PRD vocabulary, one concept = one name. Files camelCase; types PascalCase, no `I` prefix. [Source: planning-artifacts/architecture.md#Naming-Patterns]
- **File placement:** `applyCommand.ts` and `round.ts` in `src/match/`, tests co-located. [Source: planning-artifacts/architecture.md#Complete-Project-Directory-Structure]

### Previous story intelligence (1.3 — done 2026-06-12, review fixes in 61a2eb2)

- **Deep readonly is the standard now** (1.3's HIGH review finding): `readonly` on the field AND on the array/record contents. `MatchState` is fully immutable at the type level — your transitions in this story MUST copy. If the compiler fights you, that is the design working.
- **Stack convention (documented in types.ts): index 0 = top of the stack.** Bottom = end of array. FR14's "place at bottom" = append.
- **`PlayerStacks`** (plural) is the type name for the whole record. Update stacks immutably: spread the record, replace both players' entries.
- **Computed keys lesson:** `{ [playerId]: cards }` with brackets, not `{ playerId: cards }` — the literal-key bug cost a debugging round in 1.3.
- **`chooser` is non-null** (tightened in review). `lastRound` introduces a deliberate null — see Task 2's note for why this one is different.
- **Naming gets reviewed for honesty:** 1.3 had three renames (`cardsWithoutTrump`→`cardsWithoutCounterCard`, `randomDeckIndex`→`randomIndex`, `PlayerStack`→`PlayerStacks`). Name things for what they ARE.
- **ESM `.js` extensions on ALL relative imports** — standing rule since 1.2.
- **Prettier configured** (singleQuote); format before committing kills the whitespace-nit review class.
- Barrel currently exports: types `Card`, `Deck`, `StatKey`, `StatDefinition`, `MatchState`, `PlayerId`, `Rng`; values `onePieceDeck`, `createMatch`, `mulberry32`, `defaultRng`.
- **Deferred from 1.3, lands HERE:** the stat-definitions decision (Task 1). It was consciously punted to this story — it is the first thing to settle.
- Deferred-work.md carries: `Deck` type reachable via two import routes (accepted 1.2/1.3 variance — do not "fix" it in passing).

### Git intelligence

- Rhythm that works: branch → implement → AI writes tests → green → commit → push → PR → code-review → fix findings (one review-fix commit is normal, 3 stories in a row had one) → merge → artifacts commit.
- `main` after 1.3 merge: 61 tests, strict typecheck, Prettier formatting.

### Technical notes

- TS 6 / Vitest 4 / Node 24 proven in-repo; no version research needed; no new packages permitted.
- Useful test idiom for AC 2's "state unchanged": `structuredClone(state)` before the call, `expect(state).toEqual(clone)` after. Node 24 has `structuredClone` globally.
- Discriminated unions are THE TypeScript pattern this story practices (interview-relevant): `Command` discriminated on `type`, `CommandResult` discriminated on `ok`. Narrowing via `if (!result.ok)` should feel natural by the end.

### Project Structure Notes

- New files: `src/match/applyCommand.ts`, `src/match/round.ts`, `src/match/applyCommand.test.ts` (and optionally `round.test.ts` co-located). Extended: `src/types.ts`, `src/index.ts`, and (if Task 1 = Option A) `src/match/setup.ts` + its test.
- Aligns with the architecture tree exactly; no variances introduced. Known carried variance: `Deck` interface lives in `deck/deck.ts`, re-exported from `types.ts` (recorded in 1.2).

### References

- [Source: planning-artifacts/epics.md#Story-1.4] — story statement + ACs (verbatim)
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md] — FR13 (compare, Age low-wins), FR14 (transfer, deterministic order), FR15 (winner chooses next), FR11 (stat selection)
- [Source: planning-artifacts/architecture.md#Communication-State-Patterns] — functional core, CommandResult union, no-throw rule
- [Source: planning-artifacts/architecture.md#Format-Patterns] — stable error codes, error shape
- [Source: implementation-artifacts/1-3-match-setup-shuffle-deal-and-the-will-of-d.md#Completion-Notes-List] — deep-readonly decision, stack convention, deferred stat-definitions decision

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted)

### Debug Log References

### Completion Notes List
- Decision: Option A (recommended): `MatchState` carries the stat definitions. `createMatch` copies `deck.stats` into a new readonly field (for example `statDefinitions: readonly StatDefinition[]`). Cost: a small change to `MatchState` and `setup.ts` + its test fixture. Benefit: the state is self-contained, `applyCommand` stays `(state, command)`, and the theme seam survives — a future deck just flows through setup.
- Task 4 tie decision logic will be implemented in story 1.6. For now we throw an error to indicate that this case is not implemented yet.

### File List

## Review Findings

_Code review 2026-06-19 (3 parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). AC1, AC2, AC3 and Task 1 (Option A) all verified satisfied; typecheck clean, 76 tests green._

### Decision needed

- [ ] [Review][Decision] `Command`/`SelectStatCommand` discriminant shape deviates from spec — `types.ts:47-53` declares `Command = 'selectStat' | 'start' | 'end'` (a union of strings) and `SelectStatCommand.type: Command`. Spec Task 2 wants `Command` to be a discriminated *union of command object types* (`Command = SelectStatCommand | …`) with `SelectStatCommand.type: 'selectStat'` (a single literal), and Task 4 wants `applyCommand(state, command: Command)`. As written, `command.type` carries `'start' | 'end'` on every command so it cannot discriminate; the invented `'start'/'end'` members are out of scope (scope guard: "decided rounds only"); and `applyCommand` never checks `command.type`, so a wrong-`type` object is processed as a stat selection. Decide: align to the spec shape, or justify the deviation in the architecture.

### Patches

- [ ] [Review][Patch] Dead commented-out tie-push lines + tie check ordered after the transfer blocks [applyCommand.ts:55-61] — remove the commented `chooserStack.push`/`opponentStack.push` lines; consider checking the tie/`winner === null` case before the win/lose branches so the intent reads top-down.
- [ ] [Review][Patch] `pot` is destructively reset instead of carried forward [applyCommand.ts:71] — `pot: []` discards `state.pot`. Harmless today (pot is always empty in 1.4) but use `pot: state.pot` so the field threads through until 1.6 defines real pot semantics.
- [ ] [Review][Patch] Duplicated `@param` JSDoc block in `fisherYatesShuffle` [setup.ts:60-63] — the `@param arr` / `@param rng` pair is repeated verbatim; delete the duplicate.

### Deferred

- [x] [Review][Defer] Tie throws a hard `Error`, and the shipped deck makes ties common in real play [applyCommand.ts:60] — deferred, accepted per Task 4 (tie→pot lands in 1.6). Note: duplicate stat values are frequent in `onePieceDeck` (bounty 0 ×3, bounty 3e9 ×4, etc.), so a full real match will hit the placeholder before 1.6 ships.
- [x] [Review][Defer] Unchecked `shift()!` / `find()!` non-null assertions can crash on a degenerate/empty-stack state; no end-of-match signal when a player reaches 0 cards [applyCommand.ts:28,34-35] — deferred, spec-acknowledged as story 1.7 scope (match end / elimination). In 1.4 the state simply records it.
