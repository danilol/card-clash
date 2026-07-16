# Story 3.2: Recent matches on the home screen

Status: ready-for-dev

<!-- Process note (PRD D23): AI implements this story fully via bmad-dev-story — code, tests,
     commit, PR, review, merge. Danilo approves this spec before dev starts. -->

<!-- Writing note: plain, simple English. Short sentences. Define each new term on first use. -->

## Story

As a player,
I want to see recent results when I open the game,
so that bragging rights are public record.

**Plain-English goal:** Story 3.1 writes every finished match to PostgreSQL. This story reads them back: the home screen shows a simple list of the latest results — who played, who won, how the match ended, and when. This is the **last story of the v1 plan** — when it merges, Epic 3 and the whole roadmap are done.

**Terms used in this story (defined once):**
- **row mapper** — a pure function that turns one database row (snake_case columns, `Date` objects) into the JSON shape the client gets (camelCase, ISO 8601 date strings). Lives in the repository layer so SQL naming never leaks out.
- **empty state** — what the UI shows when the list has zero items: a friendly message, not an error and not a blank hole.

## Acceptance Criteria

(Verbatim from epics.md#Story-3.2, split for traceability.)

1. **Given** persisted matches, **when** the home screen loads, **then** it fetches `GET /api/matches/recent` and renders a simple list — players, winner, end reason, when (FR28).
2. **And** the endpoint returns the latest N (e.g., 20) ordered newest-first, snake_case columns mapped to camelCase JSON at the repository layer, dates as ISO 8601 strings.
3. **And** an empty database renders a friendly empty state, not an error.

## Tasks / Subtasks

- [ ] **Task 1: Design decisions BEFORE coding (AC: all) ⚠️ record each in Completion Notes**
  - [ ] **1a — List size.** `RECENT_MATCHES_LIMIT = 20` as a SCREAMING_SNAKE_CASE constant in the repository module. Record.
  - [ ] **1b — Response shape.** `GET /api/matches/recent` → `200` with a JSON array of `{ id, playerOneNickname, playerTwoNickname, winnerNickname, endReason, roundsPlayed, createdAt }` where `createdAt` is an ISO 8601 string. Mapping (snake→camel, Date→ISO) happens in the row mapper inside the repository (AC2). Record.
  - [ ] **1c — DB failure on the read path.** The home screen must stay usable when the DB is down (same spirit as 3.1's AC2). Decide: route catches, logs `[db]` with context, returns `500` with the shared error shape (`{ error: { code, message } }`). Pick the code (e.g. `DB_UNAVAILABLE`) and decide whether it joins `WireErrorCode` in the engine protocol (recommended for one shared error vocabulary) or stays a REST-only literal. Record.
  - [ ] **1d — Client fetch + failure UX.** HomeScreen already calls `http://localhost:3000/api/matches` (hardcoded base) — the new fetch uses the same base and style (`useEffect` on mount). On fetch/HTTP failure: show a small, visible, non-blocking line (retro lesson: error states are visible + tested) — it must NOT block the create-match form. Record. (A shared API-base constant for the client is a nice-to-have — decide in or out; if out, note it as deferred.)
  - [ ] **1e — Reason labels.** ResultView has a private `REASON_LABEL` map (`allCards`/`roundCap`/`forfeit` → text). The list needs the same labels — extract to one shared client module (e.g. `src/components/reasonLabels.ts`) instead of duplicating. Record.
  - [ ] **1f — "When" display.** Keep it simple: render the ISO date with `toLocaleString()` (no relative-time library). Record.
  - [ ] **1g — Route test strategy.** Route tests use supertest against `app` (existing pattern in `routes/matches.test.ts`) with `vi.mock` at the **repository module** seam — the architectural boundary — so no test opens a DB connection. Not mocked-pg theater: the repository itself stays covered by the pure row-mapper unit tests + the live smoke. Record.

- [ ] **Task 2: Repository read (AC: 2)** — `packages/server/src/db/`
  - [ ] `matchRepository.ts`: add `findRecent(): Promise<RecentMatch[]>` — hand-written parameterized SQL: `SELECT id, player_one_nickname, …, created_at FROM matches ORDER BY created_at DESC, id DESC LIMIT $1` (the `id DESC` tiebreak keeps same-timestamp rows stable). Uses `idx_matches_created_at` from 3.1. SQL stays ONLY in this file.
  - [ ] Pure row mapper `rowToRecentMatch(row)` (exported for tests, may live beside `toMatchRecord` in `matchRecord.ts`): snake_case → camelCase, `created_at` (`Date`) → ISO 8601 string, `end_reason` typed as engine `EndReason`.

- [ ] **Task 3: The endpoint (AC: 1, 2)** — `packages/server/src/routes/matches.ts`
  - [ ] `matchesRouter.get('/api/matches/recent', …)` → `findRecent()` → `200` array. No zod needed (no request input).
  - [ ] DB failure → log `[db] recent matches: …` + `500` with the shared error shape (decision 1c). Server never crashes.

- [ ] **Task 4: Home screen list (AC: 1, 3)** — `packages/client/src/components/`
  - [ ] Extract `REASON_LABEL` to the shared module (1e); ResultView imports it (no behavior change).
  - [ ] `RecentMatches` component (own file — keeps HomeScreen readable): fetches on mount, renders one line per match — "PlayerOne vs PlayerTwo — Winner won · Reason · date". States: list / **empty** ("No matches yet — play the first one!") / **fetch-failed** (small visible line, form still usable).
  - [ ] Render it from HomeScreen below the create form.

- [ ] **Task 5: Tests**
  - [ ] Unit (server): `rowToRecentMatch` maps a full row (snake→camel, Date→ISO string, reason verbatim).
  - [ ] Route (supertest + `vi.mock` repository): 200 with mapped list; 200 `[]` when empty; repository rejection → 500 shared error shape + no crash (error-path test, retro lesson).
  - [ ] Render (client, jsdom infra from 3.1, mock `fetch`): list renders players/winner/reason; empty array → friendly empty state (AC3); rejected fetch → visible non-blocking error line and the nickname input still present.
  - [ ] Full suite green (baseline 178), `npm run typecheck`, `npm run lint`, `npm run format`.

- [ ] **Task 6: Prove it (AC: all)**
  - [ ] Server up → `curl http://localhost:3000/api/matches/recent` returns the rows written during the 3.1 smoke, newest first, ISO dates.
  - [ ] `npm run dev` → home screen shows the list under the create form.
  - [ ] Stop Postgres (or dead `DATABASE_URL` server run) → home screen still lets you create a match; the list area shows the small failure line; server logs one `[db]` line, no crash.
  - [ ] Commit on `story/3.2`, push, PR, `bmad-code-review`, merge per D23. This closes Epic 3.

## Dev Notes

### Working agreement

- AI implements everything (D23). This spec was approved by Danilo before dev. [Source: addendum.md#Working-agreement; .decision-log.md#D23]

### Scope guard — what is NOT in 3.2

- **No pagination, no auto-refresh/polling, no match-detail view** — latest-20 static list, fetched once on mount.
- **No styling effort** — placeholder UI like the rest of the client (counter-metric: time-to-playable).
- **No schema changes** — reads exactly the 3.1 table. The deferred `match_id`/nickname-ambiguity items stay deferred.
- **No API-base/config refactor** beyond decision 1d — the hardcoded `http://localhost:3000` pattern is pre-existing.

### Architecture constraints that bind this story

- **REST for history:** `GET /api/matches/recent` — lowercase plural resource under `/api`; no gameplay over REST. [Source: architecture.md — API & Communication Patterns; Naming Patterns]
- **Data boundary:** SQL only in `matchRepository.ts`; `pg` only in `pool.ts` (already lazy, has error listener + connection timeout from the 3.1 review). The repository maps snake_case ↔ camelCase; SQL never leaks past it. [Source: architecture.md — Architectural Boundaries]
- **Format:** REST success = direct payload + 200; errors share `{ error: { code, message } }`; dates TIMESTAMPTZ in Postgres, ISO 8601 strings in JSON. [Source: architecture.md — Format Patterns]
- **FR28 → server `db/` + route; client `components/`.** [Source: architecture.md — Requirements to Structure Mapping]

### Previous work intelligence (story 3.1)

- `matchRepository.ts` currently has only `insertMatch`; `pool.ts` exports lazy `getPool()`. Reuse `getPool()` — do not touch pool config.
- `matchRecord.ts` holds the pure write-side mapper `toMatchRecord` + `MatchRecord` type — the read-side `rowToRecentMatch` follows the same pattern (decision 2f of 3.1: pure mappers unit-tested, no mocked pg).
- pg returns `TIMESTAMPTZ` as a JS `Date` — the ISO conversion is `row.created_at.toISOString()`.
- ⚠️ pg returns `BIGINT` (`id`, int8) as a **string**, not a number (precision safety). The row mapper must pick one: `id: Number(row.id)` (fine — identity values stay far below 2^53) or expose it as a string. Decide + record (1b).
- Route tests exist at `routes/matches.test.ts` (supertest against `app`); `app.ts` must stay importable without env (config is only loaded in `server.ts`) — the new route must not import config at module level (the repository chain is already lazy).
- Client test infra (jsdom + Testing Library, `globals: true`) landed in 3.1 — mock `fetch` with `vi.stubGlobal('fetch', …)` or `vi.spyOn(globalThis, 'fetch')`.
- The 3.1 smoke left real rows in `card_clash_dev` (incl. a `forfeit` one) — Task 6's curl has data to show.

### Project Structure Notes

- Update (server): `src/db/matchRepository.ts` (findRecent) · `src/db/matchRecord.ts` (rowToRecentMatch + type + tests) · `src/routes/matches.ts` (+ `matches.test.ts` additions).
- Update (engine, only if 1c adds the wire code): `src/protocol/events.ts`.
- New (client): `src/components/RecentMatches.tsx` (+ test) · `src/components/reasonLabels.ts`.
- Update (client): `src/components/HomeScreen.tsx` (render list) · `src/components/ResultView.tsx` (import shared labels).

### References

- [Source: epics.md#Story-3.2] — story statement + ACs (verbatim)
- [Source: architecture.md — API & Communication Patterns; Architectural Boundaries; Naming/Format Patterns; Requirements to Structure Mapping]
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md — FR28]
- [Source: implementation-artifacts/3-1-finished-matches-are-written-to-postgresql.md] — db layer, decisions 2a–2g, review patches (pool hardening)
- [Source: implementation-artifacts/epic-2-retro-2026-07-16.md] — error-visibility lesson (visible + tested)
- [Source: .decision-log.md#D23] — AI implements; Danilo approves

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

Decisions (fill at implementation):
- 1a — limit constant:
- 1b — response shape / ISO mapping in the row mapper:
- 1c — DB-failure code + WireErrorCode in or out:
- 1d — client fetch base + failure UX; API-base constant in or out:
- 1e — shared reason labels:
- 1f — date display:
- 1g — route test strategy (vi.mock at the repository seam):

### File List
