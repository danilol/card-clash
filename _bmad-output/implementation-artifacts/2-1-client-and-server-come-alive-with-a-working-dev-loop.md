# Story 2.1: Client and server come alive with a working dev loop

Status: ready-for-dev

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a step-by-step guide + review contract, NOT a spec for a code-generating agent.
     AI role: explain, point, review. Exceptions per working agreement: test files may be
     AI-written; AI fills the Dev Agent Record (Completion Notes, File List) at completion.
     Do NOT run bmad-dev-story as designed on this story. -->

<!-- Writing note (from the Epic 1 retro): keep this spec in plain, simple English. Short sentences.
     Define each new term the first time it appears. Prefer examples over abstract description. -->

## Story

As Danilo (developer-learner),
I want the client and server set up and talking over Socket.IO in dev mode,
so that every later story builds on a live loop I can see working.

**Plain-English goal:** one command starts two apps — a React web page (the *client*) and a Node web server (the *server*). The page connects to the server and shows "connected". That's it. No game yet.

**Terms used in this story (defined once):**
- **client** — the web page the player sees. Built with React, served in dev by Vite.
- **server** — the Node program that the client talks to. Built with Express + Socket.IO.
- **Vite** — the tool that runs the React page in dev and rebuilds it instantly on save (this instant rebuild is called **HMR**, hot module replacement).
- **Express** — a small library for HTTP routes like `GET /api/health`.
- **Socket.IO** — a library for a live two-way connection (a "socket") between page and server, used for real-time game messages later.
- **handshake** — the first moment the socket connects. We prove it works by showing "connected" on the page.
- **CORS** — a browser rule: a page may only call a server that says "I allow this page's address". We will allow only the dev client address.
- **reducer** — one function that holds UI state and updates it from "actions" (small event objects). React's `useReducer`. We keep all UI state in one reducer.
- **tsx** — a runner that executes TypeScript files directly, with no separate build step.

## Acceptance Criteria

1. **Given** the Epic 1 monorepo, **when** the client is scaffolded with `npm create vite@latest packages/client -- --template react-ts` and the server is hand-built in `packages/server` (Express 5 + Socket.IO sharing **one** `http.Server`), **then** both packages live under `packages/*` and install cleanly with the existing workspace setup.
2. **When** I run `npm run dev` at the repo root, **then** **one** command starts both the client (Vite dev server) and the server (with `tsx` watch) together.
3. **Then** the client shows a connection status — one of `connecting | connected | disconnected` — read from a single value held in **one** reducer. When the socket connects, the page shows "connected". This proves the handshake.
4. **Then** the server answers `GET /api/health` with HTTP 200, and CORS (for both Express and Socket.IO) is locked to the client dev origin only (for example `http://localhost:5173`) — not `*`.

## Tasks / Subtasks

- [x] Task 1: Make the setup decisions BEFORE coding (AC: all) ⚠️ BLOCKING — record each in Completion Notes
  - [x] **1a — How the server uses the engine in dev (and the `dist` build).** In dev, run the server with **`tsx`** (the architecture's recorded choice). `tsx` loads TypeScript directly, so the server can import `@card-clash/engine` from its source — the engine's `package.json` `exports` already point at `./src/index.ts`, which works for `tsx`, Vite, and Vitest. **So story 2.1 needs NO `dist` build.** The production build (compile the engine to `dist/` and repoint `exports`) is only needed when a real production/plain-Node consumer ships — defer it to that story and keep the note in `deferred-work.md`. (Story 2.1 does not even call the engine yet — the first engine call is `createMatch` in 2.2.) Record this decision.
  - [x] **1b — One command for both apps.** Decide how `npm run dev` starts client + server together. Recommended: the `concurrently` dev-dependency (simple, gives each process a clear label/color). Alternatives: `npm-run-all -p`, or a small script. Record the choice. The client script is Vite's `dev`; the server script is `tsx watch src/main.ts` (or similar).
  - [x] **1c — Dev ports + the CORS origin.** Pick fixed dev ports and write them down (for example: client `5173` = Vite default, server `3000`). The server must lock CORS to the client origin (`http://localhost:5173`) for BOTH Express (the `cors` middleware) and the Socket.IO server (its own `cors` option) — never `*`. Decide where the origin/ports live (a small shared constant or an env var with a documented default). Record it.
  - [x] **1d — The connection-status enum + reducer.** Hold UI state in **one** reducer (`useReducer` + context, React built-ins only — no Redux). The status is exactly `'connecting' | 'connected' | 'disconnected'`. Decide the action names the socket lifecycle dispatches (for example `socket/connected`, `socket/disconnected`). Initial state is `connecting`. Record the shape.
  - [x] **1e — How much Socket.IO typing in 2.1.** The full typed event protocol (`ClientToServerEvents` / `ServerToClientEvents` + zod schemas in `engine/protocol/`) lands in **story 2.2** — do NOT build it here. For 2.1, use only the built-in `connect` / `disconnect` lifecycle (no custom game events yet). Record that the typed protocol is deferred to 2.2.
- [x] Task 2: Scaffold the client `packages/client` (AC: 1)
  - [x] Run `npm create vite@latest packages/client -- --template react-ts`. Treat Vite's ~10 generated files as config, not hand-written code (per the working agreement, scaffolding tools are allowed; you still write the app logic by hand).
  - [x] Make sure it joins the existing npm workspaces (`packages/*`). Remove the scaffold's demo clutter you do not need, but keep it minimal — no UI design yet.
- [ ] Task 3: Hand-build the server `packages/server` (AC: 1, 4)
  - [ ] New package `packages/server` (hand-written `package.json`, in the workspace). Express 5 for HTTP, Socket.IO 4.8.x for the socket, both attached to **one** `http.Server` (create the `http.Server` from the Express app, then pass it to Socket.IO — this is the standard single-server setup).
  - [ ] `GET /api/health` → returns 200 (a tiny JSON like `{ status: 'ok' }` is fine).
  - [ ] Lock CORS to the client origin (1c) on both Express (`cors` middleware) and Socket.IO (`cors` option). Add a JSON body size limit (basic hardening, per architecture).
  - [ ] Keep the server free of any direct DB or game logic — this story is just the loop. (It may import engine **types** if helpful, but it makes no engine calls yet.)
- [ ] Task 4: One root `npm run dev` (AC: 2)
  - [ ] Add a root `dev` script (per 1b) that starts the client and server together. Document the command in the README or the script comment so a fresh clone knows how to run it.
- [ ] Task 5: Client connection status via one reducer (AC: 3)
  - [ ] Create the socket client (`socket.io-client`) pointing at the server origin. Set up `useReducer` + context for app state; the status starts at `connecting`.
  - [ ] On the socket's `connect` event dispatch the "connected" action; on `disconnect` dispatch "disconnected". Render the current status text on the page (plain text is fine — no styling needed).
  - [ ] Keep ALL UI state in this one reducer (architecture rule: one reducer owns connection + screen + snapshot; in 2.1 it owns just the connection status).
- [ ] Task 6: Tests — AI-permitted
  - [ ] Server: a test that `GET /api/health` returns 200 (e.g. `supertest` against the Express app, or a `fetch` against a started server). Keep it fast and self-contained.
  - [ ] Client reducer: a pure unit test — from `connecting`, a "connected" action → `connected`; a "disconnected" action → `disconnected`. (The reducer is a plain function, so this is easy and needs no browser.)
  - [ ] Optional: a small Socket.IO handshake test (start the server, connect a client, assert it connects). Only if it stays simple; otherwise note it as manual-verified.
- [ ] Task 7: Prove the loop (AC: all)
  - [ ] `npm run dev` starts both apps with one command; opening the client shows `connecting` then `connected`; stopping the server shows `disconnected`.
  - [ ] `npm run typecheck` — strict-clean across all packages (the new `noUnusedLocals` / `noUnusedParameters` / `allowUnreachableCode` flags now apply here too).
  - [ ] `npm test` — new tests green alongside the engine's 109.
  - [ ] `npm run format` (and `lint`, if you wire one).
  - [ ] Commit on `story/2.1`, push, open PR, run code-review per process.

## Dev Notes

### Working agreement (binding)

- Danilo types every implementation file by hand. AI explains, points, reviews — never paste-ready implementation code. **Exemptions: scaffolding tools (create-vite) are allowed; test files (Task 6) may be AI-written; AI fills the Dev Agent Record at completion.** [Source: planning-artifacts/prds/.../addendum.md#Working-agreement]

### Scope guard

- This story is **only the live dev loop**: scaffold both packages, one `npm run dev`, a connection-status reducer, `/api/health`, locked CORS. NOT here:
  - Creating a match / shareable link / the REST `POST /api/matches` — story 2.2.
  - The typed Socket.IO event protocol + zod command schemas (`engine/protocol/`) — story 2.2.
  - Any gameplay, projection wiring, or screens beyond a status line — 2.3+.
  - Disconnect → forfeit and the 10s window (FR5) — story 2.6 (configure ping timing there, not now).
  - Database / persistence — epic 3.
  - The engine `dist` production build — deferred until a production/runtime consumer needs it (decision 1a).
- Counter-metric (from the PRD): time-to-playable. Resist gold-plating. The goal of 2.1 is the smallest live loop, nothing more.

### Architecture constraints that bind this story

- **One shared `http.Server`** hosts both Express and Socket.IO. [Source: architecture.md — "One shared http.Server hosts both Express and Socket.IO"]
- **REST/Socket split:** Express (REST) for non-realtime edges; Socket.IO for in-match events. In 2.1 the only REST is `/api/health`. [Source: architecture.md#API-split]
- **Client state = React built-ins only:** `useReducer` + context; one reducer owns connection + screen + snapshot. No Redux/Zustand. A single status enum for connection. [Source: architecture.md — "React 19 built-ins only", "single client-side status enum"]
- **Basic hardening:** CORS locked to the known origin; JSON body limits. Never CORS `*`. [Source: architecture.md — "Basic hardening only"]
- **Dev experience:** Vite HMR on the client; `tsx` watch on the server. The exact dev-script wiring is Danilo's to build and document. [Source: architecture.md#Development-Experience]
- **Engine stays clean:** `packages/engine` must not import from server/client/socket.io/pg. The dependency arrow points inward (server/client depend on engine, never the reverse). [Source: architecture.md — "Keep packages/engine free of imports from server/client"]
- **Naming:** React component files PascalCase (`App.tsx`); all other files camelCase. Socket events later use `domain:action` camelCase. [Source: architecture.md#Naming-Patterns]

### Recorded tech choices (from architecture)

- **React 19** (client) · **Express 5.2** (server REST) · **Socket.IO 4.8.x** (sockets) · **Vite** (client dev/build, create-vite scaffold) · **Vitest 4** (tests, all packages) · **tsx** (server dev runner) · **npm workspaces** monorepo. No new state library, no router yet (add react-router only when URLs demand it — that is 2.2's shareable link, decide then). [Source: architecture.md#Tech-Stack, #Decisions]
- Versions: let `create-vite` pick the current React + Vite; pin Express/Socket.IO/tsx to their current stable releases when you `npm install` them. Do not hand-guess version numbers — install and commit the lockfile.

### Previous work intelligence (Epic 1)

- The monorepo, npm workspaces, root `typecheck`/`test`/`format` scripts, Prettier, and the strict tsconfig (now including `noUnusedLocals` / `noUnusedParameters` / `allowUnreachableCode`) already exist from Epic 1 — build on them, do not recreate them.
- `packages/engine` is done: 109 tests, exports `applyCommand`, `createMatch`, `projectFor`, `mulberry32`, `onePieceDeck` (values) and the types. 2.1 does not call these yet; 2.2 will.
- Deferred items that touch this epic (`deferred-work.md`): the engine `dist` build (decision 1a — still deferred); dropping `--if-present` on root typecheck once every package has a `typecheck` script (the new server/client packages should each ship one); the `skipLibCheck` decision now matters because server/client pull in real `@types/*` (Express, Node, React) — decide consciously when typecheck first complains.
- Retro lesson applied here: this spec is written in plain English with terms defined — tell me if any part is still unclear and I will simplify it.

### Git intelligence

- Rhythm: branch `story/2.1` → scaffold + hand-write → AI writes tests → green → commit → push → PR → code-review → fix → merge.
- `main` after Epic 1: 109 tests, strict typecheck, Prettier clean, and the new no-unused-code tsconfig flags.

### Technical notes

- `create-vite` writes its own `package.json`, `tsconfig`, and `vite.config.ts` for the client — let it. Then fold the client into the workspace.
- The server `package.json` is hand-written. Add scripts: `dev` (`tsx watch ...`), `typecheck` (`tsc --noEmit`), and a `test`.
- For the health-endpoint test, exporting the Express `app` (separate from the `listen` call) makes it testable with `supertest` without opening a real port.
- CORS appears twice: once on Express (`cors` middleware) and once in the Socket.IO server options. Both must use the same locked origin.

### Project Structure Notes

- New: `packages/client/` (Vite react-ts scaffold; app code under `src/`, organized by role — `components/`, `state/` for the reducer + context), `packages/server/` (hand-built; `src/` with the Express app, the shared `http.Server`, the Socket.IO setup, and the dev entry). Extended: root `package.json` (the `dev` script). No change to `packages/engine`.

### References

- [Source: planning-artifacts/epics.md#Story-2.1] — story statement + ACs (verbatim)
- [Source: planning-artifacts/epics.md#Epic-2] — Epic 2 scope (FR1–5, FR8, FR11–12, FR16, FR19, FR26, FR29–30; NFR2 at the wire; NFR3)
- [Source: planning-artifacts/architecture.md] — starter choice (create-vite client + hand-built monorepo); one shared `http.Server`; REST/Socket split; React built-ins reducer; CORS hardening; `tsx` dev; engine-stays-clean rule
- [Source: planning-artifacts/prds/.../prd.md] — FR3 (real-time over the internet), NFR2 (hidden-info at the wire — enforced from 2.2 on), counter-metric time-to-playable
- [Source: implementation-artifacts/deferred-work.md] — engine `dist` build; `--if-present` typecheck; `skipLibCheck`

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. AI fills File List & Completion Notes at
     completion; Danilo adds entries himself when he wants.
     The review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement; create-vite scaffold + test files + Dev Agent Record AI-permitted)

### Debug Log References

### Completion Notes List
1b - Using `concurrently` to run both apps with clear labels
1c - Using fixed dev ports and locking CORS to the client origin
1d - Using React built-ins reducer with context for connection status
1e - Using built-in Socket.IO lifecycle events only (no custom game events yet)

### File List
