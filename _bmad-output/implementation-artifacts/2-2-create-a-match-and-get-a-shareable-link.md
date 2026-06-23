# Story 2.2: Create a match and get a shareable link

Status: in-progress

<!-- Process note (binding, per PRD addendum & D18): Danilo hand-writes ALL code.
     This story is a step-by-step guide + review contract, NOT a spec for a code-generating agent.
     AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills the Dev Agent Record (Completion Notes, File List) at completion;
     config/tooling/server-setup files AI may edit directly (confirmed 2026-06-22).
     Do NOT run bmad-dev-story as designed on this story. -->

<!-- Writing note (from the Epic 1 retro): keep this spec in plain, simple English. Short sentences.
     Define each new term the first time it appears. Prefer examples over abstract description. -->

## Story

As a player,
I want to enter my nickname and create a match that gives me a link to send my friend,
so that we can play together.

**Plain-English goal:** On the home page I type a nickname and click "Create". The server makes a
new match with a long, hard-to-guess id and returns it. The page shows me a link I can copy and
send. My own browser then "joins" that match over the socket and the page shows "waiting for your
friend". No cards are dealt yet — dealing happens in 2.3 when the second player joins.

**Terms used in this story (defined once):**
- **REST endpoint** — a normal HTTP request/response, no live socket. We add `POST /api/matches`.
- **`POST /api/matches`** — the HTTP call the client makes to create a match. "POST" means "create a thing".
- **matchId** — the long, unguessable id for one match. It goes in the share link. It is the *only* room identifier (architecture: no separate room code).
- **shareable link** — the URL the friend opens, e.g. `http://localhost:5173/?match=<matchId>`. The matchId rides in a query parameter so we do NOT need a router yet.
- **matchStore** — an in-memory `Map` on the server that holds live matches (`matchId → entry`). It is RAM only; the database is for *finished* matches (Epic 3), not this.
- **the protocol** — the *typed* list of socket messages both sides agree on: which messages the client may send, which the server may send back, and the exact shape of each. It lives in the engine package so client and server share one source of truth.
- **`ClientToServerEvents` / `ServerToClientEvents`** — two TypeScript interface "maps" that name every socket message and its argument types. Typing the socket with them makes a wrong message payload a *compile error*.
- **command schema (zod)** — a runtime check (zod) that the data inside a message is the right shape, run on the server *before* any game logic sees it. Types catch mistakes at compile time; zod catches bad data at runtime.
- **player token** — a secret random string the server gives a player when they join. The client sends it back on every later socket message to prove "I am this player" (impersonation guard; also the future reconnect seam).
- **playerId** — a *separate* public id for a player, used by the engine and shown in views (whose turn it is). Keep it distinct from the secret token (see Task 1, decision 2b — this matters for hidden-info safety).
- **acknowledgement (ack)** — Socket.IO lets the server reply directly to one `emit` via a callback. We use an ack to hand the token back to the joiner.

## Acceptance Criteria

(Verbatim from epics.md#Story-2.2, split for traceability.)

1. **Given** the home screen, **when** I enter a nickname and click create, **then** `POST /api/matches` (zod-validated body) returns an unguessable matchId, the client shows the shareable link, and a store entry exists awaiting players. (FR1, FR2)
2. **And** the typed event protocol (`ClientToServerEvents` / `ServerToClientEvents` + zod command schemas) lives in `packages/engine/src/protocol/` and both sides compile against it — an intentionally wrong event payload is a **compile error**.
3. **And** the creator joins their own match over the socket and receives a per-player token, with the UI in a "waiting for opponent" state.

## Tasks / Subtasks

- [x] **Task 1: Make the design decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes**
  - [x] **2a — How to generate the matchId.** It must be unguessable. Recommended: Node's built-in `crypto.randomUUID()` (zero new dependency, 122 bits of randomness). Alternative: `nanoid` (shorter, friendlier link, but adds a dependency). Pick one and record why. The link length does not matter at v1 — favor zero-dep.
  - [x] **2b — playerId vs token: two separate values. ⚠️ correctness.** Issue BOTH when a player joins: a public `playerId` (used by the engine; shown in views as "you"/"chooser") and a secret `token` (auth only). They must be different values. Reason: `projectFor` puts `chooser` (a playerId) into the view sent to *both* players — if the token were the playerId, you would leak the opponent's secret. So: `token` NEVER appears in any `PlayerView` or in any payload sent to the other player. Both generated with `crypto.randomUUID()`. Record this.
  - [x] **2c — How the creator receives the token.** Recommended: a Socket.IO **acknowledgement callback** on `match:join`, returning `{ ok: true, playerId, token }` (or a typed error `{ ok: false, error }`). An ack is a direct reply to one request, which is exactly what "join → here is your token" is. Alternative: a separate `match:joined` server→client event. Record the choice. (The "waiting for opponent" screen is client-local state — it needs no server event until the opponent actually joins, which is story 2.3.)
  - [x] **2d — Shareable link format.** Recommended: a query parameter — `${window.location.origin}/?match=${matchId}`. The friend's browser (2.3) reads it with `new URLSearchParams(window.location.search).get('match')`. This avoids adding `react-router` now (architecture: add a router only when URLs beyond the share link matter). Alternative: a path like `/join/<matchId>` (needs a router and a dev-server fallback). Record the choice. Build the link from `window.location.origin`, not a hardcoded string.
  - [x] **2e — Nickname validation shape.** One zod schema, e.g. `z.string().trim().min(1).max(20)` — pick the max. It validates the `POST /api/matches` body (AC1's "zod-validated body") and the `match:join` payload. Record the bounds. Empty/whitespace-only and over-length nicknames are rejected with the standard typed error shape.
  - [x] **2f — One join path.** `POST /api/matches` only *creates* the waiting entry and returns the matchId — it does NOT add a player. Adding a player happens over the socket via `match:join`, for BOTH the creator (this story) and the friend (2.3). This keeps a single, symmetric "add a player" path and sets up 2.3's auto-start-at-2 cleanly. Consequence to accept: the nickname is sent twice (once in the POST body so AC1's validated body is real, once in `match:join`); the client keeps it in state and resends it. Record this.

- [x] **Task 2: Define the shared protocol in the engine (AC: 2)** — `packages/engine/src/protocol/`
  - [x] New `packages/engine/src/protocol/events.ts`: the two interface maps. `ClientToServerEvents` includes `match:join` typed with its payload AND its ack callback signature (per 2c). `ServerToClientEvents` declares the gameplay events for later — at minimum `match:error` now; `match:state` / `match:ended` may be declared as placeholders (their `PlayerView` payload type already exists in `types.ts`). Socket event names are `domain:action` camelCase (architecture Naming Patterns).
  - [x] New `packages/engine/src/protocol/commands.ts`: zod schema(s) for client command payloads — for this story the `match:join` payload `{ matchId: string; nickname: <2e schema> }`. This is a *runtime* value used by the server only.
  - [x] Export from `packages/engine/src/index.ts`: `export type { ClientToServerEvents, ServerToClientEvents }` (types) and the zod schema(s) (runtime values). Keep the engine importing **zod only** — the protocol files may import types from `./types.js` and `zod`, nothing else (no socket.io, no express). [Source: architecture.md — engine boundary]
  - [x] The error shape across REST and socket is shared: `{ error: { code: string, message: string } }` with stable machine codes (architecture Format Patterns). Introduce the codes this story needs (e.g. `INVALID_BODY` / `MATCH_NOT_FOUND`); reuse the existing `CommandErrorCode` style.

- [x] **Task 3: Server — `POST /api/matches` + the in-memory store (AC: 1)** — `packages/server`
  - [x] New `packages/server/src/store/matchStore.ts`: an in-memory `Map<matchId, entry>`. For THIS story an entry is a *waiting* entry — no `MatchState` yet (dealing is 2.3). Suggested shape: `{ matchId, status: 'waiting', players: Array<{ playerId, token, nickname, socketId }>, createdAt }`. Expose small functions (`create`, `get`, maybe `addPlayer`) rather than leaking the Map. (The eventual `{ state, tokens, sockets }` shape from architecture grows in 2.3 when `createMatch` runs.)
  - [x] New `packages/server/src/routes/matches.ts`: `POST /api/matches`. zod-parse the body (2e). On success: generate a matchId (2a), create the waiting store entry, respond `201` with `{ matchId }`. On a bad body: `400` with the typed error shape. Mount this router in `packages/server/src/app.ts` (keep `GET /api/health` where it is).
  - [x] Keep the server free of game logic — this story creates an empty match; it does not call the engine's `createMatch` (that is 2.3). [Source: epics.md scope]

- [x] **Task 4: Server — the `match:join` socket handler (AC: 3)**
  - [x] New `packages/server/src/sockets/matchHandlers.ts`: register `match:join`. Type the Socket.IO server with the protocol maps: `new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, …)`. zod-parse the join payload (commands.ts) BEFORE touching the store. Look up the matchId; if missing → typed error (ack `{ ok: false }` or `match:error`). Otherwise: generate `playerId` + `token` (2b), add the player to the store entry, join the Socket.IO room named by matchId (`socket.join(matchId)`), and return `{ ok: true, playerId, token }` via the ack (2c).
  - [x] Wire this handler into `packages/server/src/server.ts`, replacing the placeholder `io.on('connection', …)` that just logs. Keep the `pingInterval`/`pingTimeout` work OUT of this story — that is 2.6 (FR5). [Source: epics.md scope]
  - [x] Do NOT auto-start the match here. One player = still `waiting`. Auto-start at two players is 2.3. [Source: epics.md#Story-2.3]

- [x] **Task 5: Client — HomeScreen, create flow, waiting state (AC: 1, 3)** — `packages/client`
  - [x] Type the socket client with the protocol maps: `io<ServerToClientEvents, ClientToServerEvents>('http://localhost:3000')` in `packages/client/src/socket.ts`. Import the maps with `import type` (client pulls engine TYPES only — zero engine runtime ships to the browser). [Source: architecture.md — client imports engine types only]
  - [x] New `packages/client/src/components/HomeScreen.tsx`: a nickname text input + a "Create" button. On click: `fetch('POST /api/matches')` with `{ nickname }`. On success, build the link (2d), then emit `match:join { matchId, nickname }` and, in the ack, store the returned `{ playerId, token }`.
  - [x] Extend the reducer (`packages/client/src/state/reducer.ts`) to own screen + match data alongside the connection status — ONE reducer (architecture: connection + screen + snapshot in one reducer). Suggested additions: a `screen` (`'home' | 'waiting'`) and a `match` field (`{ matchId, link, playerId, token } | null`). Add the matching actions (names mirror the flow, e.g. `match/created`, `match/joined`). Immutable updates only.
  - [x] `packages/client/src/App.tsx` switches on `screen`: render `HomeScreen` when `home`; when `waiting`, show the copyable link + "waiting for opponent…". Keep the connection-status line visible (it still proves the socket). Plain text/inputs are fine — no styling work this story (FR29/30 rendering is 2.3+).
  - [x] Note: the module-singleton socket auto-connects on import. socket.io-client buffers outgoing emits until connected, so emitting `match:join` right after the POST is safe; the ack fires once connected.

- [x] **Task 6: Tests — AI-written**
  - [x] `packages/server/src/routes/matches.test.ts` (supertest against the exported `app`, no real port — same pattern as `app.test.ts`): valid nickname → `201` + body has a string `matchId`; missing / blank / whitespace-only / over-length nickname → `400` with the `{ error: { code, message } }` shape.
  - [x] `packages/server/src/store/matchStore.test.ts`: creating an entry yields a `waiting` entry retrievable by its matchId; ids are unique across calls.
  - [x] **Protocol compile-safety (AC2 proof):** a tiny type-level check (`packages/engine/src/protocol/events.test-d.ts`) that a *wrong* `match:join` payload fails to compile; `npm run typecheck` is the assertion.
  - [x] Client reducer test (`state/reducer.test.ts`, extended): `match/joined` sets `screen`/`match`, reconnect doesn't drop the waiting screen, no mutation; existing connection-status cases still pass.
  - [x] **Socket `match:join` handshake (token issuance):** manual-verified (create → link shown → "waiting" → server logs the join), consistent with 2.1's precedent; automated socket round-trip deferred.

- [ ] **Task 7: Prove it (AC: all)**
  - [x] `npm run dev` → open the client → type a nickname → Create → a link appears and the page shows "waiting for opponent"; the server logs the join. (Manual smoke — verified.)
  - [x] `npm run typecheck` — strict-clean across all four packages (includes the protocol compile-safety check).
  - [x] `npm test` — green: 128 total.
  - [ ] `npm run format` before commit.
  - [ ] Commit on `story/2.2`, push, open PR, run `bmad-code-review` per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews — never paste-ready implementation code. **Exemptions:** scaffolding tools; test files (Task 6) may be AI-written; AI fills the Dev Agent Record at completion; **config/tooling/server-setup files AI may edit directly** (confirmed 2026-06-22). [Source: addendum.md#Working-agreement; D18]

### Scope guard — what is NOT in 2.2

- **No dealing, no `createMatch`, no `match:state` with a real `PlayerView`** — the match starts and cards are dealt only when the *second* player joins → **story 2.3**.
- **No `MatchScreen` / `CardView` rendering** (FR8/FR29/FR30) → 2.3+.
- **No `selectStat` / gameplay** (FR11/FR12) → 2.4.
- **No disconnect/forfeit, no `pingInterval`/`pingTimeout` tuning** (FR5) → 2.6.
- **No database / persistence** → Epic 3. The `matchStore` is RAM only.
- **No `react-router`** — use the query-param link (decision 2d).
- **No third-player rejection (`MATCH_FULL`)** — that lands with the join-to-full path in 2.3.
- Counter-metric (PRD): time-to-playable. Resist gold-plating; build the smallest correct lobby step.

### Architecture constraints that bind this story

- **Engine stays pure:** `packages/engine` imports **zod only**. The new `protocol/` files may import `./types.js` and `zod` — nothing transport-related. No `socket.io` / `express` types inside the engine. [Source: architecture.md — Enforcement Guidelines, Architectural Boundaries]
- **Shared protocol, no fourth package:** the typed event maps + command schemas live in the engine package and are imported by both server and client. Client uses `import type` (zero runtime). [Source: architecture.md — Structure Patterns, API & Communication Patterns]
- **REST/Socket split:** match creation is the non-realtime edge → REST (`POST /api/matches`). Everything in-match is Socket.IO. No gameplay over REST, ever. [Source: architecture.md#Architectural-Boundaries]
- **One shared `http.Server`** already hosts Express + Socket.IO (built in 2.1) — extend it, don't add a second server. [Source: architecture.md — API & Communication Patterns]
- **Hidden-info boundary:** nothing this story sends may carry secret data; the secret `token` goes only to its own owner via the ack and never into any `PlayerView` (decision 2b). `projectFor` stays the only door for match state (relevant from 2.3). [Source: architecture.md — Enforcement Guidelines; NFR2]
- **Validation timing:** zod-parse every external payload at the boundary (REST body, socket event) BEFORE any logic. Shape (zod) and rules (engine) are two separate jobs. [Source: architecture.md — Process Patterns]
- **Error shape:** `{ error: { code: string, message: string } }` with stable machine codes, shared by REST and socket. [Source: architecture.md — Format Patterns]
- **Identity:** unguessable `matchId` is the only room id; a per-player random token is issued at join and sent with every later socket event. [Source: architecture.md — Authentication & Security]
- **Client state = React built-ins only:** one reducer owns connection + screen + match data; no Redux/Zustand, no router yet. [Source: architecture.md — Frontend Architecture]
- **Naming:** React component files PascalCase (`HomeScreen.tsx`); other modules camelCase (`matchStore.ts`, `matchHandlers.ts`); socket events `domain:action` camelCase; one concept = one name — it is `match` (never game/room/session). [Source: architecture.md — Naming Patterns]

### Recorded tech choices (from architecture)

- **Express 5.2** (REST) · **Socket.IO 4.8.x** (sockets) · **zod 4** (boundary validation) · **React 19** + **Vite** (client) · **Vitest 4** (tests). All already installed from 2.1 — do not re-pick versions; the engine already depends on zod. [Source: architecture.md#Tech-Stack]
- `crypto.randomUUID()` is a Node built-in (no dependency) — the recommended matchId/token source (decision 2a/2b).

### Previous work intelligence (story 2.1)

- **The socket is a module singleton:** `packages/client/src/socket.ts` exports `export const socket = io('http://localhost:3000')`. This story changes that line to the **typed** form `io<ServerToClientEvents, ClientToServerEvents>(...)`. It auto-connects on import; emits buffer until connected.
- **The reducer pattern is established:** `state/reducer.ts` holds `{ status }` with a closed `Action` union and a `switch` (no `default`, exhaustive). Extend the `State`, `Action`, and `switch` together so the union stays exhaustive (the 2.1 review confirmed this is safe *because* the union is closed — keep it closed).
- **`App.tsx` already wires socket lifecycle** (`connect` / `disconnect` / `connect_error` → dispatch, symmetric `on`/`off` cleanup in a `useEffect([])`). Reuse that pattern; add the screen switch around it.
- **Server is split `app.ts` (exported Express app) + `server.ts` (http.Server + Socket.IO + listen).** Put the new router in `routes/matches.ts` and mount it in `app.ts` so it stays supertest-able without a real port (the reason for the split). Put the socket handler in `sockets/matchHandlers.ts`, wired from `server.ts`.
- **CORS is locked to `http://localhost:5173`** (hardcoded in `app.ts` and `server.ts`). The 2.1 review flagged this string drifting across files; if you find yourself adding it to a third place, that is the moment to extract a small shared constant or introduce `server/config.ts` (zod env, per architecture) — optional, your call, not required for this story.
- **Per-package `vitest.config.ts` is required** so `vitest run` inside a package does not pick up the root `projects` config (server already has one; the client uses `vite.config.ts`).
- **Tests: 115 green at the start of 2.2** (engine 109, client 4, server 2). Socket integration tests were deliberately deferred in 2.1 — same judgment applies to the `match:join` round-trip here unless it stays trivial.

### Git intelligence

- Rhythm: branch `story/2.2` off `main` → scaffold folders + hand-write → AI writes tests → green → commit → push → PR → `bmad-code-review` → fix → merge. (2.1 merged via PR #11; `main` is current.)
- Recent pattern: small, focused commits; the 2.1 review's recommended patches were applied in a follow-up "Patching small fixes" commit before merge — expect the same review→patch loop here.

### Technical notes

- **Why playerId ≠ token (decision 2b), concretely:** `projectFor(state, playerId)` returns a `PlayerView` containing `you` and `chooser`, both playerIds, and it is sent to *both* players. If `playerId === token`, player A's view would reveal player B's `chooser` token. Keeping them separate makes the leak impossible by construction. The token lives only in the store and travels only to its owner.
- **Typed sockets, both ends:** server `new Server<ClientToServerEvents, ServerToClientEvents>(...)`; client `io<ServerToClientEvents, ClientToServerEvents>(...)` (note the generic order differs between server and client — server is `<C2S, S2C>`, client is `<S2C, C2S>`). With these in place, a wrong `match:join` payload or a misnamed event is a compile error — that is AC2.
- **Ack typing:** in `ClientToServerEvents`, `match:join` is typed as `(payload: JoinPayload, ack: (res: JoinResult) => void) => void`. The server's handler receives the `ack` as its last argument and calls it once.
- **The waiting entry has no `MatchState` yet.** Do not import or call `createMatch` in this story; the store entry is a lightweight "lobby" record until 2.3 deals the cards and attaches real engine state.

### Project Structure Notes

- New (engine): `packages/engine/src/protocol/events.ts`, `protocol/commands.ts` (+ a `events.test-d.ts` or `@ts-expect-error` check). Update `packages/engine/src/index.ts` to export them.
- New (server): `packages/server/src/routes/matches.ts` (+ `routes/matches.test.ts`), `packages/server/src/store/matchStore.ts` (+ `store/matchStore.test.ts`), `packages/server/src/sockets/matchHandlers.ts`. Update `app.ts` (mount router) and `server.ts` (typed `Server`, wire handlers).
- New (client): `packages/client/src/components/HomeScreen.tsx`. Update `socket.ts` (typed client), `state/reducer.ts` (+ test), `App.tsx` (screen switch).
- This is the first time the server grows the `routes/` / `sockets/` / `store/` folders and the client grows `components/` — they match the architecture tree exactly (architecture.md "Complete Project Directory Structure"). No change to `packages/engine` beyond the new `protocol/` folder and the index export.

### References

- [Source: epics.md#Story-2.2] — story statement + ACs (verbatim)
- [Source: epics.md#Story-2.3] — what 2.2 deliberately stops short of (second join, auto-start, dealing, `MATCH_FULL`)
- [Source: architecture.md — API & Communication Patterns, Authentication & Security] — REST/socket split, one http.Server, typed protocol, matchId + per-player token
- [Source: architecture.md — Implementation Patterns & Consistency Rules] — naming, structure, error shape, validation timing (the review contract)
- [Source: architecture.md — Complete Project Directory Structure] — the `protocol/`, `routes/`, `sockets/`, `store/`, `components/` layout
- [Source: prd.md — FR1, FR2; NFR2, NFR5] — nickname-only identity, create + shareable link, hidden-info, no PII
- [Source: addendum.md#Working-agreement; .decision-log.md#D18, #D13] — hand-write code; link-share + nickname session model
- [Source: implementation-artifacts/2-1-…-dev-loop.md] — established socket/reducer/server-split patterns this story builds on

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; test files + Dev Agent Record AI-permitted).

### Debug Log References

### Completion Notes List

Decisions:
- 2a — matchId generation: `crypto.randomUUID()` (Node built-in, zero new dependency, 122-bit unguessable).
- 2b — playerId vs token: two separate values per player, both from `crypto.randomUUID()`. `playerId` is public (engine + views); `token` is the secret auth value and never appears in any `PlayerView` or in any payload sent to the other player.
- 2c — how the creator receives the token: Socket.IO acknowledgement (ack) callback on `match:join`, returning `{ ok, playerId, token }` (or a typed error).
- 2d — shareable link format: query parameter — `${window.location.origin}/?match=${matchId}` (no react-router needed; friend reads it via `URLSearchParams`).
- 2e — nickname validation shape: `nicknameSchema = z.string().trim().min(1).max(50)` (implemented with max 50). Reused two ways: `createMatchSchema = z.object({ nickname })` for the `POST /api/matches` body, and `matchJoinCommandSchema = z.object({ matchId, nickname })` for the `match:join` payload.
- 2f — one join path: `POST /api/matches` only creates the waiting entry; adding a player happens over the socket via `match:join` (same path for the creator now and the friend in 2.3).

Setup notes / gotchas resolved during the build (for future infra stories):
- **Socket.IO `Server` generic order differs by side.** Server: `new Server<ClientToServerEvents, ServerToClientEvents>`. Client: `io<ServerToClientEvents, ClientToServerEvents>`. Importing `Server` from `node:http` instead of `socket.io` gives the misleading `... does not satisfy the constraint 'typeof IncomingMessage'` error.
- **`matchHandlers.ts` exports `registerMatchHandlers(io)`** and is called from `server.ts`; it does NOT create its own `Server`. Avoid importing anything back from `server.ts` (circular import).
- **Express middleware order matters.** `cors` and `express.json` must be registered BEFORE `app.use(matchesRouter)`. Mounting the router first caused (a) the browser CORS preflight to fail (no `Access-Control-Allow-Origin` header on the response) and (b) `req.body` to be `undefined` in the handler. Fix = register `cors` → `express.json` → router.
- **Validate with `.safeParse`, not `.parse`.** `.parse` throws on bad input (→ 500 / uncaught socket error); `.safeParse` returns `{ success, data | error }` so the boundary can return a clean `400` / ack-error. The parsed value is under `result.data`.
- **`AckPayload` must be a true discriminated union** — the success branch is `ok: true` (a literal), not `ok: boolean`; otherwise TS can't narrow `if (response.ok)` and the error branch's `error` field is unreachable.
- **Reducer carries data in the action, never as extra parameters.** `match/joined` action holds `{ matchId, link, playerId, token }`; `connected`/`disconnected` only touch `status` (so a reconnect doesn't bounce the user off the `waiting` screen).
- The client `fetch` targets the absolute server origin (`http://localhost:3000/api/matches`), not a relative path — client (5173) and server (3000) are different origins.

Tests: 128 total green (engine 109 + protocol type-check, client 7 reducer, server: 2 health/CORS + 6 route + 5 store + handler manual-verify). The `match:join` socket round-trip is **manual-verified** (create → link shown → "waiting" → server logs the join), consistent with 2.1's deferral of live socket integration tests; revisit when the socket carries real game events (2.3+). The protocol compile-safety check (`events.test-d.ts`) is enforced by `npm run typecheck`, not Vitest.

### File List

New:
- `packages/engine/src/protocol/events.ts` — `ClientToServerEvents` / `ServerToClientEvents` maps + `MatchPayload`, `AckPayload`, `ErrorPayload`, `CommandErrorCode`.
- `packages/engine/src/protocol/commands.ts` — `nicknameSchema`, `createMatchSchema`, `matchJoinCommandSchema` (zod) + `MatchJoinCommand` type.
- `packages/engine/src/protocol/events.test-d.ts` — type-level proof that a wrong `match:join` payload is a compile error (AC2).
- `packages/server/src/store/matchStore.ts` — in-memory `Map` of waiting matches; `createMatch`, `getMatch`, `addPlayer`; `MatchEntry` / `Player` / `EntryStatus` types.
- `packages/server/src/store/matchStore.test.ts` — store unit tests.
- `packages/server/src/routes/matches.ts` — `POST /api/matches` (zod-validated, returns `{ matchId }`).
- `packages/server/src/routes/matches.test.ts` — route tests (201 + validation 400s) via supertest.
- `packages/server/src/sockets/matchHandlers.ts` — `registerMatchHandlers(io)`; `match:join` → validate → find → issue playerId+token → `addPlayer` → `socket.join` → ack.
- `packages/client/src/components/HomeScreen.tsx` — nickname input + Create → `POST` → build link → `match:join` (awaited ack) → dispatch `match/joined`.

Changed:
- `packages/engine/src/index.ts` — export the protocol types (`ClientToServerEvents`, `ServerToClientEvents`, `AckPayload`, `ErrorPayload`) and runtime schemas (`nicknameSchema`, `createMatchSchema`, `matchJoinCommandSchema`) + `MatchJoinCommand`.
- `packages/server/src/app.ts` — mount `matchesRouter` (after `cors` + `express.json`).
- `packages/server/src/server.ts` — type the Socket.IO `Server` with the protocol maps; export `httpServer`; call `registerMatchHandlers(io)` (replacing the placeholder connection logger).
- `packages/client/src/socket.ts` — type the client socket with the protocol maps.
- `packages/client/src/state/reducer.ts` — add `screen` + `match` to state and the `match/created` / `match/joined` actions; `connected`/`disconnected` now only change `status`.
- `packages/client/src/state/reducer.test.ts` — rewritten for the new state shape + `match/joined`.
- `packages/client/src/App.tsx` — switch on `state.screen` (home → `HomeScreen`, waiting → waiting view); pass `dispatch` to `HomeScreen`.

## Review Findings

_Code review 2026-06-23 (3 parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor) on branch `story/2.2` vs `main`. **AC2 (typed protocol → wrong payload is a compile error) and AC3 (creator joins, gets a per-player token, UI waiting) fully pass.** AC1 works end to end but the REST 400 does not use the shared error shape — the one binding violation. typecheck clean (incl. the `events.test-d.ts` compile-safety proof); 128 tests green. Engine purity, client `import type`-only, REST/socket split, one http.Server, and playerId≠token are all honored._

### Patches — recommended

- [x] [Review][Patch][Med] **(Fixed 2026-06-23)** **REST 400 doesn't use the shared error shape — and leaks the raw ZodError.** Architecture mandates `{ error: { code, message } }` with a stable code, shared by REST and socket. `routes/matches.ts` returns `{ error: 'Invalid nickname', details: parsedName.error }` — a bare string + the full zod error object. The socket ack gets it right (`{ ok:false, error:{ code:'INVALID_BODY', message } }`), so the two paths are inconsistent. Fix: return `400 { error: { code: 'INVALID_BODY', message: '…' } }`, drop `details`, and update the client read in `HomeScreen.tsx` from `errorData.error` to `errorData.error?.message` (today it only "works" because both sides use a bare string — two bugs cancelling). [`packages/server/src/routes/matches.ts`, `packages/client/src/components/HomeScreen.tsx`] — I'll add the body-shape assertion to `matches.test.ts` once the shape is fixed.
- [x] [Review][Patch][Med] **(Fixed 2026-06-23)** **`match:join` ack has no timeout → the UI can hang on "Creating…" forever.** In `HomeScreen.tsx` the ack is wrapped in `new Promise` with no timeout and no reject path. If the POST succeeds but the socket leg fails (server down, socket not yet connected, ack never fires), the `await` never resolves: `isLoading` stays `true` and `finally` never runs. Fix: use `socket.timeout(ms).emit('match:join', …, (err, res) => …)` (or a `setTimeout`-based reject) and surface a timeout error. [`packages/client/src/components/HomeScreen.tsx`]

### Patches — quality (your call)

- [x] [Review][Patch][Low] **(Fixed 2026-06-23)** `matchLink` is shown before the join ack returns — if the join fails, the user sees a link for a match they never joined. Set the link after a successful ack, or clear it on the catch path. [`HomeScreen.tsx`]
- [ ] [Review][Patch][Low] The `INVALID_BODY` ack message reads "Invalid match ID" even when it's the nickname that's bad. Make the message reflect the actual payload problem. [`sockets/matchHandlers.ts`]
- [ ] [Review][Patch][Low] The join payload shape is declared twice and can drift: `MatchPayload` (events.ts) vs `MatchJoinCommand` (commands.ts). Consolidate — e.g. `type MatchJoinCommand = z.infer<typeof matchJoinCommandSchema>` and have the event map reference it (architecture: "no inline retyping of payloads"). [`protocol/events.ts`, `protocol/commands.ts`]
- [ ] [Review][Patch][Low] Client mis-types the POST response as `MatchJoinCommand` (which has a `nickname`); the server returns only `{ matchId }`. Add a `CreateMatchResponse = { matchId: string }` (or inline) type. [`HomeScreen.tsx`]
- [ ] [Review][Patch][Low] Dead `match/created` action — never dispatched, and its branch wrongly force-sets `status: 'connected'`. Remove it (or wire it intentionally). [`state/reducer.ts`]
- [ ] [Review][Patch][Low] Leftover `console.log`s: the server logs the join payload (incl. nickname) and the client logs the ack **including the token**. Remove them (or gate behind debug). [`sockets/matchHandlers.ts`, `HomeScreen.tsx`]
- [ ] [Review][Patch][Low] The store's `createMatch()` will collide conceptually with the engine's `createMatch()` (which deals cards) once 2.3 imports the engine one. Rename the store function (e.g. `createMatchEntry` / `createWaitingMatch`) now, before 2.3 builds on it. [`store/matchStore.ts`]

### Deferred

- [x] [Review][Defer] No player cap / no `status === 'waiting'` guard / duplicate-socket join — a match can accept a 3rd+ player or a repeat join. **Deferred by this story's own scope:** MATCH_FULL and join-to-full are story 2.3. Add the cap + status guard + per-socket dedupe there.
- [x] [Review][Defer] `matchStore` never evicts entries → unbounded growth (every create, plus abandoned lobbies, lives for the process lifetime). Eviction is architecturally tied to `match:ended` + the FR27 write (story 2.5 / Epic 3); an abandoned-lobby TTL is a later hardening. No match-end lifecycle exists yet to hook.
- [x] [Review][Defer] The per-player `token` is issued but never verified — nothing consumes it yet. By design: enforcement begins when gameplay events carry the token (2.4+). It's the seam, placed now.

### Dismissed

- `crypto.randomUUID()` used without an explicit import — verified safe: global `crypto` is stable from Node 19+ and the project targets Node 24. (Aside: `package.json` `engines` says `>=24` while the dev machine runs v20 — an env-policy note, not a code issue.)
- `fetch` success-branch `.json()` not guarded — the outer `try/catch` covers a degenerate non-JSON 2xx; not a real server behavior here.
- `waiting` screen has no exit yet / `match:state` has no client listener — by design; 2.3 wires `match:state` when the friend joins and cards are dealt.
- `Server` imported as a value (not `import type`) in `matchHandlers.ts` — cosmetic; used only as a type annotation, server-side, no boundary impact.
- `catch (err: any)` — minor nit; `unknown` + narrowing is tidier but not required.
