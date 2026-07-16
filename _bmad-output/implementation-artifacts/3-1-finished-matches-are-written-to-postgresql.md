# Story 3.1: Finished matches are written to PostgreSQL

Status: ready-for-dev

<!-- Process note (PRD D23): AI implements this story fully via bmad-dev-story — code, tests,
     commit, PR, review, merge. Danilo approves this spec before dev starts. -->

<!-- Writing note: plain, simple English. Short sentences. Define each new term on first use. -->

## Story

As a player,
I want every finished match recorded in a real database,
so that results outlive the server process.

**Plain-English goal:** Today a finished match lives only in server memory — restart the server and it never happened. This story adds PostgreSQL (a real database) and writes one row per finished match: who played, who won, why the match ended, and when. It is the first half of Epic 3; story 3.2 will read these rows back onto the home screen. This story also pays two debts from the Epic 2 retro: adding a linter and the client test setup.

**Terms used in this story (defined once):**
- **migration** — a versioned SQL script that changes the database schema (here: creates the `matches` table). Run by `node-pg-migrate`. Migrations are how schema changes stay reproducible.
- **repository** — the one server module (`matchRepository.ts`) allowed to contain SQL. Everything else calls its functions. Keeps SQL from leaking through the codebase.
- **pool** — a set of reusable database connections (`pg.Pool`). `pool.ts` is the only file that imports the `pg` library.
- **parameterized SQL** — queries with `$1, $2, …` placeholders instead of string concatenation. Prevents SQL injection.
- **fire-and-forget write** — the insert runs async and errors are logged, never awaited in a way that blocks or crashes the game flow.

## Acceptance Criteria

(Verbatim from epics.md#Story-3.1, split for traceability.)

1. **Given** a local Postgres (Homebrew) and a zod-validated `DATABASE_URL` in `.env`, **when** I run the migration (node-pg-migrate), **then** a `matches` table exists with snake_case columns: `id`, `player_one_nickname`, `player_two_nickname`, `winner_nickname`, `end_reason`, `rounds_played`, `created_at` (TIMESTAMPTZ).
2. **Given** any match ends — all cards, round cap, or forfeit — **when** the server processes the ending, **then** `matchRepository.insert(...)` writes one row via hand-written parameterized SQL (FR27), and a DB failure is logged with matchId context but never crashes the server or blocks the `match:ended` emit.
3. **And** SQL exists nowhere outside `matchRepository.ts`; `pool.ts` is the only file importing `pg`.

## Tasks / Subtasks

- [ ] **Task 1: Epic 3 prep — retro action items (blocking, before any 3.1 code)**
  - [ ] ESLint at the workspace root — ⚠️ do NOT reinvent: `packages/client/eslint.config.js` already exists (flat config, typescript-eslint, react-hooks, react-refresh, eslint ^10 devDeps). Promote to ONE root flat config covering all three packages (keep the react plugins scoped to `packages/client/**`), targeting unused imports/variables and dead code; dedupe the client devDeps into the root. Root script `npm run lint`; must pass on the current codebase (fix any findings it surfaces).
  - [ ] Client test infra: the client currently has NO test config (`vite.config.ts` has no `test` block; root `vitest.config.ts` uses `projects: ['packages/*']`). Add `test: { environment: 'jsdom' }` to the client vite/vitest config and devDeps `jsdom`, `@testing-library/react`, `@testing-library/dom` (explicit peer of RTL v16+). Prove it with the two long-deferred render tests: ResultView shows the forfeit label and hides Rematch when `reason === 'forfeit'`; CardView renders 8 labeled stats. (Closes the 2.3→2.6 deferral chain.)

- [ ] **Task 2: Design decisions BEFORE coding (AC: all) ⚠️ record each in Completion Notes**
  - [ ] **2a — Env loading.** `.env` (gitignored, already covered by `.gitignore`) and `.env.example` live at the **repo root** per the architecture tree. TWO consumers must load it, and workspace scripts run with cwd `packages/server`: (i) the server process — the dev script is `tsx watch src/server.ts`, so a `--env-file` flag must be threaded through tsx/node (note: no `start` script exists today); (ii) `npm run migrate` — node-pg-migrate only auto-loads `.env` if the `dotenv` package is installed; with `--env-file`-only it gets `DATABASE_URL` from nowhere. Decide one mechanism that covers both (installing `dotenv` as a server devDep is the simple answer) and record it with the exact paths.
  - [ ] **2b — Env validation.** `src/config.ts` (the architecture's name for this file — do not invent `env.ts`) parses `process.env` with zod (`DATABASE_URL` required, valid URL). Fail fast with a clear message — but validate from the `server.ts` entry point (or an explicit `loadConfig()` called there), NOT at module import time, so tests importing handler modules never need `DATABASE_URL`. Decide whether the hardcoded `PORT`/`CLIENT_ORIGIN` constants (`server.ts:10-11`, `app.ts:5`) fold into `config.ts` now (trivial) or stay — record either way. Record the schema.
  - [ ] **2c — The insert call site(s).** ⚠️ Matches end in TWO places since story 2.6: the `selectStat` ending (`matchHandlers.ts`, the `result.state.result` branch) and the disconnect forfeit (`matchHandlers.ts`, `case 'forfeit'`). Decide: one shared helper `persistFinishedMatch(entry, finalState)` called from both sites. On the forfeit path it MUST use the local `forfeited` state (not `entry.state`) and run BEFORE `deleteMatch`. Record.
  - [ ] **2d — Fire-and-forget shape.** The insert must never block or crash the emit (AC2). Decide: `void persistFinishedMatch(...).catch(...)` with a `console.error` including the matchId, or an internal try/catch in the helper. Record.
  - [ ] **2e — Winner nickname resolution.** The row stores nicknames, the state stores playerIds. Map `finalState.result.winner` → nickname via `entry.players`. Decide what happens if the lookup fails (should be impossible): log + skip the write vs insert with a placeholder. Record.
  - [ ] **2f — Test strategy for SQL.** Decide: pure mapping helper (entry+state → row object) unit-tested without a DB; the live insert verified by the Task 7 smoke against local Postgres. No mocked-pg theater. Constraint: unit tests must never import `pool.ts`; keep the `pg.Pool` connection-lazy. Record.
  - [ ] **2g — Schema details.** Decide the `id` column type (identity/serial vs uuid) and confirm `end_reason` is TEXT storing the engine `EndReason` strings (`'allCards' | 'roundCap' | 'forfeit'`) verbatim, so story 3.2 reads them back without translation. Record.

- [ ] **Task 3: Database setup (AC: 1)** — `packages/server`
  - [ ] Local Postgres via Homebrew (`brew install postgresql@17`, `brew services start postgresql@17`) and create the dev database (e.g. `createdb card_clash_dev`). Document the exact commands in the root `README.md`.
  - [ ] Add deps to `packages/server`: `pg` (^8.22), `zod` (^4, matching the engine — it is NOT currently a server dependency), `node-pg-migrate` (^8.0.4 — NOT the 9.0 alpha), plus the 2a loader choice (e.g. `dotenv`).
  - [ ] Root `.env.example` (committed): `DATABASE_URL=postgres://localhost:5432/card_clash_dev` (+ `PORT`/`CLIENT_ORIGIN` per decision 2b). `.env` is already gitignored.
  - [ ] `packages/server/src/db/migrations/` + npm script `migrate` wired to node-pg-migrate. First migration creates `matches` exactly per AC1 (snake_case, `id` PK, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`), plus index `idx_matches_created_at` (story 3.2 will read newest-first).

- [ ] **Task 4: The db layer (AC: 2, 3)** — `packages/server/src/db/`
  - [ ] `pool.ts` — creates the `pg.Pool` from the validated env. The ONLY file importing `pg`.
  - [ ] `matchRepository.ts` — `insert(record)` with hand-written parameterized SQL (`INSERT INTO matches (...) VALUES ($1…$5)`). The ONLY file containing SQL. snake_case stays inside this file.
  - [ ] Pure mapping helper (e.g. `toMatchRecord(entry, finalState)`) — extracts `playerOneNickname`, `playerTwoNickname`, `winnerNickname`, `endReason`, `roundsPlayed`. No I/O, unit-testable (2f).

- [ ] **Task 5: Hook both ending sites (AC: 2)** — `packages/server/src/sockets/matchHandlers.ts`
  - [ ] `selectStat` end branch: after `endMatch(...)`, fire-and-forget `persistFinishedMatch(entry, result.state)`. Emit order unchanged.
  - [ ] Disconnect `forfeit` branch: after building the `forfeited` state and emitting, fire-and-forget `persistFinishedMatch(entry, forfeited)` BEFORE `deleteMatch(entry.matchId)`. The defensive `else` branch (null-state forfeit) has no result — do NOT persist a row there.
  - [ ] DB down → both paths still emit `match:ended`, server stays alive, one `console.error` with matchId (AC2).

- [ ] **Task 6: Tests**
  - [ ] Unit: `toMatchRecord` maps a finished entry+state to the camelCase record (both a rules ending and a forfeit ending; winner nickname resolved from players).
  - [ ] Unit: config schema — missing/invalid `DATABASE_URL` rejects, valid URL passes.
  - [ ] Unit: the AC2 failure path — an insert rejection logs (with matchId) and does not throw or affect the emit (retro lesson: error states need a test, not just a smoke).
  - [ ] Client render tests from Task 1 green in `npm test`.
  - [ ] Full suite green (baseline 162 tests), `npm run typecheck`, `npm run lint`, `npm run format`.

- [ ] **Task 7: Prove it (AC: all)**
  - [ ] Fresh DB → `npm run migrate` → `\d matches` in psql shows the AC1 columns.
  - [ ] Play a match to a rules ending → one row appears with correct nicknames/winner/reason/rounds. (Note: the 2.6 socket smoke was an ad-hoc scratchpad script, not a committed artifact — re-script it or verify manually with two tabs.)
  - [ ] Force a forfeit (close one client mid-match) → a row with `end_reason = 'forfeit'` appears; match still evicted.
  - [ ] Stop Postgres → end a match → survivor still gets `match:ended`; server logs the failure with matchId; no crash.
  - [ ] Commit on `story/3.1`, push, PR, `bmad-code-review`, merge per D23.

## Dev Notes

### Working agreement

- AI implements everything (D23). This spec was approved by Danilo before dev. [Source: addendum.md#Working-agreement; .decision-log.md#D23]

### Scope guard — what is NOT in 3.1

- **No reads / no home-screen list** — `GET /api/matches/recent` and its UI are story 3.2 (FR28).
- **No JSONB state snapshots** — the row is flat; JSONB is a future seam, not v1.
- **No retries/queues/transactions** — one fire-and-forget insert; a lost row on DB outage is accepted at v1 stakes.
- **No TTL sweep, no reconnect** — still deferred (`deferred-work.md`).

### Architecture constraints that bind this story

- **Data boundary:** SQL only in `matchRepository.ts`; `pg` imported only by `pool.ts`; the in-memory store and the repository never cross. [Source: architecture.md — Architectural Boundaries]
- **Naming:** table `matches`; columns snake_case; index `idx_matches_created_at`; repository maps snake_case ↔ camelCase; SQL never leaks past it. JSON dates as ISO 8601, column as TIMESTAMPTZ. [Source: architecture.md — Naming/Format Patterns]
- **Flow:** "On match end: additionally `matchRepository.insert(...)` (FR27) and `match:ended` event" — insert must never delay or replace the emit. [Source: architecture.md — Data Flow]
- **Config:** env vars via `.env` locally, 12-factor style; zod validation at every boundary — env included. [Source: architecture.md — Infrastructure; Data Architecture]
- **Stack pins:** raw `pg` + hand-written SQL (no ORM — SQL fluency is the practice target); node-pg-migrate with SQL-flavored migrations; Postgres via Homebrew. [Source: architecture.md — Data Architecture; verified current versions: pg 8.22.0, node-pg-migrate 8.0.4 stable]

### Previous work intelligence (story 2.6 + retro)

- **Two ending sites exist** (the retro's critical-path finding): `matchHandlers.ts` `match:selectStat` handler (endMatch → emit `match:ended` per player) and the `disconnect` handler's `forfeit` case (forfeitMatch → projectFor → emit → `deleteMatch`). The forfeit path EVICTS immediately after emitting — read everything you need before `deleteMatch`, and use the local `forfeited` state (with `result.reason === 'forfeit'`), because `entry.state` was never updated on that path.
- **Store shapes:** `MatchEntry { matchId, status, players: Player[]{playerId, token, nickname, socketId}, createdAt, state, rematchAccepted }`. Nicknames come from `entry.players`; winner playerId from `finalState.result.winner`; rounds from `finalState.roundsPlayed`.
- **Rematch reuses the same entry** — a rematch that finishes ends through the same `selectStat` branch, producing a second row for the same matchId. That is correct (one row per finished match, not per entry); `id` is the row PK, matchId is not stored in v1 (per AC1 column list).
- **Pure-helper pattern works:** `resolveDisconnect` (2.6) kept socket logic testable; `toMatchRecord` follows the same pattern for the DB.
- **Error-visibility lesson (Epic 2 retro):** every error state must be visible somewhere. Here the "visible" surface is the server log — the AC2 log line with matchId is a requirement, not a nice-to-have.
- **Hygiene lesson:** ESLint lands in Task 1 because the unused-import/dead-code class recurred all epic with no automation.

### Project Structure Notes

- New (server): `src/config.ts` (architecture's name — zod-validated env, fail-fast from the entry point) · `src/db/pool.ts` · `src/db/matchRepository.ts` (+ pure mapper + tests) · `src/db/migrations/*`.
- Update (server): `src/server.ts` (config load) · `src/sockets/matchHandlers.ts` (two call sites) · `package.json` (deps: `pg`, `zod`, `node-pg-migrate`, loader; `migrate` script).
- New/Update (root): promote `packages/client/eslint.config.js` into one root flat config + `lint` script (dedupe client devDeps); `.env.example` (`.gitignore` already covers `.env`).
- Update (client): vite/vitest config (`test: { environment: 'jsdom' }`) + `jsdom`, `@testing-library/react`, `@testing-library/dom` devDeps; new `ResultView.test.tsx`, `CardView.test.tsx`.
- Matches the architecture tree (`db/` = repository + migrations). [Source: architecture.md — Complete Project Directory Structure]

### References

- [Source: epics.md#Story-3.1] — story statement + ACs (verbatim)
- [Source: architecture.md — Data Architecture; Architectural Boundaries; Naming/Format Patterns; Data Flow; Infrastructure & Deployment]
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md — FR27; NFR5]
- [Source: implementation-artifacts/epic-2-retro-2026-07-16.md] — action items 1–4 (ESLint, jsdom infra, error visibility, dual ending sites)
- [Source: implementation-artifacts/2-6-vanishing-opponents-forfeit-fairly.md] — forfeit path, eviction ordering, store helpers
- [Source: .decision-log.md#D23] — AI implements; Danilo approves

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

Decisions (fill at implementation):
- 2a — env loading (server process + migrate script, root `.env`):
- 2b — config.ts zod schema; PORT/CLIENT_ORIGIN in or out:
- 2c — insert call sites / shared helper:
- 2d — fire-and-forget shape:
- 2e — winner nickname resolution + failure behavior:
- 2f — SQL test strategy (no pool.ts imports in unit tests):
- 2g — id column type; end_reason as verbatim EndReason TEXT:

### File List
