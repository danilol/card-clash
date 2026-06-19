---
baseline_commit: 25c85db1d596694a5f4304e2292803900d3b78b2
---

# Story 1.3: Match setup — shuffle, deal, and the Will of D.

Status: done

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills Dev Agent Record (Completion Notes, File List) at completion (agreed
     2026-06-11). Do NOT run bmad-dev-story as designed on this story. -->

## Story

As a player,
I want each match set up with a fair shuffle, even deal, and a secret Super Trump,
so that every game starts correct and unpredictable.

## Acceptance Criteria

1. **Given** a seedable injected Rng, **when** `createMatch(deck, players, rng)` runs, **then** 32 cards are dealt 16/16 face-down with no card lost or duplicated (FR7), the same seed reproduces the same setup, and different seeds differ.
2. One card is selected Super Trump with Buggy never selected across many seeded draws (FR9).
3. The first chooser is randomly assigned (FR10).
4. The resulting `MatchState` is a plain immutable value (no classes, no I/O).

## Tasks / Subtasks

- [x] Task 1: Design the Rng seam in `packages/engine/src/rng.ts` (AC: 1)
  - [x] The `Rng` interface — decision to make and defend: what's the minimal surface the engine needs? Two common shapes: `next(): number` returning a float in [0, 1) (mirrors `Math.random`, trivial to wrap) vs `nextInt(maxExclusive: number): number` (what shuffle/draw/chooser actually consume; keeps the float→index conversion in one place instead of at three call sites). Either works; pick one and say why. `Math.floor(rng.next() * n)` is fine at these sizes (modulo/float bias is negligible for n ≤ 32).
  - [x] ⚠️ Engine purity means NO rng dependency: zod stays the engine's only dep (architecture hard boundary), so `seedrandom`/`pure-rand` are off the table. Hand-write a tiny seeded PRNG — **mulberry32** is the canonical choice: ~5 lines, public domain, 32-bit state, passes statistical tests far beyond game needs. Type it yourself and be able to explain it (interview Q: "why is this enough — and when wouldn't it be?" Answer: not cryptographic; fine for games, never for secrets, and matchId generation in 2.2 will NOT use it).
  - [x] A default (unseeded) impl can wrap `Math.random` — a JS built-in, not a Node API, so purity holds. Production callers use it; tests inject the seeded one. Direct `Math.random` calls anywhere else in the engine are a review finding: the injected Rng is the ONLY randomness door (NFR1).
- [x] Task 2: Extend `packages/engine/src/types.ts` with the match-state types (AC: 4)
  - [x] `PlayerId` — decision: plain `string` vs a branded type (`string & { __brand: 'PlayerId' }`). Branded prevents id/nickname mix-ups at compile time but adds ceremony at every construction site; plain string is the pragmatic v1 call. Either is defensible — record the choice.
  - [x] Players as a `readonly PlayerId[]` (length 2 in practice) — NOT `playerOne`/`playerTwo` literals. This is the architecture's cheap future-proofing seam #3; FR-level it's still strictly 1v1.
  - [x] `MatchState` — minimal fields setup actually produces; later stories extend (extend-not-rewrite): `players`, per-player stacks (decision: `Record<PlayerId, readonly Card[]>` vs `readonly Card[][]` parallel to `players` — the Record reads better in 1.4's reducer logic), `pot` (empty now; 1.6 fills it), `superTrumpCardId` (store the **card id**, never a stack index — indexes shift every round), `chooser: PlayerId`, `roundsPlayed: 0`. Every field `readonly`, arrays `readonly` — the 1.2 review decision that forces 1.4+'s transitions to copy.
  - [x] ⚠️ Document the stack orientation convention as a comment where the stack type is defined: **index 0 = top of stack** (or your choice — but write it down; 1.4's round resolution, 1.6's pot returns, and 1.8's projection all read this convention and must agree).
  - [x] ⚠️ Look one story ahead before freezing the shape: 1.4's transition is `applyCommand(state, command)` — no deck parameter. The Age-low-wins comparison needs `StatDefinition.direction`, so decide consciously NOW: does `MatchState` carry the stat definitions (or the whole `Deck`), or does 1.4 extend state later / import the deck module (which weakens the theme seam)? Any answer works; making it accidentally is the trap. Record the choice in Completion Notes.
- [x] Task 3: Implement `createMatch` in `packages/engine/src/match/setup.ts` (AC: all)
  - [x] Signature per epics AC: `createMatch(deck, players, rng)` → `MatchState`. Pure function: same inputs (incl. same-seeded rng) → same output; no `Date.now`, no direct `Math.random`, no I/O.
  - [x] **Fisher–Yates shuffle** over a copy of `deck.cards` — `[...deck.cards]` (the `readonly` types from the 1.2 review make in-place shuffle a compile error; this is that decision paying off). Know why Fisher–Yates and not `arr.sort(() => rng.next() - 0.5)`: the sort trick is biased (comparison sorts assume consistent comparators) and is a classic interview trap. Iterate from the end, swap with a random index ≤ current — each of the 32! permutations equally likely.
  - [x] Deal 16/16: with a uniform shuffle, `slice(0, 16)` / `slice(16)` is exactly as fair as alternate-dealing — pick the simple one and be able to say why fairness is already guaranteed by the shuffle, not the deal pattern.
  - [x] Super Trump draw (FR9): decision — redraw-loop (draw any card; if it's the counter card, draw again) vs filtered draw (draw from the non-counter cards). FR9's "redraw if selected" describes the *rule's effect*; the filtered draw implements the same distribution and terminates by construction. Either passes the AC; record the choice. Identify Buggy via the `counterCard` flag (truthy check — it's `counterCard?: true` since the 1.2 review), NEVER via hardcoded id — the theme seam means a future deck's counter card isn't Buggy.
  - [x] First chooser (FR10): one rng pick over the `players` array.
  - [x] Order of rng consumption matters for determinism tests: shuffle, then trump draw, then chooser (or any fixed order — but fix it; the same-seed-same-setup test depends on it).
- [x] Task 4: Export the new surface from the barrel `packages/engine/src/index.ts` (AC: 4)
  - [x] `export type` for `MatchState`, `PlayerId`, `Rng` (verbatimModuleSyntax forces the type/value split); value exports for `createMatch` and the rng implementations.
  - [x] `.js` extensions on every relative import — this bit twice in 1.2 (type-only `.ts` imports typecheck today but break on the first value export; story 2.1's build makes it fatal).
- [x] Task 5: Tests `packages/engine/src/match/setup.test.ts` (AC: all) — test files are the working-agreement exemption; AI may write these
  - [x] Conservation (FR7): the multiset of card ids across both stacks equals the deck's 32 ids — nothing lost, nothing duplicated; stacks are 16/16.
  - [x] Determinism (AC 1): same seed → deep-equal `MatchState` twice; different seeds → different stack order (and typically different trump/chooser).
  - [x] FR9: across many seeds (e.g. 200), `superTrumpCardId` is never the counter card's id; the trump is always a card that exists in the deck.
  - [x] FR10: chooser is always one of `players`, and both players are chosen across the seed sweep (no constant first player).
  - [x] Purity: `createMatch` does not mutate its inputs — `onePieceDeck.cards` order unchanged after a call; two calls with independently-seeded rngs don't interfere.
  - [x] Plain value (AC 4): `JSON.parse(JSON.stringify(state))` deep-equals the state (no class instances, functions, or undefined-holes surviving serialization).
  - [x] Optional: a tiny co-located `rng.test.ts` (same seed → same sequence; outputs in [0, 1)) gives the PRNG direct coverage instead of only transitive coverage through setup.
- [x] Task 6: Prove the loop (AC: all)
  - [x] `npm test` — setup suite green alongside the 43 deck tests
  - [x] `npm run typecheck` — strict-clean
  - [x] Prettier (configured 2026-06-11, singleQuote): rely on format-on-save or run `npm run format` before committing
  - [x] Commit on `story/1.3`, push, open PR, run code-review per process

### Review Findings

- [x] [Review][Patch] **HIGH** — `MatchState` fields are not `readonly`; state is not immutable at the type level (AC 4, Task 2 constraint "every field readonly"). `state.roundsPlayed = 5` and `state.playerStacks[id] = ...` compile today. Fix: `readonly` on every field, and wrap the stacks record so its entries can't be reassigned [packages/engine/src/types.ts:30-37] — fixed in 61a2eb2 (both protections: readonly fields + readonly array/record contents)
- [x] [Review][Patch] LOW — `Rng` interface documents no range contract; implementers/consumers must guess that `next()` returns a float in [0, 1). Fix: doc comment on the interface [packages/engine/src/rng.ts:1-3] — fixed in 61a2eb2
- [x] [Review][Patch] LOW — Naming drift (naming contract: one concept = one name): `cardsWithoutTrump` actually holds cards without the *counter card*; `randomDeckIndex` indexes any array (used on `players`); `PlayerStack` (singular) holds ALL players' stacks [packages/engine/src/match/setup.ts:45,49; packages/engine/src/types.ts:28] — fixed in 61a2eb2 (`cardsWithoutCounterCard`, `randomIndex`, `PlayerStacks`)
- [x] [Review][Patch] LOW — `// TODO: Add other fields as needed` shipped inside the public exported `MatchState`; the extend-not-prebuild rule is story process, not a code comment [packages/engine/src/types.ts:38] — fixed in 61a2eb2
- [x] [Review][Patch] LOW — `mulberry32` accumulator never wraps to 32 bits (`a += 0x6d2b79f5` grows as a float; precision degrades after ~5M calls on one instance). Matches the bryc reference, but `| 0` is a one-char robustness fix [packages/engine/src/rng.ts:8] — fixed in 61a2eb2 (`a = (a + 0x6d2b79f5) | 0`)
- [x] [Review][Defer] `Deck` type reachable via two import routes (`deck/deck.js` directly vs `types.js` re-export) — deferred, pre-existing: accepted 1.2 variance (type-only circular import) [packages/engine/src/match/setup.ts:2]

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews against this file + architecture.md — never paste-ready implementation code. **Exemptions: test files (Task 5) may be AI-written; AI fills the Dev Agent Record at completion.** [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]

### Scope guard

- This story is **setup only**: `rng.ts`, `MatchState` types, `createMatch`. No `applyCommand` (1.4), no round/trump resolution (1.4/1.5), no pot mechanics beyond the empty field (1.6), no end states (1.7), no projection or protocol (1.8). If you find yourself writing a `selectStat` handler, stop.
- `MatchState` carries only what setup produces plus the two cheap lifecycle fields (`pot`, `roundsPlayed`) that every later story reads. Fields like `lastRound`, `endReason`, `phase` are added by the stories that need them — extend, not pre-build. (Exception you must decide now: stat definitions — see the Task 2 look-ahead.)
- **The engine trusts its inputs** (architecture: validation is the server boundary's job, zod in 2.2). No defensive checks on `players` (length, duplicate ids) in `createMatch` — that's gold-plating against the time-to-playable counter-metric, same call as 1.2's no-runtime-validation-of-own-data. Tests should NOT expect error returns for malformed input; there is no error path here.
- No new dependencies, runtime or dev. The seeded PRNG is hand-written (Task 1); zod remains declared-but-unused until 2.2.

### Architecture constraints that bind this story

- **Engine purity (hard boundary):** no socket.io, no pg, no React, no Node APIs. `Math.random` (JS built-in) is permitted inside the default Rng only. [Source: planning-artifacts/architecture.md#Architectural-Boundaries]
- **Functional core:** randomness enters ONLY as the injected `Rng`; `createMatch` is a pure value-in/value-out function. This story establishes the seam that 1.7's long seeded random-play invariant test and every engine test after it will reuse. [Source: planning-artifacts/architecture.md#Communication-State-Patterns]
- **Naming contract:** it is `superTrump`, `chooser`, `stack`, `pot`, `match` — PRD vocabulary, one concept = one name. Files camelCase (`setup.ts`); types PascalCase no `I` prefix; true constants SCREAMING_SNAKE_CASE. [Source: planning-artifacts/architecture.md#Naming-Patterns]
- **File placement:** `rng.ts` at engine src root; `setup.ts` + co-located `setup.test.ts` in `src/match/`. [Source: planning-artifacts/architecture.md#Complete-Project-Directory-Structure]

### Previous story intelligence (1.2 — done 2026-06-11, PR #3)

- **`Deck.stats`/`Deck.cards` are `readonly` arrays** (1.2 review decision, made specifically for this story): in-place `sort`/`splice` on the deck won't compile. Copy first — `[...deck.cards]` — then shuffle the copy.
- **`counterCard?: true`** — optional flag, present only on Buggy. Truthiness check (`card.counterCard`) is the idiom; `=== false` comparisons are dead code against this type.
- **ESM `.js` extensions on ALL relative imports** — bit twice in 1.2 (a type-only `.ts` import typechecked by accident and was a review finding). Write `.js` from the first line.
- **`satisfies` over annotation** where literal inference matters; no redundant `: T` annotation next to `satisfies T` (1.2 review finding).
- **Prettier is configured** (root, `singleQuote: true`, `.prettierignore` covers `_bmad-output/`) — format-on-save kills the whitespace-nit class of review findings (trailing newline, double blank lines were 1.1 AND 1.2 findings).
- **Deferred, not this story's problem:** engine `exports` map points at `src/index.ts` (dist repoint lands in 2.1); type-only circular import `types.ts` ↔ `deck/deck.ts` (accepted consequence of the AC4 re-export decision); `outDir`/build wiring (2.1).
- Barrel currently exports: types `Card`, `Deck`, `StatKey`, `StatDefinition`; value `onePieceDeck`. The 1.2 layout: `types.ts` (Card/StatKey/StatDefinition, re-exports Deck) · `deck/deck.ts` (Deck interface) · `deck/onePieceDeck.ts` (data). `MatchState` and friends go in `types.ts` per the architecture tree comment.
- Process rhythm that worked: branch `story/1.3` → implement → AI writes tests → `npm test` + typecheck → commit → push → PR → `bmad-code-review` → fix findings → merge → wrap (story status, sprint-status, deferred-work).

### Git intelligence

- Recent history: `story/1.2` merged as PR #3 (data commit → review-fixes commit → artifacts commit). Review-fix commits are normal, not failure — plan for one.
- `main` is green: 43 engine tests, strict typecheck, Prettier formatting in place.

### Technical notes (current as of 2026-06)

- **mulberry32** (seeded PRNG to hand-write): takes a 32-bit integer seed, returns a `() => number` in [0, 1). The canonical reference implementation is in bryc's PRNG gist on GitHub (search "bryc PRNG mulberry32"; Tommy Ettinger is the original author) — read it, understand the bit-mixing, type it yourself. SplitMix32 is the equally fine alternative. Both are public domain.
- **Fisher–Yates** (a.k.a. Knuth shuffle), backward/Durstenfeld form: `for i from n−1 down to 1: j = randInt(0..i); swap a[i], a[j]`. O(n), uniform over permutations, the standard answer.
- TS 6 / Vitest 4 / Node 24 already proven in-repo; no version research needed; no new packages permitted by the purity boundary.

### Project Structure Notes

- Aligns with the architecture tree: `src/rng.ts` (new), `src/match/setup.ts` (new), `src/match/setup.test.ts` (new), `src/types.ts` (extended), `src/index.ts` (extended). First story to create the `match/` directory.
- Known variance carried from 1.2 (recorded there): `Deck` interface lives in `deck/deck.ts` and is re-exported from `types.ts`.
- Decision on `Math.floor(rng.next() * n)` => easier to implement and pseudo-random is what we need at the moment since we're not handling secrets or cryptography, it's good enough for a simple game.
- Decision on `PlayerId` => plain string is the pragmatic v1 call.
- Decision on `playerStacks` => using `Record<PlayerId, readonly Card[]>` because it reads better in 1.4's reducer logic.
- Decision on stack orientation => index 0 = top of stack (documented in types.ts).
- Decision on 1.4 extend state later => we will extend the state in 1.4 to add the stat definitions, so we will store the whole deck in the state.

### References

- [Source: planning-artifacts/epics.md#Story-1.3] — story statement + ACs (verbatim)
- [Source: planning-artifacts/architecture.md#Core-Architectural-Decisions] — injected seedable Rng; in-memory state; functional core
- [Source: planning-artifacts/architecture.md#Cross-Cutting-Concerns-Identified] — deterministic randomness; player-list seam; deck-behind-interface
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md] — FR7 (shuffle/deal 16/16), FR9 (Super Trump draw, Buggy excluded), FR10 (random first chooser)
- [Source: implementation-artifacts/1-2-the-32-card-one-piece-deck-as-typed-data.md#Review-Findings] — readonly decision, counterCard shape, ESM extension rule

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion (agreed 2026-06-11); Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->


### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted)

### Debug Log References

- `rng.test.ts` red phase caught the classic factory-in-closure bug: `next: () => mulberry32(seed)()` built a fresh generator per call (always the first value). Fixed by calling the factory once and reusing the result.
- `setup.test.ts` red phase caught literal object keys (`{ player1: ... }` instead of computed `[player1]: ...`) — stacks landed under hardcoded names regardless of the `players` argument.
- Typecheck caught a mutable `players: PlayerId[]` parameter rejecting `readonly` arrays; widened to `readonly PlayerId[]`.

### Completion Notes List

All implementation hand-written by Danilo per working agreement; AI wrote the test files and this record. Recorded decisions:

- **Rng interface:** `next(): number` in [0, 1). Mid-story refinement: `mulberry32(seed)` returns a ready `Rng` object (not a bare function), so call sites need no wrapping. `defaultRng` wraps `Math.random` — the only permitted `Math.random` site in the engine.
- **PlayerId:** plain `string`, not branded — "simplicity; at this point the game is more important than users." Branded type can be revisited if id/nickname mix-ups ever appear.
- **Player stacks:** `Record<PlayerId, readonly Card[]>` (reads better in 1.4's reducer than parallel arrays). Stack orientation convention documented at the type: **index 0 = top of stack** (1.4/1.6/1.8 must agree).
- **Stat definitions look-ahead (Task 2 ⚠️):** `MatchState` does NOT carry stat definitions or the deck. Deliberate deferral: story 1.4 decides how `applyCommand` obtains `StatDefinition.direction`.
- **Super Trump draw:** filtered draw (draw from non-counter cards) over redraw-loop — same distribution, terminates by construction. Counter card identified via the `counterCard` flag, never by id.
- **Rng consumption order fixed:** shuffle → trump draw → chooser (determinism tests depend on it).
- **`chooser: PlayerId`** (tightened from `PlayerId | null` once setup always assigns it — no dead null branches for 1.4).
- Tests: 18 new (13 `setup.test.ts` + 5 `rng.test.ts`); suite total 61 green; strict typecheck clean. No new dependencies.

### File List

- `packages/engine/src/rng.ts` (new) — `Rng` interface, `mulberry32`, `defaultRng`
- `packages/engine/src/rng.test.ts` (new, AI-written) — PRNG determinism/range tests
- `packages/engine/src/match/setup.ts` (new) — `createMatch`, Fisher–Yates shuffle, trump draw, chooser pick
- `packages/engine/src/match/setup.test.ts` (new, AI-written) — FR7/FR9/FR10 + purity/plain-value tests
- `packages/engine/src/types.ts` (modified) — `PlayerId`, `PlayerStack`, `MatchState`
- `packages/engine/src/index.ts` (modified) — barrel exports for the new surface

## Change Log

- 2026-06-12: Story 1.3 implemented (rng seam, match-state types, `createMatch`, tests). 61 tests green, strict typecheck clean. (Danilo + AI mentor per working agreement)
- 2026-06-12: Addressed code review findings — 5 patches resolved in 61a2eb2 (deep-readonly `MatchState`, `Rng` range doc, 3 renames, TODO removal, mulberry32 32-bit wrap); 1 item deferred to deferred-work.md. Story done.
