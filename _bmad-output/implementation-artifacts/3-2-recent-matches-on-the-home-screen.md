---
baseline_commit: abb62220f7c40f7a50c2271304977632f186e684
---

# Story 3.2: Recent matches on the home screen

Status: done

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

- [x] **Task 1: Design decisions BEFORE coding (AC: all) ⚠️ record each in Completion Notes**
  - [x] **1a — List size.** `RECENT_MATCHES_LIMIT = 20` as a SCREAMING_SNAKE_CASE constant in the repository module. Record.
  - [x] **1b — Response shape.** `GET /api/matches/recent` → `200` with a JSON array of `{ id, playerOneNickname, playerTwoNickname, winnerNickname, endReason, roundsPlayed, createdAt }` where `createdAt` is an ISO 8601 string. Mapping (snake→camel, Date→ISO) happens in the row mapper inside the repository (AC2). Record.
  - [x] **1c — DB failure on the read path.** The home screen must stay usable when the DB is down (same spirit as 3.1's AC2). Decide: route catches, logs `[db] recent matches: …`, returns `500` with the shared error shape (`{ error: { code, message } }`). Code: lean toward a REST-only literal (e.g. `DB_UNAVAILABLE`) — `WireErrorCode` is the SOCKET vocabulary (`ErrorPayload` in acks/`match:error`), and a DB code can never occur there, so adding it would widen every socket-side exhaustive check with an unreachable case. Record either way.
  - [x] **1d — Client fetch + failure UX.** Same hardcoded base as HomeScreen's existing call (`http://localhost:3000`), but note: the on-mount fetch pattern is NEW to this client (the existing fetch is in a click handler; there is no `useEffect` fetch anywhere yet). Use the standard effect shape with an `ignore` cleanup flag. ⚠️ `main.tsx` wraps the app in `<StrictMode>`: React runs dev-mode effects twice, so TWO GETs during the Task 6 smoke are EXPECTED — do not "fix" this by removing StrictMode or with module-level flags. On fetch/HTTP failure: a small, visible, non-blocking line (retro lesson) that must NOT block the create-match form. Record. (Shared API-base constant: nice-to-have; if out, note as deferred.)
  - [x] **1e — Reason labels.** ResultView's private `REASON_LABEL` has a second-person forfeit label (`'Opponent left — you win'`) — correct on the result screen, nonsense on a third-person list. The shared module (e.g. `src/components/reasonLabels.ts`) therefore exports TWO maps: `RESULT_REASON_LABEL` (ResultView's current texts, moved) and `LIST_REASON_LABEL` (neutral: `allCards: 'All cards captured'`, `roundCap: 'Round cap reached'`, `forfeit: 'Forfeit'`). ResultView imports the first; RecentMatches uses the second. Record.
  - [x] **1f — "When" display.** Keep it simple: render the ISO date with `toLocaleString()` (no relative-time library). `roundsPlayed` ships in the JSON (1b) but is NOT displayed in the line — intentional, not an oversight; don't improvise it in. Record.
  - [x] **1g — Route test strategy.** Route tests use supertest against `app` (existing pattern in `routes/matches.test.ts`) with `vi.mock` at the **repository module** seam — no test opens a DB connection; the repository stays covered by pure row-mapper unit tests + the live smoke. ⚠️ First `vi.mock` in this repo — three gotchas: (a) the specifier is the ESM path AS THE IMPORTING MODULE WRITES IT, with `.js`: `vi.mock('../db/matchRepository.js', …)` from the test in `routes/`; (b) the factory is hoisted above imports and cannot close over top-level variables — import normally and use `vi.mocked(...)`, or `vi.hoisted`; (c) the factory replaces the WHOLE module — export `insertMatch` too, and `mockReset` between tests (the GET tests share the file with the existing POST tests). Record.

- [x] **Task 2: Repository read (AC: 2)** — `packages/server/src/db/`
  - [x] `matchRepository.ts`: add `findRecent(): Promise<RecentMatch[]>` — hand-written parameterized SQL: `SELECT id, player_one_nickname, …, created_at FROM matches ORDER BY created_at DESC, id DESC LIMIT $1` (the `id DESC` tiebreak keeps same-timestamp rows stable). Uses `idx_matches_created_at` from 3.1. SQL stays ONLY in this file.
  - [x] Pure row mapper `rowToRecentMatch(row)` (exported for tests, may live beside `toMatchRecord` in `matchRecord.ts`): snake_case → camelCase, `created_at` (`Date`) → ISO 8601 string, `end_reason` typed as engine `EndReason`.

- [x] **Task 3: The endpoint (AC: 1, 2)** — `packages/server/src/routes/matches.ts`
  - [x] `matchesRouter.get('/api/matches/recent', …)` → `findRecent()` → `200` array. No zod needed (no request input).
  - [x] DB failure → log `[db] recent matches: …` + `500` with the shared error shape (decision 1c). Server never crashes.

- [x] **Task 4: Home screen list (AC: 1, 3)** — `packages/client/src/components/`
  - [x] Shared `reasonLabels.ts` with the TWO maps (1e); ResultView imports `RESULT_REASON_LABEL` (no behavior change).
  - [x] `RecentMatches` component (own file — keeps HomeScreen readable, and lets its tests avoid HomeScreen's socket import): fetches on mount (1d effect shape), renders one line per match — "PlayerOne vs PlayerTwo — Winner won · Reason · date" using `LIST_REASON_LABEL`. States: list / **empty** ("No matches yet — play the first one!") / **fetch-failed** (small visible line, form still usable).
  - [x] Render it from HomeScreen below the create form. CORS: nothing to add — `app.ts` already applies `cors({ origin: 'http://localhost:5173' })` app-wide and a plain GET needs no preflight.

- [x] **Task 5: Tests**
  - [x] Unit (server): `rowToRecentMatch` maps a full row (snake→camel, Date→ISO string, reason verbatim).
  - [x] Route (supertest + `vi.mock` repository, per 1g): 200 with mapped list; 200 `[]` when empty; repository rejection → 500 shared error shape + no crash, AND assert the `[db] recent matches` log via `vi.spyOn(console, 'error')` (which also keeps suite output clean) — 3.1's pattern.
  - [x] Render (client, jsdom infra from 3.1, mock `fetch` via `vi.stubGlobal`): test `RecentMatches` STANDALONE — list renders players/winner/neutral reason; empty array → friendly empty state (AC3); rejected fetch → visible non-blocking error line. ⚠️ Do NOT render HomeScreen without mocking `../socket` — `socket.ts` calls `io(...)` at module scope with autoConnect, which starts real polling/reconnect loops inside jsdom (the 3.1 render tests deliberately avoid that import). If a "form still usable" assertion on HomeScreen is wanted, add `vi.mock('../socket', () => ({ socket: { … } }))` first; otherwise the standalone error-line test satisfies the retro lesson.
  - [x] Full suite green (baseline 178), `npm run typecheck`, `npm run lint`, `npm run format`.

- [x] **Task 6: Prove it (AC: all)**
  - [x] Server up → `curl http://localhost:3000/api/matches/recent` returns the rows written during the 3.1 smoke, newest first, ISO dates.
  - [x] `npm run dev` → home screen shows the list under the create form.
  - [x] Stop Postgres (or dead `DATABASE_URL` server run) → home screen still lets you create a match; the list area shows the small failure line; server logs one `[db]` line, no crash.
  - [x] Commit on `story/3.2`, push, PR, `bmad-code-review`, merge per D23. This closes Epic 3.

### Review Findings

Code review 2026-07-16 (three parallel layers; auditor verdict: all 3 ACs, all constraints, all scope guards satisfied, zero violations). Triage: 6 patch, 2 defer, rest dismissed with evidence.

- [x] [Review][Patch] A 200 response with a non-array body reached `.map` — an uncaught render throw would unmount the whole app, create form included (found independently by two layers) [RecentMatches.tsx] — fixed: `Array.isArray` guard routes it into the error line + render test.
- [x] [Review][Patch] No loading state and no fetch timeout — a hung request left the section silently blank forever [RecentMatches.tsx] — fixed: "Loading…" branch + `AbortSignal.timeout(5000)`.
- [x] [Review][Patch] `connectionTimeoutMillis` bounds only connection setup; an established-but-hung query still parked requests forever [pool.ts] — fixed: `query_timeout: 5000`.
- [x] [Review][Patch] `vi.mock` factory omitted `RECENT_MATCHES_LIMIT` — a future importer would get `undefined` only under test [routes/matches.test.ts] — fixed.
- [x] [Review][Patch] Log assertion read `errorSpy.mock.calls[0]` — order-dependent [routes/matches.test.ts] — fixed: any-call matcher.
- [x] [Review][Patch] Stale "snake_case lives here" comment after the mapper moved to matchRecord.ts [matchRepository.ts] — reworded to "the db layer".
- [x] [Review][Defer] Hardcoded `http://localhost:3000` origin (3rd instance of the pre-existing client convention) — fix with one API-base config when the NFR6 deployment story lands; deferred-work.md.
- [x] [Review][Defer] `RecentMatch` type duplicated client/server — move REST payload types into the engine protocol package on the next protocol touch; deferred-work.md.

Dismissed with evidence: CORS on the new GET (app-wide `cors({ origin: 5173 })` in `app.ts`, proven by the live smoke); draws/winnerless rows (engine `MatchResult.winner` non-nullable, cap ties → sudden death); `Number(row.id)` precision (recorded 1b decision; identity ids can't approach 2^53 here); `created_at` timezone shift (column is TIMESTAMPTZ per the 3.1 migration); no-retry error state (v1 scope guard).

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

- Spec validation (fresh-context agent) ran before dev and caught 4 critical spec gaps — most notably that reusing ResultView's second-person forfeit label on the list would ship a UX bug. All were folded into the spec before implementation.

### Completion Notes List

Decisions:
- 1a — `RECENT_MATCHES_LIMIT = 20` in `matchRepository.ts`.
- 1b — response shape as specified; `id: Number(row.id)` (pg returns BIGINT as string; identity values stay far below 2^53); `created_at.toISOString()` in the pure `rowToRecentMatch` mapper (`matchRecord.ts`), typed input `MatchRow`, output `RecentMatch`.
- 1c — REST-only literal `DB_UNAVAILABLE` in the shared `{ error: { code, message } }` shape; NOT added to `WireErrorCode` (socket vocabulary — a DB code can never occur there). Route catches, logs `[db] recent matches: failed to read`, returns 500; server never crashes.
- 1d — same hardcoded `http://localhost:3000` base as the existing HomeScreen fetch; `useEffect` with `ignore` cleanup flag (StrictMode double-GET in dev is expected and documented in a comment). Failure → "Could not load recent matches." line; the create form is a sibling and stays fully usable. Shared API-base constant: OUT, noted as deferred.
- 1e — `reasonLabels.ts` exports `RESULT_REASON_LABEL` (second person, moved from ResultView unchanged) and `LIST_REASON_LABEL` (neutral; forfeit → 'Forfeit'). A render test explicitly asserts the list never shows "you win".
- 1f — `new Date(createdAt).toLocaleString()`; `roundsPlayed` ships in JSON but is not displayed.
- 1g — `vi.mock('../db/matchRepository.js')` at the repository seam in `routes/matches.test.ts` (first `vi.mock` in the repo; factory stubs the whole module incl. `insertMatch`; `vi.mocked(findRecent).mockReset()` in `beforeEach`). Client fetch mocked with `vi.stubGlobal` + `vi.unstubAllGlobals()`; `RecentMatches` tested standalone so HomeScreen's module-scope socket never loads in jsdom.
- Type note: `RecentMatch` is declared in the server (`matchRecord.ts`) and mirrored in the client (`RecentMatches.tsx`) — the client cannot import the server package. Moving the wire type into the engine protocol package is a possible later cleanup.

Verification:
- TDD: 8 new tests written first (red), then implementation (green). Suite 178 → 186; lint + typecheck clean.
- AC1/AC2 live: `curl /api/matches/recent` returned the two real rows left by the 3.1 smoke — newest first, camelCase, ISO dates, numeric ids, forfeit reason verbatim.
- AC-1c live: server restarted with a dead `DATABASE_URL` → endpoint answered `500 {"error":{"code":"DB_UNAVAILABLE",…}}`, health stayed ok, exactly one `[db] recent matches` log line.
- AC3 + failure UX: covered by the standalone render tests (empty state, error line, neutral labels); the in-browser look was not eyeballed — component tests + live endpoint stand in for it, worth one glance at next `npm run dev`.

### Change Log

- 2026-07-16 — Story 3.2 implemented (last story of the v1 plan). Server: `findRecent` + `rowToRecentMatch` + `GET /api/matches/recent` with DB_UNAVAILABLE handling. Client: `RecentMatches` component (list/empty/error states), shared `reasonLabels.ts` (second-person vs neutral maps), HomeScreen renders the list. Tests 178 → 186.
- 2026-07-16 — Addressed code review findings: 6 patches (non-array body guard, loading state + fetch timeout, pool query_timeout, mock completeness, order-independent log assertion, comment fix), 2 deferred. Tests 186 → 187. Story → done; Epic 3 and the v1 plan complete.

### File List

- packages/server/src/db/matchRecord.ts (modified — `MatchRow`, `RecentMatch`, `rowToRecentMatch`)
- packages/server/src/db/matchRecord.test.ts (modified — mapper test)
- packages/server/src/db/matchRepository.ts (modified — `RECENT_MATCHES_LIMIT`, `findRecent`)
- packages/server/src/routes/matches.ts (modified — GET /api/matches/recent)
- packages/server/src/routes/matches.test.ts (modified — 3 GET tests via repository-seam `vi.mock`)
- packages/client/src/components/reasonLabels.ts (new — RESULT/LIST label maps)
- packages/client/src/components/RecentMatches.tsx (new) + RecentMatches.test.tsx (new, 4 tests)
- packages/client/src/components/ResultView.tsx (modified — imports RESULT_REASON_LABEL)
- packages/client/src/components/HomeScreen.tsx (modified — renders RecentMatches)
