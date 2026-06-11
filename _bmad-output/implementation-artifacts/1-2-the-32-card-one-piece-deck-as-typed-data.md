# Story 1.2: The 32-card One Piece deck as typed data

Status: done

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Exception per working agreement: test files may be
     AI-written. Do NOT run bmad-dev-story as designed on this story. -->

## Story

As a player,
I want the authoritative 32-character deck with 8 stats encoded in the game,
so that matches use the exact roster and values from the PRD.

## Acceptance Criteria

1. **Given** the deck module, **when** tests load `onePieceDeck`, **then** it satisfies the `Deck` interface (theme seam) with exactly 32 unique cards, each with exactly 8 numeric stats matching PRD Appendix A (spot-checked rows asserted: Luffy, Chopper, Dragon, Buggy).
2. The Age stat is flagged low-wins and all others high-wins (FR13 data).
3. Buggy carries the `counterCard` flag (FR18 data).
4. `types.ts` exports `Card`, `StatKey`, and `Deck`, used by all later stories.

## Tasks / Subtasks

- [x] Task 1: Design the core types in `packages/engine/src/types.ts` (AC: 4)
  - [x] `StatKey` — a union of 8 literal keys, one per stat. Decision to make and defend: short camelCase keys (e.g. `bounty`, `age`, `haki`, `loyalty`, `devilFruitMastery`, `fearFactor`, `speed`, `battleIQ`) with the PRD's display names ("Loyalty/Honor", "Speed/Agility") carried as labels in stat metadata — [x] keys end up in socket payloads and reducer actions from Epic 2 on, so pick names you'd defend in a code review. Modern-TS option worth knowing: derive the union from a `const` array (`typeof STAT_KEYS[number]`) so the list exists once.
  - [x] Stat metadata — AC 2 requires Age's low-wins rule to live in *data*, not in comparison code (Story 1.4 reads it). Decision: a stat-definition shape carrying at least `key`, `label`, and a win direction (e.g. `direction: 'high' | 'low'`). Avoid a bare boolean named ambiguously — `lowWins: true` reads fine, `inverted: true` does not.
  - [x] `Card` — at minimum: stable `id`, display `name`, the 8 stat values (a `Record<StatKey, number>` is the tight v1 shape), and the FR18 counter flag. Decision: `counterCard` as optional flag (`counterCard?: true`) vs required boolean on all 32 cards — either passes AC 3; be consistent and say why.
  - [x] `Deck` — the theme seam (architecture: "deck as data behind an interface"). Minimum: the stat definitions + the cards. Keep it shaped so a future theme (different roster, different stats) is a new module, not a rewrite.
  - [x] ⚠️ Spec reconciliation, decide consciously: the epics AC says `types.ts` exports `Deck`, but the architecture tree places the `Deck` interface in `deck/deck.ts` (theme seam). Recommended resolution: define `Card`/`StatKey`/stat metadata in `types.ts`, define `Deck` in `deck/deck.ts`, and re-export `Deck` from `types.ts` (or define all in `types.ts` and have `deck/deck.ts` re-export). Both satisfy the AC; record the choice in Completion Notes.
- [x] Task 2: Create `packages/engine/src/deck/deck.ts` (AC: 1)
  - [x] The `Deck` interface (or its re-export, per Task 1 decision) plus the canonical 8-stat definition list for this theme (the `direction` flags live here — Age `low`, all others `high`).
  - [x] ESM gotcha from Story 1.1: relative imports must use the `.js` extension (`from '../types.js'`) — NodeNext resolution; tsc + Node reject extensionless.
- [x] Task 3: Hand-type the 32 cards into `packages/engine/src/deck/onePieceDeck.ts` (AC: 1, 3)
  - [x] Source of truth: PRD Appendix A table — `_bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md` (already normalized; a cell-by-cell reconciliation against the original chart found zero mismatches — do NOT "fix" values that look odd, see Data fidelity notes below)
  - [x] Keep PRD order #1–#32; give each card a stable `id` (kebab-case slug recommended, e.g. `monkey-d-luffy`)
  - [x] Bounties are plain JS numbers (max 5,564,800,000 — far under `Number.MAX_SAFE_INTEGER`; no BigInt). Use numeric separators for readability: `5_564_800_000`
  - [x] Buggy the Clown (#13) gets the `counterCard` flag — exactly one card in the deck carries it
  - [x] Modern-TS pattern worth using here: `satisfies Deck` on the exported value (keeps literal inference while checking the shape) — an interview-explainable choice vs a plain `: Deck` annotation
- [x] Task 4: Replace the barrel `packages/engine/src/index.ts` (AC: 4)
  - [x] Clears the logged deferred-work item: replace the default-export `hello()` with the real named-export barrel (`export type { Card, StatKey, Deck } ...`, `export { onePieceDeck } ...` — `verbatimModuleSyntax` forces the explicit `export type` split)
  - [x] Delete `index.test.ts` (the hello test) — `deck.test.ts` takes over as the engine's test suite
- [x] Task 5: Write `packages/engine/src/deck/deck.test.ts` (AC: 1, 2, 3) — test files are the working-agreement exemption; AI may write these
  - [x] Exactly 32 cards; `id`s unique; `name`s unique
  - [x] Every card has exactly the 8 `StatKey`s, every value a finite non-negative integer
  - [x] Stat definitions: exactly 8; Age flagged low-wins; the other 7 high-wins
  - [x] Exactly one `counterCard` in the deck, and it is Buggy the Clown
  - [x] Spot-check full rows (all 8 values asserted) for: Luffy, Chopper, Dragon, Buggy — values in Dev Notes below
- [x] Task 6: Prove the loop (AC: all)
  - [x] `npm test` — deck suite green (hello test gone)
  - [x] `npm run typecheck` — strict-clean
  - [x] Commit; run code-review on the diff per process

### Review Findings

- [x] [Review][Decision] Sabo's `name` deviates from PRD Appendix A — **resolved by PRD amendment (2026-06-11):** Danilo's intentional choice; Appendix A row #31 updated to `"Flame Emperor" Sabo` with the amendment recorded in the normalization notes. Code and PRD now agree; no code change.
- [x] [Review][Decision→Patch] Exported deck is a mutable shared singleton — **decided (2026-06-11): readonly types.** `Deck.stats`/`Deck.cards` become `readonly` arrays (compile-time protection; 1.3's shuffle must copy). Danilo implements [packages/engine/src/deck/deck.ts:6-9]
- [x] [Review][Decision→Patch] `counterCard` shape — **decided (2026-06-11): optional flag `counterCard?: true`.** Omit on the 31 normal cards; only Buggy carries it. Danilo implements [packages/engine/src/types.ts:23, packages/engine/src/deck/onePieceDeck.ts]
- [x] [Review][Patch] `.ts`-extension relative imports violate the ESM `.js` rule (type-only erasure is why tsc passes today; breaks on first value export / 2.1 emit) [packages/engine/src/index.ts:1, packages/engine/src/deck/deck.test.ts:3]
- [x] [Review][Patch] Redundant `: Deck` annotation widens the export and defeats `satisfies Deck` [packages/engine/src/deck/onePieceDeck.ts:3]
- [x] [Review][Patch] Dead exported type `StatDirection` — never referenced; `types.ts:16` inlines the union [packages/engine/src/deck/deck.ts:4]
- [x] [Review][Patch] Stat `label` values shipped untested — suite asserts `key`/`direction` only; PRD display names unguarded [packages/engine/src/deck/deck.test.ts:79-87]
- [x] [Review][Patch] PRD order #1–#32 unasserted — reordered cards would pass the suite; Task 3 mandates PRD order [packages/engine/src/deck/deck.test.ts]
- [x] [Review][Patch] No upper bound on the six 0–100-scale stats — a dropped/extra digit in the 28 non-spot-checked rows passes [packages/engine/src/deck/deck.test.ts:104-114]
- [x] [Review][Patch] Barrel omits `StatDefinition` — Epic 2 consumers can't name the stat-metadata type from the package surface [packages/engine/src/index.ts:1]
- [x] [Review][Patch] Missing trailing newline (recurring 1.1 review nit) [packages/engine/src/deck/onePieceDeck.ts:529]
- [x] [Review][Patch] Stray blank lines / shallow card indentation [packages/engine/src/deck/deck.ts:2-3,10; packages/engine/src/deck/onePieceDeck.ts (Doflamingo→Ace seam)]
- [x] [Review][Defer] Type-only circular import `types.ts` ↔ `deck/deck.ts` [packages/engine/src/types.ts:1] — deferred, consequence of the recorded AC4 re-export decision; type-only so harmless until layout changes
- [x] [Review][Defer] Quote-style split across new files (single vs double) — deferred, needs a formatter decision (Prettier/Biome), not a story-1.2 fix

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews against this file + architecture.md — never paste-ready implementation code. **Exemption: test files (Task 5) may be AI-written.** [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]

### Scope guard

- This story is **data + types only**. No shuffle, no deal, no Super Trump draw (Story 1.3), no comparison logic (Story 1.4). The Age low-wins and counterCard *flags* are data this story ships; the *rules* that read them come later.
- No new dependencies. zod stays declared-but-unused in the engine; the deck is compile-time-typed internal data — runtime validation of our own hardcoded module would be gold-plating (counter-metric: time-to-playable). zod's job starts at the protocol boundary (Story 2.2).

### Data fidelity (the heart of this story)

- PRD Appendix A is **authoritative and already normalized** — all 256 values (32×8) were verified cell-by-cell against the source chart with zero mismatches. [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/reconcile-rules-and-chart.md#Data-check]
- Values that look wrong but are right — do not "fix":
  - Usopp Fear Factor **15** (the "fake 99" annotation was dropped by design)
  - Jinbe Speed/Agility **65** (not the in-water 92)
  - Marine bounties (Garp, Akainu, Kizaru) = **0** — deliberately weak stat
  - Chopper Bounty **1,000**; Luffy Battle IQ **40**
  - Dragon Bounty **5,000,000,000** (normalized from "Unknown", confirmed by Danilo)
  - "No DF" → Devil Fruit Mastery **0** on exactly 10 cards: Zoro, Nami, Usopp, Sanji, Franky, Jinbe, Shanks, Mihawk, Roger, Garp
- Duplicate stat values across cards are real and intentional (e.g. Bounty 3,000,000,000 appears on Luffy, Law, Kid, and Kuzan) — they are what makes FR20 ties reachable in later stories. "32 unique cards" means unique identities, not unique stat rows.

### Spot-check rows for `deck.test.ts` (AC 1)

| Card | Bounty | Age | Haki | Loyalty/Honor | DF Mastery | Fear Factor | Speed/Agility | Battle IQ |
|---|---|---|---|---|---|---|---|---|
| Monkey D. Luffy (#1) | 3,000,000,000 | 19 | 92 | 98 | 97 | 88 | 94 | 40 |
| Tony Tony Chopper (#6) | 1,000 | 17 | 0 | 98 | 85 | 5 | 70 | 80 |
| Monkey D. Dragon (#30) | 5,000,000,000 | 55 | 95 | 90 | 90 | 95 | 90 | 96 |
| Buggy the Clown (#13) | 3,189,000,000 | 39 | 10 | 15 | 60 | 85 | 70 | 50 |

Buggy is additionally the deck's only `counterCard` (FR18). Type the other 28 rows directly from PRD Appendix A.

### Constraints that bite in this story

- **Engine purity**: still zod-only deps, no Node APIs. A data module has no excuse to violate this — review checks imports anyway. [Source: planning-artifacts/architecture.md#Architectural-Boundaries]
- **ESM/NodeNext**: every relative import written with `.js` extension, from the first file (1.1 learning).
- **Naming contract**: modules camelCase (`onePieceDeck.ts`), types PascalCase no `I` prefix (`Card`, `Deck`, `StatKey`), true constants SCREAMING_SNAKE_CASE (e.g. `STAT_KEYS` if you derive the union). One concept = one name: it is `stat` (not attribute/category), `counterCard`, `superTrump`. [Source: planning-artifacts/architecture.md#Naming-Patterns]
- **Tests co-located**: `deck.test.ts` beside `deck.ts`/`onePieceDeck.ts` in `src/deck/`. [Source: planning-artifacts/architecture.md#Structure-Patterns]
- **Display formatting is NOT this story**: how a 10-digit bounty renders ("3 Billion!") is a client concern (Epic 2, FR12/FR29). The engine stores plain numbers.

### Previous story intelligence (1.1 review learnings)

- The barrel replacement (Task 4) is a **logged deferred-work item** — closing it here is expected; tick it off in `deferred-work.md` when done. [Source: implementation-artifacts/deferred-work.md]
- Review nits that recurred in 1.1 — avoid generating new findings: trailing newline on every file; no redundant type annotations where literals infer; keep test assertions and source strings in sync (1.1's AC failed on a casing mismatch between test and implementation).
- `.npmrc` enforces `engine-strict` → Node ≥24 required if you run `npm install` (this story needs no install — no new deps).
- Engine `exports` map points at `./src/index.ts` — fine for tsc/Vitest (all this story needs); the dist repoint stays parked for 2.1.

### What "done" sets up for the next stories

- Story 1.3 (`createMatch`: shuffle, deal, Super Trump draw) consumes `Deck`/`Card` and needs the `counterCard` flag to exclude Buggy from the trump draw (FR9).
- Story 1.4 (round resolution) reads the stat `direction` data to implement Age low-wins (FR13) without special-casing.
- `types.ts` becomes the growing home of `MatchState`, `PlayerView`, `EndReason` (1.3–1.8) — start it clean.

### Project Structure Notes

Target tree delta for this story (slice of the architecture tree):

```
packages/engine/src/
├── index.ts            # REWRITE: named-export barrel (types + onePieceDeck)
├── index.test.ts       # DELETE (hello test retired)
├── types.ts            # NEW: Card, StatKey, Deck (per Task 1 decision), stat metadata
└── deck/
    ├── deck.ts         # NEW: Deck interface (theme seam) + 8 stat definitions
    ├── onePieceDeck.ts # NEW: the 32 cards (FR6, PRD Appendix A)
    └── deck.test.ts    # NEW: 32 cards, 8 stats, flags, spot-check rows
```

No variances from the architecture tree. `rng.ts`, `match/`, `projection/`, `protocol/` arrive in later stories.

### References

- [Source: planning-artifacts/epics.md#Story-1.2] — story statement + ACs (authoritative)
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md#Appendix-A] — the 32-card table (authoritative values) + normalization rules
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Data-normalization-detail] — normalization rationale per value
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/reconcile-rules-and-chart.md#Data-check] — 256-value verification, zero mismatches
- [Source: planning-artifacts/architecture.md#Data-Architecture] — "deck as data behind an interface (theme seam)"
- [Source: planning-artifacts/architecture.md#Format-Patterns] — bounty as plain number, no BigInt
- [Source: planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — naming/structure contract
- [Source: implementation-artifacts/deferred-work.md] — barrel replacement owed by this story
- [Source: implementation-artifacts/1-1-monorepo-foundation-with-a-proven-test-harness.md#Dev-Notes] — ESM `.js` extension habit, review-nit list

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion (agreed 2026-06-11); Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files AI-permitted)

### Debug Log References

### Completion Notes List

- **Stat keys vs. labels (Task 1):** `StatKey` is a union of short camelCase identifiers (`bounty` … `battleIQ`); the PRD display names ("Loyalty/Honor", "Speed/Agility") live as `label` strings in the deck's `StatDefinition` metadata. Keys are used as record properties and will travel in socket payloads and reducer actions from Epic 2 on, so they must be stable, valid identifiers; labels are presentation and per-theme, so they belong in deck data where a future theme can swap them without touching engine code.
- **`Deck` location (Task 1 spec reconciliation):** `Card`, `StatKey`, and `StatDefinition` are defined in `types.ts`; `Deck` is defined in `deck/deck.ts` (the theme seam, per the architecture tree) and re-exported from `types.ts`, so the epics AC "`types.ts` exports `Deck`" still holds. Consumers import all four names from the barrel either way.
- **Card data location (Task 3):** the 32-card `onePieceDeck` constant lives in `deck/onePieceDeck.ts` per the planned tree; `deck/deck.ts` keeps the `Deck` interface and stat-definition types.
- **Test/source sync findings fixed during 1.2:** stray emoji in Buggy's `name`, autocomplete artifact in Sabo's `id`, and labels aligned to PRD display names — all caught by `deck.test.ts` or AI review before commit.

### File List

- `packages/engine/src/types.ts` (new) — `StatKey`, `StatDefinition`, `Card`; re-exports `Deck`
- `packages/engine/src/deck/deck.ts` (new) — `Deck` interface, `StatDirection` (theme seam)
- `packages/engine/src/deck/onePieceDeck.ts` (new) — the 32-card One Piece deck data
- `packages/engine/src/deck/deck.test.ts` (new, AI-written per exemption) — 42-test suite for AC 1–3
- `packages/engine/src/index.ts` (modified) — real named-export barrel replaces `hello()` (closes deferred-work item)
- `packages/engine/src/index.test.ts` (deleted) — hello test superseded by `deck.test.ts`
