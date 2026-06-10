---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md
---

# card-clash - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for card-clash, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

**Process note (binding):** Danilo hand-writes all implementation code. Stories in this document are tutorial-sized steps for a human developer with AI guidance/review — not specs for a code-generating agent.

## Requirements Inventory

### Functional Requirements

FR1: A player identifies themselves with a self-chosen nickname only; no registration, login, or authentication.
FR2: A player can create a new match and receive a shareable link (unguessable matchId embedded).
FR3: A second player opens the link, enters a nickname, and joins; the match starts automatically once two players are present.
FR4: The server is the single source of truth for match state; a client is never sent information its player shouldn't see (opponent's cards, deck order, Super Trump location).
FR5: When the server determines a player has left (connection closed, or unresponsive beyond ~10s detection window), the match ends and the remaining player wins by forfeit; momentary blips within the window are not a forfeit.
FR6: The game ships with exactly 32 hardcoded One Piece character cards, each with the same 8 stats (Bounty, Age, Haki, Loyalty/Honor, Devil Fruit Mastery, Fear Factor, Speed/Agility, Battle IQ); PRD Appendix A is authoritative.
FR7: At match start the deck is shuffled and dealt evenly, 16 cards per player, face-down stacks.
FR8: Each player sees only their own current top card; both players always see both stack counts and the pot count.
FR9: At match start the system randomly selects one card as the Super Trump for that match only; Buggy the Clown is excluded from the draw (redraw if selected).
FR10: The first chooser is selected at random.
FR11: The chooser selects one of the 8 stats on their top card.
FR12: Both top cards and the chosen stat's values are revealed to both players, winner clearly indicated, presented as the chooser's call-out (e.g., "Bounty: 3 Billion!").
FR13: The higher value wins the round — except Age, where the lower value wins.
FR14: The round winner takes both played cards and places them at the bottom of their stack (deterministic order: own card first, then opponent's, then pot cards in play order).
FR15: The round winner becomes the next chooser.
FR16: While the chooser is deciding, the opponent sees their own top card with stats locked and a clear "opponent is choosing…" state.
FR17: The Super Trump card automatically wins any round in which it is played, regardless of stat values, including tie-breaker rounds.
FR18: Exception — if the Super Trump and Buggy (the fixed Counter card) are played in the same round, Buggy wins instantly.
FR19: The Super Trump's identity is known to its holder only: marked on the card only when it is the holder's visible top card; opponent learns it only when played.
FR20: If both played values are equal (and no Super Trump rule applies), both cards move to a central pot.
FR21: The same chooser picks a new stat from their next top card; the winner takes both played cards plus the entire pot.
FR22: Ties can chain; repeated ties keep growing the pot under the same rules.
FR23: A player with no next card to continue a tie-breaker is eliminated and loses; the opponent collects all cards in play, including the pot.
FR24: A player with zero cards is eliminated; in 1v1 the opponent thereby holds all 32 cards and wins.
FR25: Safety valve — at 100 completed rounds, the player holding more stack cards wins (pot counts for neither); if equal, sudden death until the next decided round.
FR25b: In every end state, any cards still in the pot go to the match winner; the full 32-card deck is always accounted for.
FR26: A result screen shows winner, end reason (all cards / forfeit / round cap), rounds played, and offers a rematch with the same opponent.
FR27: Completed matches are persisted to a database: both nicknames, winner, end reason, rounds played, timestamp.
FR28: A minimal "recent matches" view exists (renders in HomeScreen via GET /api/matches/recent).
FR29: A card renders as a simple placeholder: character name plus 8 labeled stat values; no artwork.
FR30: The UI surfaces at minimum: own top card, both stack counts, pot count, whose turn it is, the round comparison result, and the Super Trump marker (per FR19).

### NonFunctional Requirements

NFR1: The rules engine must be deterministic and fully exercisable by unit tests in isolation from networking and UI (the engine is the interview showcase artifact).
NFR2: Hidden-information integrity — opponent cards, deck order, and Super Trump location must never reach a client that shouldn't see them (server-authoritative, projection-enforced).
NFR3: A round action is reflected on both players' screens within ~1 second on a typical home connection.
NFR4: Works on current evergreen desktop browsers; desktop-first, usable (not optimized) on mobile.
NFR5: No personal data beyond self-chosen nicknames is collected or stored.
NFR6: The whole product can run on Danilo's machine for local play and on a single small remote host for internet play.

### Additional Requirements

**From Architecture (binding for stories):**

- **Starter/greenfield setup (impacts Epic 1 Story 1):** hand-written monorepo root (`package.json` with `"workspaces": ["packages/*"]`, `tsconfig.base.json`) + `npm create vite@latest packages/client -- --template react-ts` for the client only; engine and server packages hand-created.
- 3-package npm-workspaces monorepo: `packages/engine` (pure rules), `packages/server` (Express 5 + Socket.IO 4.8 + pg), `packages/client` (React 19 + Vite 8). TypeScript 6, Node 24 LTS, ESM throughout, Vitest 4 with co-located tests.
- Engine purity is a hard boundary: engine imports zod only; randomness via injected seedable Rng; functional core `applyCommand(state, command) → CommandResult` (discriminated union, no throws for rule violations).
- Hidden-info enforcement: `projectFor(state, playerId) → PlayerView` is the ONLY serialization path; `PlayerView` includes `lastRound` (revealed outcome) to make FR12 renderable.
- Typed event protocol (Socket.IO `ClientToServerEvents`/`ServerToClientEvents` maps + zod command schemas) lives in `engine/protocol/`, shared by server and client (client: type-only imports).
- Transport config: Express 5 + Socket.IO share one `http.Server`; `pingInterval`/`pingTimeout` explicitly set so disconnect detection ≈10s (defaults would violate FR5).
- Full-snapshot protocol: every accepted command → `match:state` (PlayerView) to each player; no deltas.
- In-memory `matchStore` (Map) for live matches; evict after `match:ended` + FR27 write; rematch = fresh matchId.
- Persistence: PostgreSQL, raw `pg` 8.21 with hand-written SQL confined to `matchRepository.ts`; migrations via node-pg-migrate 8; `matches` table snake_case.
- Per-player random token issued at join, sent with every socket event (impersonation guard + future reconnect seam).
- Config via zod-validated env vars (`.env` locally); bare local install (Homebrew Postgres); deployment + CI consciously deferred with defined revisit triggers.
- Naming/format/process patterns per architecture "Implementation Patterns & Consistency Rules" — the binding consistency contract for all hand-written code.

### UX Design Requirements

N/A — no UX Design document exists (deliberate: the PRD specs the v1 placeholder UI directly via FR29–FR30; architecture maps it to four components: HomeScreen, MatchScreen, ResultScreen, CardView).

### FR Coverage Map

FR1: Epic 2 — nickname entry at create/join
FR2: Epic 2 — match creation + shareable link
FR3: Epic 2 — join via link, auto-start at 2
FR4: Epic 2 — server-authoritative delivery (mechanism `projectFor` built in Epic 1)
FR5: Epic 2 — disconnect detection (~10s ping config) + forfeit
FR6: Epic 1 — hardcoded 32-card deck module (Appendix A data)
FR7: Epic 1 — shuffle + 16/16 deal
FR8: Epic 2 — visibility surface (counts/pot in UI; data shaped by Epic 1 PlayerView)
FR9: Epic 1 — Super Trump draw, Buggy excluded
FR10: Epic 1 — random first chooser
FR11: Epic 2 — stat selection UI → command (legality enforced by Epic 1)
FR12: Epic 2 — call-out reveal rendering (lastRound data from Epic 1)
FR13: Epic 1 — comparison incl. Age low-wins
FR14: Epic 1 — card transfer, deterministic order
FR15: Epic 1 — winner becomes chooser
FR16: Epic 2 — "opponent is choosing…" waiting state
FR17: Epic 1 — Super Trump auto-win (incl. tie-breakers)
FR18: Epic 1 — Buggy beats Super Trump
FR19: Epic 2 — holder-only trump marker rendering (projection rule from Epic 1)
FR20: Epic 1 — tie → pot
FR21: Epic 1 — tie-breaker, winner takes cards + pot
FR22: Epic 1 — chained ties
FR23: Epic 1 — tie-chain elimination
FR24: Epic 1 — all-32 win condition
FR25: Epic 1 — 100-round cap + sudden death
FR25b: Epic 1 — pot disposition in all end states
FR26: Epic 2 — result screen + rematch
FR27: Epic 3 — persist completed matches
FR28: Epic 3 — recent matches view
FR29: Epic 2 — placeholder card rendering
FR30: Epic 2 — full play surface (top card, counts, pot, turn, result, marker)

Coverage: 31/31 FRs mapped (Epic 1: 16 · Epic 2: 13 · Epic 3: 2). NFR1 → Epic 1; NFR2 → built Epic 1, enforced Epic 2; NFR3, NFR4 → Epic 2; NFR5 → all; NFR6 (local) → Epic 2, remote deferred.

## Epic List

### Epic 1: The Game's Brain — a provably correct rules engine
Danilo (the product's first user) gets a complete, unit-tested, pure TypeScript engine that plays One Piece Top Trumps correctly — every rule from shuffle to Super Trump to tie-chains proven by tests he can walk through in an interview. Includes the monorepo foundation (Story 1.1). Standalone value: the showcase artifact exists before any UI.
**FRs covered:** FR6, FR7, FR9, FR10, FR13, FR14, FR15, FR17, FR18, FR20, FR21, FR22, FR23, FR24, FR25, FR25b

### Epic 2: Play It — two friends battle over a shared link
The playable game: create a match, share the link, nicknames in, stats called out, trumps sprung, disconnect-forfeits handled — through to the result screen and rematch. Express 5 + Socket.IO server wrapping the Epic 1 engine; React client rendering per-player projections. Standalone: fully playable without persistence.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR8, FR11, FR12, FR16, FR19, FR26, FR29, FR30

### Epic 3: Make It Count — match history that survives the night
Finished matches are written to PostgreSQL and surface in a recent-matches list on the home screen. Deliberately small — the SQL/migrations practice ground.
**FRs covered:** FR27, FR28

## Epic 1: The Game's Brain — a provably correct rules engine

Danilo (the product's first user) gets a complete, unit-tested, pure TypeScript engine that plays One Piece Top Trumps correctly — every rule proven by tests he can walk through in an interview. Includes the monorepo foundation. Covers FR6–7, FR9–10, FR13–15, FR17–18, FR20–25b and NFR1.

### Story 1.1: Monorepo foundation with a proven test harness

As Danilo (developer-learner),
I want a hand-built npm-workspaces monorepo with the engine package compiling and one Vitest test passing,
So that every later story starts from a working build-and-test loop.

**Acceptance Criteria:**

**Given** an empty repo
**When** I run `npm install && npm test` at the root
**Then** the engine workspace is discovered, TypeScript 6 compiles it in strict mode (extending `tsconfig.base.json`), and one trivial test passes
**And** `packages/engine/package.json` declares zod as its only dependency

**Given** the root package.json
**When** workspaces resolve
**Then** `packages/*` is the workspace pattern and packages are ESM (`"type": "module"`)

### Story 1.2: The 32-card One Piece deck as typed data

As a player,
I want the authoritative 32-character deck with 8 stats encoded in the game,
So that matches use the exact roster and values from the PRD.

**Acceptance Criteria:**

**Given** the deck module
**When** tests load `onePieceDeck`
**Then** it satisfies the `Deck` interface (theme seam) with exactly 32 unique cards, each with exactly 8 numeric stats matching PRD Appendix A (spot-checked rows asserted: Luffy, Chopper, Dragon, Buggy)
**And** the Age stat is flagged low-wins and all others high-wins (FR13 data)
**And** Buggy carries the `counterCard` flag (FR18 data)
**And** `types.ts` exports Card, StatKey, and Deck used by all later stories

### Story 1.3: Match setup — shuffle, deal, and the Will of D.

As a player,
I want each match set up with a fair shuffle, even deal, and a secret Super Trump,
So that every game starts correct and unpredictable.

**Acceptance Criteria:**

**Given** a seedable injected Rng
**When** `createMatch(deck, players, rng)` runs
**Then** 32 cards are dealt 16/16 face-down with no card lost or duplicated (FR7), the same seed reproduces the same setup, and different seeds differ
**And** one card is selected Super Trump with Buggy never selected across many seeded draws (FR9)
**And** the first chooser is randomly assigned (FR10)
**And** the resulting `MatchState` is a plain immutable value (no classes, no I/O)

### Story 1.4: Round resolution — compare, transfer, pass the turn

As a player,
I want my chosen stat compared correctly and cards transferred to the winner,
So that basic rounds work.

**Acceptance Criteria:**

**Given** a match in progress
**When** the chooser submits `selectStat` via `applyCommand`
**Then** the higher value wins — except Age, where the lower value wins (FR13) — and the winner takes both cards to stack bottom in deterministic order (FR14) and becomes next chooser (FR15)

**Given** a command from the non-chooser, or an invalid stat
**When** applied
**Then** the result is `{ok: false, error}` with a stable error code and state is unchanged (no throws for rule violations)
**And** the round outcome is recorded in state (feeds `lastRound` later)

### Story 1.5: The Super Trump and its Counter

As a player,
I want the Super Trump to dominate any round except against Buggy,
So that the signature mechanic works exactly as the rules say.

**Acceptance Criteria:**

**Given** the Super Trump is played in a round
**When** the round resolves
**Then** its holder wins regardless of stat values (FR17), including tie-breaker rounds

**Given** the Super Trump and Buggy are played in the same round
**When** the round resolves
**Then** Buggy wins instantly (FR18), regardless of who is chooser

### Story 1.6: Ties and the Grand Line pot

As a player,
I want ties to feed a pot claimed by the tie-breaker winner,
So that draws create drama instead of dead ends.

**Acceptance Criteria:**

**Given** equal values (no trump involved)
**When** the round resolves
**Then** both cards enter the pot and the same chooser picks from their next card (FR20–21)

**Given** consecutive ties
**When** they chain
**Then** the pot accumulates correctly (FR22)

**Given** a player with no next card mid-chain
**When** the tie-breaker would start
**Then** that player is eliminated and the opponent collects all cards in play including the pot (FR23)
**And** the tie-break winner receives played cards + the entire pot at stack bottom in deterministic order

### Story 1.7: Match end — every way a game can finish

As a player,
I want matches to end correctly by conquest, attrition cap, or elimination,
So that every game reaches a true result.

**Acceptance Criteria:**

**Given** a player reaches zero cards
**When** state updates
**Then** the opponent holds all 32 cards and the match ends with reason `allCards` (FR24)

**Given** round 100 completes without a winner
**When** evaluated
**Then** the larger stack wins with pot counting for neither player; equal stacks continue sudden-death until the next decided round (FR25)

**Given** any end state
**Then** pot cards go to the winner and exactly 32 cards are accounted for — asserted as an invariant in a long seeded random-play test (FR25b)
**And** the ended state carries `endReason` and rounds played (data for FR26)

### Story 1.8: Projection — what each player is allowed to see

As a player,
I want to receive only my own view of the match,
So that my opponent's cards and the Super Trump's location stay secret.

**Acceptance Criteria:**

**Given** any `MatchState`
**When** `projectFor(state, playerId)` runs
**Then** the `PlayerView` contains own top card, both stack counts, pot count, turn indicator, and `lastRound` reveal — and contains NO opponent card data, NO deck order, NO Super Trump location (NFR2 as assertions)

**Given** the Super Trump is my top card
**Then** my view marks it
**And given** it is anywhere else
**Then** no view reveals it (FR19 mechanism)
**And** a test serializes PlayerView to JSON and asserts forbidden fields are absent

## Epic 2: Play It — two friends battle over a shared link

The playable game: create a match, share the link, nicknames in, stats called out, trumps sprung, disconnect-forfeits handled — through to the result screen and rematch. Express 5 + Socket.IO server wrapping the Epic 1 engine; React client rendering per-player projections. Covers FR1–5, FR8, FR11–12, FR16, FR19, FR26, FR29–30; enforces NFR2 at the wire; verifies NFR3.

### Story 2.1: Client and server come alive with a working dev loop

As Danilo (developer-learner),
I want the client and server packages scaffolded and talking over Socket.IO in dev mode,
So that every later story builds on a live, observable loop.

**Acceptance Criteria:**

**Given** the Epic 1 monorepo
**When** I scaffold `packages/client` via create-vite (react-ts) and hand-build `packages/server` (Express 5 + Socket.IO sharing one `http.Server`)
**Then** `npm run dev` at the root starts both with one command
**And** the client renders a connection status (`connecting | connected | disconnected`) from a single reducer-held enum, proving the socket handshake
**And** the server serves `GET /api/health` → 200 and CORS is locked to the client dev origin

### Story 2.2: Create a match and get a shareable link

As a player,
I want to enter my nickname and create a match that gives me a link to send my friend,
So that we can play together.

**Acceptance Criteria:**

**Given** the home screen
**When** I enter a nickname and click create
**Then** `POST /api/matches` (zod-validated body) returns an unguessable matchId, the client shows the shareable link, and a store entry exists awaiting players (FR1, FR2)
**And** the typed event protocol (`ClientToServerEvents`/`ServerToClientEvents` + zod command schemas) lives in `engine/protocol/` and both sides compile against it — an intentionally wrong event payload is a compile error
**And** the creator joins their own match over the socket and receives a per-player token, with the UI in a "waiting for opponent" state

### Story 2.3: Friend joins, cards are dealt, the table appears

As a player,
I want my friend to open my link, enter a nickname, and have the match start instantly for both of us,
So that we're looking at our own cards within seconds.

**Acceptance Criteria:**

**Given** a match awaiting players
**When** the second player opens the link and joins with a nickname
**Then** the match auto-starts (FR3): the server runs Epic 1's `createMatch` and each client receives `match:state` carrying ONLY its own `PlayerView` (FR4)
**And** the MatchScreen renders my top card as a placeholder card — name + 8 labeled stat values, no artwork (FR29) — plus both stack counts (16/16) and pot count 0 (FR8)
**And** a third joiner is rejected with a typed error (`MATCH_FULL`)
**And** a test or scripted check confirms the serialized payload contains no opponent cards, deck order, or Super Trump location (NFR2 enforced at the wire)

### Story 2.4: Play rounds — choose, call out, reveal, repeat

As a player,
I want to pick a stat on my turn and watch the duel resolve on both screens,
So that we can actually play the game.

**Acceptance Criteria:**

**Given** it is my turn
**When** I tap one of my 8 stat rows
**Then** `match:selectStat` flows zod-parse → `applyCommand` → `projectFor` ×2 → `match:state` ×2, and both screens show the call-out reveal — both played cards, the chosen stat's values, winner highlighted (FR11, FR12) — within ~1s on a local network (NFR3)

**Given** it is NOT my turn
**Then** my stats are locked and I see a clear "opponent is choosing…" state (FR16); a command sent anyway returns a typed error to me only, state unchanged

**Given** my top card is the Super Trump
**Then** I see its marker and my opponent sees nothing until it is played (FR19)
**And** the full surface stays live through ties and trump rounds: top card, counts, pot, turn indicator, last result (FR30)

### Story 2.5: Every ending lands on a result screen — and a rematch

As a player,
I want a clear result screen with a rematch button,
So that finished games end gracefully and grudges can be settled.

**Acceptance Criteria:**

**Given** the engine reports an ended match
**When** clients receive `match:ended`
**Then** both render the ResultScreen: winner, end reason (all cards / round cap), rounds played (FR26)
**And** the match is evicted from the in-memory store after the ended event fires

**Given** both players accept rematch
**Then** a fresh matchId starts a new match between the same two players with a new shuffle and Super Trump

### Story 2.6: Vanishing opponents forfeit — fairly

As a player,
I want to win by forfeit when my opponent truly disconnects, but not when their Wi-Fi hiccups,
So that matches end fairly.

**Acceptance Criteria:**

**Given** the server's Socket.IO config
**Then** `pingInterval`/`pingTimeout` are explicitly set so a vanished client is detected in ≈10s, not the ~45s defaults (FR5)

**Given** my opponent's connection drops past the window (or closes cleanly)
**When** the server detects it
**Then** the match ends with reason `forfeit`, I see the ResultScreen as winner, and the store entry is evicted

**Given** a momentary blip within the window
**Then** the match continues unaffected
**And** a mid-match page refresh counts as a disconnect → forfeit (documented v1 behavior; reconnect is the planned follow-up)

## Epic 3: Make It Count — match history that survives the night

Finished matches are written to PostgreSQL and surface in a recent-matches list on the home screen. Deliberately small — the SQL/migrations practice ground. Covers FR27–28.

### Story 3.1: Finished matches are written to PostgreSQL

As a player,
I want every finished match recorded in a real database,
So that results outlive the server process.

**Acceptance Criteria:**

**Given** a local Postgres (Homebrew) and a zod-validated `DATABASE_URL` in `.env`
**When** I run the migration (node-pg-migrate)
**Then** a `matches` table exists with snake_case columns: `id`, `player_one_nickname`, `player_two_nickname`, `winner_nickname`, `end_reason`, `rounds_played`, `created_at` (TIMESTAMPTZ)

**Given** any match ends — all cards, round cap, or forfeit
**When** the server processes the ending
**Then** `matchRepository.insert(...)` writes one row via hand-written parameterized SQL (FR27), and a DB failure is logged with matchId context but never crashes the server or blocks the `match:ended` emit
**And** SQL exists nowhere outside `matchRepository.ts`; `pool.ts` is the only file importing `pg`

### Story 3.2: Recent matches on the home screen

As a player,
I want to see recent results when I open the game,
So that bragging rights are public record.

**Acceptance Criteria:**

**Given** persisted matches
**When** the home screen loads
**Then** it fetches `GET /api/matches/recent` and renders a simple list — players, winner, end reason, when (FR28)
**And** the endpoint returns the latest N (e.g., 20) ordered newest-first, snake_case columns mapped to camelCase JSON at the repository layer, dates as ISO 8601 strings
**And** an empty database renders a friendly empty state, not an error
