---
title: Card Clash — One Piece Top Trumps (PRD)
status: final
created: 2026-06-10
updated: 2026-06-10
---

# Card Clash — One Piece Top Trumps

## 1. Overview & Vision

Card Clash is a browser-based digital Top Trumps game themed on One Piece — two-player in v1, with more players to come. Two friends connect to the same match over the internet, each holding half of a 32-card character deck, and battle round by round, comparing character stats until one player holds every card and becomes the Pirate King.

The product exists for two reasons, in this order:

1. **Learning vehicle.** It is Danilo's practice ground for modern JavaScript/TypeScript engineering ahead of job interviews. The game's rules engine, real-time 1v1 play, and persistence layer are deliberately chosen to exercise interview-relevant skills.
2. **A genuinely playable game.** It must be fun enough that a friend will actually play a full match over a shared link.

v1 is intentionally small: one hardcoded theme (One Piece), one hardcoded deck, 1v1 only, minimal placeholder UI. A later version envisions multiple themes with configurable card values and layouts — explicitly out of scope now (see §7).

## 2. Goals & Success Criteria

| Goal | Success looks like |
|---|---|
| Playable v1 | A full 1v1 match can be played end-to-end in a browser by two people on different machines, via a shared link. |
| Interview-ready engineering | The game rules are implemented as an isolated, unit-tested engine Danilo can walk through in an interview. |
| Persistence in practice | Completed match results are stored in and read back from a real database. |
| Incremental growth | The v1 design doesn't block later features (themes, reconnect, accounts) — they extend, not rewrite. |

**Counter-metric:** time-to-playable. If polishing any feature delays the first complete friend-vs-friend match, the feature loses. Gold-plating is the failure mode this project must avoid.

**Development approach (binding constraint):** Danilo writes all code himself. AI assistance is limited to guidance — tutorial-style steps, pointing direction, design discussion, and code review. Auto-generated implementation code is explicitly out of bounds: hand-written code is the point of the project, not a means to it. A feature delivered as generated code counts as a failure against the "interview-ready engineering" goal, even if it works.

## 3. Scope

**In scope (v1):** 1v1 online match via shared link; full rules in §5; hardcoded 32-card One Piece deck (Appendix A); placeholder card UI (name + stat rows); match results persisted to a database.

**Out of scope (v1):** multiple themes and configurable cards/layouts; accounts and authentication; matchmaking/open lobby; more than 2 players; reconnect/grace period (instant forfeit instead); card artwork; spectating; chat; sound.

## 4. Players & Sessions

There is one user type: a casual player who receives or creates a match link. No accounts exist.

- **FR1.** A player identifies themselves with a self-chosen nickname only; no registration, login, or authentication.
- **FR2.** A player can create a new match and receive a shareable link (or a short room code embedded in a link).
- **FR3.** A second player opens the link, enters a nickname, and joins; the match starts automatically once two players are present.
- **FR4.** The server is the single source of truth for match state; a client is never sent information its player shouldn't see (opponent's cards, deck order, Super Trump location).
- **FR5.** When the server determines a player has left the match — connection closed, or unresponsive beyond a short detection window (~10 seconds) — the match ends and the remaining player wins by forfeit. Momentary blips within the window are not a forfeit. *(A true grace-period reconnect is the first planned follow-up — see §7.)*

## 5. Game Rules (Functional Requirements)

### 5.1 Deck & Match Setup

- **FR6.** The game ships with exactly 32 hardcoded One Piece character cards, each with the same 8 stats: Bounty, Age, Haki, Loyalty/Honor, Devil Fruit Mastery, Fear Factor, Speed/Agility, Battle IQ. Authoritative values in Appendix A.
- **FR7.** At match start the deck is shuffled and dealt evenly, 16 cards per player, face-down stacks.
- **FR8.** Each player sees only their own current top card. Both players always see both stack counts and the pot count.
- **FR9.** At match start the system randomly selects one card as the **Super Trump** ("the Will of D.") for that match only. Buggy the Clown is excluded from this draw — the Counter card can never also be the Super Trump; redraw if selected.
- **FR10.** The first chooser is selected at random.

### 5.2 Round Play

- **FR11.** The chooser selects one of the 8 stats on their top card.
- **FR12.** Both top cards and the chosen stat's values are then revealed to both players, with the winning value clearly indicated. The reveal is presented as the chooser's call-out (e.g., *"Bounty: 3 Billion!"*), preserving the read-aloud spirit of the tabletop rules.
- **FR13.** The higher value wins the round — except **Age**, where the lower value wins (the deck's one "low-stat wins" category).
- **FR14.** The round winner takes both played cards and places them at the bottom of their stack (deterministic order: own card first, then opponent's, then any pot cards in play order).
- **FR15.** The round winner becomes the next chooser.
- **FR16.** While the chooser is deciding, the opponent sees their own top card with stats locked and a clear "opponent is choosing…" state.

### 5.3 Super Trump — the Will of D.

- **FR17.** The Super Trump card automatically wins any round in which it is played, regardless of the chosen stat's values. This includes tie-breaker rounds.
- **FR18.** **The exception:** if the Super Trump and Buggy the Clown (the fixed Counter card) are played in the same round, Buggy wins the round instantly.
- **FR19.** The Super Trump's identity is known to its holder only: the card is visibly marked as Super Trump only when it is the top card of its current holder's stack. The opponent learns it only when it's played against them.

### 5.4 Ties — the Grand Line Pot

- **FR20.** If both played values are equal (and no Super Trump rule applies), both cards move to a central pot.
- **FR21.** The same chooser picks a new stat from their next top card; the winner of that round takes both played cards **plus** the entire pot.
- **FR22.** Ties can chain: repeated ties keep growing the pot under the same rules.
- **FR23.** A player who has no next card to continue a tie-breaker is eliminated and loses the match; the opponent collects all cards in play, including the pot.

### 5.5 Match End

- **FR24.** A player with zero cards is eliminated; in 1v1 the opponent thereby holds all 32 cards and wins.
- **FR25.** *(Safety valve.)* If a match reaches 100 completed rounds, it ends and the player holding more cards in their stack wins (pot cards count for neither player); if stacks are equal, play continues in sudden death until the next decided round. (Research on Top Trumps clones shows pure attrition can loop indefinitely; digital versions add a cap.)
- **FR25b.** In every end state — all cards collected, forfeit, or round cap — any cards still in the pot go to the match winner, so the full 32-card deck is always accounted for.
- **FR26.** A result screen shows the winner, end reason (all cards / forfeit / round cap), and rounds played, and offers a rematch with the same opponent.

### 5.6 Persistence

- **FR27.** Completed matches are persisted to a database: both nicknames, winner, end reason, rounds played, and timestamp.
- **FR28.** A minimal "recent matches" view exists so persisted data is visible in the product, not just in the database.

### 5.7 Presentation (v1 placeholder UI)

- **FR29.** A card renders as a simple placeholder: character name plus its 8 labeled stat values. No artwork.
- **FR30.** The UI surfaces, at minimum: own top card, both stack counts, pot count, whose turn it is, the round comparison result, and the Super Trump marker (per FR19).

## 6. Non-Functional Requirements

- **NFR1.** The rules engine must be deterministic and fully exercisable by unit tests in isolation from networking and UI. *(This is a product requirement here, not just engineering preference — the engine is the interview artifact.)*
- **NFR2.** Hidden-information integrity: opponent cards, deck order, and Super Trump location must never reach a client that shouldn't see them (server-authoritative state, per FR4).
- **NFR3.** A round action is reflected on both players' screens within ~1 second on a typical home connection.
- **NFR4.** Works on current evergreen desktop browsers; desktop-first, usable (not optimized) on mobile.
- **NFR5.** No personal data beyond self-chosen nicknames is collected or stored.
- **NFR6.** The whole product can run on Danilo's machine for local play and on a single small remote host for internet play.

## 7. Future Direction (explicitly not v1)

In rough priority order, as stated or implied by the product owner:

1. **Grace-period reconnect** — replace instant forfeit with a short reconnection window (first follow-up after v1).
2. **More than 2 players** — the rules already describe clockwise multi-player flow; 1v1 is a v1 simplification, not the product's shape. The rules engine should not bake in the two-player assumption where avoiding it is cheap.
3. **Multi-theme support** — themes beyond One Piece, with configurable card values and layouts (the stated "advanced version" vision from §1).
4. Candidates surfaced during discovery, unranked: accounts & per-player match history; richer card layouts/artwork; turn timers with auto-pick.

## 8. Open Items

All draft assumptions (Super Trump redraw, round cap, normalizations including Dragon's bounty at 5,000,000,000, random first chooser, rematch, recent-matches view, desktop-first) were reviewed and confirmed by Danilo on 2026-06-10.

- **OQ1.** One Piece is licensed IP. Irrelevant for private play among friends; revisit naming/branding if this becomes a public portfolio piece.
- **NOTE FOR PM:** with Age as low-wins and Marines carrying Bounty 0, some cards are strong in counterintuitive ways (e.g., Chopper, age 17, wins almost any Age round). Treated as charm, not a bug; revisit only if playtests say otherwise.

## Appendix A — The 32-Card Deck (normalized, authoritative for v1)

Normalization rules applied to the source chart (confirmed by Danilo, 2026-06-10): every stat is a single number; parenthetical annotations are dropped and the primary number kept (Usopp's Fear Factor is 15, not the "fake 99"; Jinbe's Speed is 65, not his in-water 92); "No DF" → Devil Fruit Mastery 0; Marine bounty "0" kept as 0; deceased characters' listed ages used as-is; Dragon's "Unknown" bounty set to **5,000,000,000**. Amendment (Danilo, 2026-06-11, during Story 1.2 review): row #31 display name expanded from `Sabo` to `"Flame Emperor" Sabo`.

| # | Character | Bounty | Age | Haki | Loyalty/Honor | Devil Fruit Mastery | Fear Factor | Speed/Agility | Battle IQ |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Monkey D. Luffy | 3,000,000,000 | 19 | 92 | 98 | 97 | 88 | 94 | 40 |
| 2 | Roronoa Zoro | 1,111,000,000 | 21 | 88 | 100 | 0 | 89 | 82 | 45 |
| 3 | Nami | 366,000,000 | 20 | 5 | 85 | 0 | 40 | 65 | 92 |
| 4 | Usopp | 500,000,000 | 19 | 30 | 80 | 0 | 15 | 75 | 85 |
| 5 | Vinsmoke Sanji | 1,032,000,000 | 21 | 80 | 95 | 0 | 78 | 95 | 88 |
| 6 | Tony Tony Chopper | 1,000 | 17 | 0 | 98 | 85 | 5 | 70 | 80 |
| 7 | Nico Robin | 930,000,000 | 30 | 10 | 95 | 88 | 72 | 60 | 95 |
| 8 | Franky | 394,000,000 | 36 | 0 | 95 | 0 | 65 | 50 | 84 |
| 9 | Brook | 383,000,000 | 90 | 15 | 95 | 75 | 50 | 96 | 70 |
| 10 | Jinbe | 1,100,000,000 | 46 | 82 | 100 | 0 | 80 | 65 | 86 |
| 11 | Shanks | 4,048,900,000 | 39 | 100 | 95 | 0 | 96 | 95 | 94 |
| 12 | Marshall D. Teach | 3,996,000,000 | 40 | 78 | 5 | 98 | 95 | 68 | 92 |
| 13 | Buggy the Clown ⚓ | 3,189,000,000 | 39 | 10 | 15 | 60 | 85 | 70 | 50 |
| 14 | Dracule Mihawk | 3,590,000,000 | 43 | 95 | 75 | 0 | 94 | 90 | 89 |
| 15 | Sir Crocodile | 1,965,000,000 | 46 | 70 | 25 | 90 | 86 | 75 | 93 |
| 16 | Gol D. Roger | 5,564,800,000 | 53 | 100 | 95 | 0 | 98 | 96 | 92 |
| 17 | Edward Newgate | 5,046,000,000 | 72 | 98 | 98 | 96 | 97 | 60 | 90 |
| 18 | Kaido | 4,611,100,000 | 59 | 96 | 40 | 95 | 99 | 80 | 75 |
| 19 | Charlotte Linlin | 4,388,000,000 | 68 | 94 | 35 | 95 | 97 | 70 | 70 |
| 20 | Trafalgar D. Water Law | 3,000,000,000 | 26 | 82 | 88 | 96 | 84 | 88 | 96 |
| 21 | Eustass Kid | 3,000,000,000 | 23 | 80 | 85 | 88 | 87 | 74 | 68 |
| 22 | Boa Hancock | 1,659,000,000 | 31 | 82 | 90 | 92 | 89 | 88 | 80 |
| 23 | Donquixote Doflamingo | 340,000,000 | 41 | 80 | 20 | 95 | 90 | 90 | 94 |
| 24 | Portgas D. Ace | 550,000,000 | 20 | 78 | 95 | 88 | 85 | 86 | 74 |
| 25 | Monkey D. Garp | 0 | 78 | 96 | 90 | 0 | 92 | 84 | 82 |
| 26 | Sakazuki (Akainu) | 0 | 55 | 90 | 60 | 96 | 96 | 78 | 88 |
| 27 | Kuzan (Aokiji) | 3,000,000,000 | 49 | 88 | 50 | 94 | 90 | 85 | 87 |
| 28 | Borsalino (Kizaru) | 0 | 58 | 86 | 70 | 93 | 88 | 100 | 80 |
| 29 | Bartholomew Kuma | 296,000,000 | 47 | 75 | 100 | 95 | 88 | 92 | 85 |
| 30 | Monkey D. Dragon | 5,000,000,000 | 55 | 95 | 90 | 90 | 95 | 90 | 96 |
| 31 | "Flame Emperor" Sabo | 602,000,000 | 22 | 84 | 98 | 75 | 84 | 89 | 86 |
| 32 | Mr. 2 Bon Clay | 32,000,000 | 32 | 0 | 100 | 80 | 45 | 82 | 78 |

⚓ Buggy is the fixed **Counter card** (beats the Super Trump, per FR18). Stats: Age is low-wins; all others high-wins.
