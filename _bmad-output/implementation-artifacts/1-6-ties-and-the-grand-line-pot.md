3# Story 1.6: Ties and the Grand Line pot

Status: done

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills Dev Agent Record (Completion Notes, File List) at completion.
     Do NOT run bmad-dev-story as designed on this story. -->

## Story

As a player,
I want ties to feed a pot claimed by the tie-breaker winner,
so that draws create drama instead of dead ends.

## Acceptance Criteria

1. **Given** equal values and **no** Super Trump rule applies, **when** the round resolves, **then** both played cards move to the central pot, the **same chooser keeps the turn**, and they pick a new stat from their next top card (FR20–21). No throw — a tie is now a legal `{ok:true}` outcome.
2. **Given** a decided round (won on stat **or** by Super Trump) with a non-empty pot, **when** it resolves, **then** the winner takes both played cards **plus the entire pot** to their stack bottom in a fixed deterministic order, and the pot becomes empty (FR21).
3. **Given** consecutive ties, **when** they chain, **then** the pot keeps accumulating and a later decided round sweeps the whole pot (FR22).
4. **Given** a tie where a player then has **no next card** to continue the tie-breaker, **when** the round resolves, **then** that player is eliminated and the opponent collects all cards in play including the pot (FR23). The resulting state has the opponent holding every card and an empty pot.
5. The earlier contracts are unchanged: Super Trump still auto-wins (FR17) and Buggy still beats it (FR18) — a trump round is decided, never a tie; legality still runs first (`NOT_CHOOSER`, `INVALID_STAT`, state untouched, no throw for rule violations); `lastRound` still records the round.

## Tasks / Subtasks

- [x] Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes
  - [x] **1a — Deterministic order when the winner sweeps the pot.** FR21 says "both played cards plus the entire pot … in deterministic order" but does not fix the order. Recommended: append to the winner's stack bottom as `[...pot, chooserPlayedCard, opponentPlayedCard]` — pot cards first (oldest tie cards, in the order they accumulated), then this round's chooser card, then the opponent card. This is chronological and consistent with 1.4's `[own, opponent]` pair ordering. Pick a rule and pin it in tests; any consistent order satisfies the AC, but it must be stable.
  - [x] **1b — Order cards enter the pot on a tie.** Recommended: append `chooserPlayedCard` then `opponentPlayedCard` (same pair order as 1.4). Combined with 1a this keeps the whole chain chronological.
  - [x] **1c — Does `roundsPlayed` increment on a tie?** It feeds FR25's "100 completed rounds" cap in story 1.7. Recommended: increment on **every** resolved `applyCommand` call (tie or decided) — simplest, and the cap is just a safety valve. If you prefer "decided rounds only," record that and 1.7 must read it the same way. Decide now so 1.7 inherits a clear meaning.
  - [x] **1d — FR23 scope boundary vs story 1.7.** 1.6 implements the FR23 **card movement** (a tie that cannot continue → opponent collects all cards in play + pot). It does NOT add an `ended`/`endReason` field — that and general end-detection (FR24 conquest, FR25 cap, FR25b end-pot sweep) are story 1.7. The state 1.6 produces (one player holds everything, the other holds zero) is exactly what 1.7 will detect as finished. Confirm you are NOT adding match-end fields here.
  - [x] **1e — The both-empty edge (open question).** If a tie makes BOTH players empty at once (each played their last card into the pot), neither can continue and FR23's "the opponent collects" has no opponent-with-cards. The FRs do not define this. Recommended for 1.6: leave it to 1.7 (it becomes a round-cap / sudden-death / draw concern, FR25), and keep tests away from it — OR define a conservative rule and record it. Decide and note; do not silently let it crash.
- [ ] Task 2: Replace the tie throw with pot accumulation in `applyCommand.ts` (AC: 1, 3)
  - [x] Today `if (roundOutcome.winner === null) throw new Error('tie resolution lands in story 1.6')`. Replace it: on a no-trump tie, build the next state with `pot = [...state.pot, chooserPlayedCard, opponentPlayedCard]` (per 1b), both stacks minus their top card, **`chooser` unchanged** (FR21 — the same chooser continues), `lastRound` recorded (winner stays `null` = tie), `roundsPlayed` per decision 1c. Return `{ ok: true, state }`.
  - [x] A tie is reached only when no Super Trump is in the round — the trump branch in `round.ts` always returns a real winner, so a trump round never enters this path. (Re-confirm with 1.5's logic.)
- [x] Task 3: Sweep the pot to the winner on a decided round (AC: 2, 3)
  - [x] Extend the existing decided-round transfer: the winner already gets `[own, opponent]` at the bottom; now also append the entire `state.pot`, in the order from decision 1a. Set the new state's `pot` to `[]`.
  - [x] This applies to **every** decided round — a stat win AND a Super Trump win. A trump played after a tie chain still sweeps the pot (FR21 says "the winner of that round"). The sweep lives in `applyCommand` after the winner is known, so it is uniform regardless of how the win was decided.
  - [x] Keep 1.4's order for the played pair and the loser losing only their top card. The 32-card multiset must stay conserved (stacks + pot always total the cards in play).
- [ ] Task 4: FR23 — elimination when a tie cannot continue (AC: 4)
  - [x] After a tie moves both top cards into the pot, check the stacks: if a player now has **no next card** (empty stack), the tie-breaker cannot proceed. That player is eliminated; the opponent collects **all cards in play** = the opponent's remaining stack + the entire pot (the just-played cards are already in the pot). Result state: opponent holds everything, `pot = []`.
  - [x] Decide the deterministic order the collected cards land in the opponent's stack (reuse the 1a rule: existing stack, then pot order). Pin it in a test.
  - [x] Do NOT set an `ended` flag (decision 1d) — the 0-card state is what 1.7 will read. Handle the both-empty case per decision 1e.
- [ ] Task 5: Tests — extend `packages/engine/src/match/applyCommand.test.ts` (AC: all) — AI-permitted
  - [ ] ⚠️ **Replace the existing 1.5 test** `applyCommand — ties are deferred to story 1.6` (it asserts the tie throws). A tie no longer throws — rewrite it to assert the pot outcome.
  - [ ] Tie → pot (FR20): no-trump equal values (e.g. LAW vs KID on `bounty`) → `ok:true`, `pot` now holds both played cards in the 1b order, both stacks lost their top card, `chooser` UNCHANGED, `lastRound.winner === null`, `roundsPlayed` per 1c. No throw.
  - [ ] Decided round sweeps the pot (FR21): start from a state with a non-empty `pot`, play a decided stat round → winner's stack bottom = pot + played cards in the 1a order; new `pot` is empty; multiset conserved.
  - [ ] Chain (FR22): two ties in a row grow the pot to four cards; a third, decided round sweeps all four + the two played → winner; pot empty.
  - [ ] Trump win sweeps the pot too: non-empty pot + a Super Trump played → trump holder wins and takes the pot.
  - [ ] FR23 elimination: a tie where one player holds only the one card they just played → after the tie they are empty → opponent collects all cards in play + pot; eliminated player has 0 cards, opponent holds the rest; pot empty; multiset conserved.
  - [ ] Unchanged contracts: a Super Trump round with an empty pot behaves exactly as 1.5; legality (`NOT_CHOOSER`/`INVALID_STAT`) still returns first with state untouched; purity (input unchanged, JSON round-trip).
- [ ] Task 6: Prove the loop (AC: all)
  - [ ] `npm test` — new/updated suite green; the replaced tie test no longer asserts a throw.
  - [ ] `npm run typecheck` — strict-clean.
  - [ ] `npm run format`.
  - [ ] Commit on `story/1.6`, push, open PR, run code-review per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews against this file + architecture.md — never paste-ready implementation code. **Exemptions: test files (Task 5) may be AI-written; AI fills the Dev Agent Record at completion.** [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]

### Scope guard

- This story is **tie → pot mechanics and the FR23 tie-cannot-continue elimination only**. NOT here:
  - General match end: conquest (FR24), the 100-round cap and sudden death (FR25), the end-state pot sweep / `endReason` field (FR25b, FR26) — all story 1.7. Do not add an `ended`/`endReason` field or a round cap.
  - Projection / hidden info (FR19 marker, NFR2) — story 1.8.
  - zod / socket protocol — 2.x.
- No new dependencies. `applyCommand` still needs no `Rng` (nothing random happens in a round). Engine stays a pure, no-throw (for rule violations) functional core.

### Architecture constraints that bind this story

- **Functional core:** `applyCommand(state, command) → CommandResult`; never throw for rule violations. After this story the tie throw is gone — there should be **no remaining throw** on any legal play path. [Source: planning-artifacts/architecture.md#Communication-State-Patterns]
- **Engine purity:** no Node APIs, no I/O, no `Math.random`, no Date. [Source: planning-artifacts/architecture.md#Architectural-Boundaries]
- **Naming contract:** `pot`, `chooser`, `stack`, `superTrump` — PRD vocabulary. [Source: planning-artifacts/architecture.md#Naming-Patterns]
- **Deep-readonly + immutability:** copy on transition; `pot` is `readonly Card[]`, so build a new array — never push into `state.pot`. [Source: 1.3 review]

### Previous story intelligence (1.4 / 1.5 — both done & merged)

- **Current resolution flow:** `applyCommand` → legality checks → `compareCards(chooserId, chooserCard, opponentId, opponentCard, superTrumpCardId, def)` in `round.ts` → `roundOutcome.winner` is a real `PlayerId` for a decided round, or `null` for a no-trump tie. `applyCommand` then does the transfer/turn-pass. The tie throw is the thing you are replacing.
- **`pot` is already in `MatchState`** (`readonly pot: readonly Card[]`) and is currently threaded unchanged (`pot: state.pot`). 1.6 finally gives it behavior. It is always `[]` coming out of `createMatch`.
- **Transfer convention (1.4):** winner's bottom gets `[ownPlayed, opponentPlayed]`; loser loses only the top card; index 0 = top, append = bottom. 1.6 adds the pot to this.
- **`RoundOutcome`** = `{ stat, playedCards (keyed by real PlayerId), winner: PlayerId | null }`. `winner === null` already means "tie". Recommended: keep it as-is — pot count lives in `state.pot`, not `RoundOutcome`. (1.8's reveal reads `state.pot` for the pot count, and `winner === null` to show a tie.) If you find you need more, record why.
- **Trump rounds are always decided** (1.5): the trump branch returns a non-null winner, so the tie path is only ever a genuine no-trump equal-values round.
- **Test helper `makeState`** in `applyCommand.test.ts` already supports `superTrumpCardId` and a `NO_TRUMP_IN_PLAY` sentinel; extend it with a `pot` option for the sweep tests. Deck cards that share a stat (for ties): `trafalgar-d-water-law`, `eustass-kid`, `monkey-d-luffy`, `kuzan-aokiji` all have `bounty 3_000_000_000`.
- **The existing tie test asserts a throw** — it WILL fail after this story. Replacing it is part of Task 5 (tests are AI-permitted).
- **Review-cycle norm:** one review-fix commit per story so far (type-tightening, branch clarity). Write the resolution branches with explicit, narrow types from the start.

### Git intelligence

- Rhythm: branch `story/1.6` → implement by hand → AI writes tests → green → commit → push → PR → code-review → fix → merge → artifacts commit.
- `main` after 1.5: 86 tests, strict typecheck, Prettier clean.

### Technical notes

- TS 6 / Vitest 4 / Node 24; no new packages.
- `structuredClone(state)` before a call + `expect(state).toEqual(clone)` after = the purity check.
- Multiset-conservation assertion (sum of both stacks + pot, sorted ids) is the strongest guard for the transfer/sweep/elimination paths — use it on every state-changing test.

### Project Structure Notes

- Touched: `src/match/applyCommand.ts` (tie→pot, pot sweep, FR23 elimination). `round.ts` likely unchanged (it already reports tie via `winner: null`) — confirm before editing it. Tests in `src/match/applyCommand.test.ts`. Likely no `types.ts` change (existing `pot` + `RoundOutcome` suffice) — if you add a field, keep it minimal and record why.

### References

- [Source: planning-artifacts/epics.md#Story-1.6] — story statement + ACs (verbatim)
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md] — FR20 (tie→pot), FR21 (same chooser; winner takes played + pot), FR22 (chains), FR23 (no-next-card elimination); FR24–25b are 1.7 boundaries
- [Source: planning-artifacts/architecture.md#Communication-State-Patterns] — functional core, no-throw rule
- [Source: implementation-artifacts/1-5-the-super-trump-and-its-counter.md] — trump rounds are decided; current resolution flow; `winner: null` = tie
- [Source: implementation-artifacts/1-4-round-resolution-compare-transfer-pass-the-turn.md] — transfer convention, stack convention, multiset-conservation idiom

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted)

### Debug Log References

### Completion Notes List
1a — Decision: append to the winner's stack bottom as pot cards first (oldest tie cards, in the order they accumulated), then this round's chooser card, then the opponent card
1b — Decision: append `chooserPlayedCard` then `opponentPlayedCard` (same pair order as 1.4)
1c — Decision: roundsPlayed does not increment on a tie. It only increments on decided rounds.
1d/1e — FR23 card movement (a tie that can't continue → opponent collects all cards in play + pot) is implemented here, per AC4. Only the match-end representation (ended/endReason) is deferred to story 1.7. Both-empty edge: the code has a safe, non-crashing fallback — because `chooserStack.length === 0` is checked before `opponentStack.length === 0`, a tie that empties both stacks resolves as opponent-takes-all (multiset still conserved). The proper draw / sudden-death *rule* (FR25) still lands in 1.7.

### File List

- `packages/engine/src/match/applyCommand.ts` (tie→pot, pot sweep, FR23 elimination, `addCardsToWinnerStack` helper)
- `packages/engine/src/match/round.ts` (whitespace reformat only)
- `packages/engine/src/match/applyCommand.test.ts` (tie/pot/chain/FR23 suite; `makeState` `pot` knob)

## Review Findings

_Code review 2026-06-21 (3 parallel layers). **AC1–5 all satisfied**; code matches recorded decisions 1a–1d; the tie throw is removed (no throw on any legal play path); purity and 32-card multiset conservation verified on every path. 92 tests green, typecheck clean. No decision-needed; findings are low-severity._

### Patches (optional, Low)

- [x] [Review][Patch][Low] Make the `winner === …` blocks mutually exclusive — **RESOLVED:** now an `if / else if / else if` chain (no bare `else` — the explicit `=== opponentId` is clearer and avoids assuming the catch-all is the opponent).
- [x] [Review][Patch][Low] Clarify Completion Note 1e — **RESOLVED:** note now records the both-empty fallback (opponent-takes-all via branch order), with the draw/sudden-death rule still deferred to 1.7.

### Deferred (to story 1.7 — match end)

- [x] [Review][Defer] Both-empty tie produces an arbitrary winner (opponent-takes-all by branch order) rather than a draw/sudden-death — accepted per decision 1e; does not crash or lose cards (multiset conserved). The real draw / sudden-death rule (FR25) lands in 1.7.
- [x] [Review][Defer] `shift()!` on an already-finished (0-card) state would crash — an FR23 elimination legitimately produces a 0-card player, and calling `applyCommand` again on that state hits the unguarded `shift()!`. The match-end guard (`ended`/`endReason`, FR24) that prevents acting on a finished match is story 1.7. (Same family as the 1.4-review defer.)
- [x] [Review][Defer] `lastRound.winner === null` cannot distinguish a pushed tie from an FR23 elimination — 1.7's end-detection should read stack sizes (FR24), not `lastRound`. Noted so 1.7 does not rely on `lastRound.winner` for elimination.

### Dismissed (by-design / safe)

- `roundsPlayed` not incremented on a tie (incl. elimination-tie) — consistent with recorded decision 1c (ties don't count).
- `addCardsToWinnerStack` params typed `Card[]` (mutable) — correct: it `push`es into freshly-built local copies, never `state.pot` or input stacks; `readonly` would forbid the `push`.
- "Two winner branches could fire" — proven impossible (`winner` holds a single value).
