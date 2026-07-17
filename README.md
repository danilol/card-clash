# card-clash

One Piece Top Trumps for two players over a shared link. Engine and Epics 1–2 (through story 2.5) hand-written by Danilo as TypeScript interview practice; from 2026-07-16 development is AI-implemented via BMAD with Danilo directing and approving.

## Stack

TypeScript 6 · Node 24 LTS · npm workspaces · Vitest 4 · zod 4
Express 5 + Socket.IO 4.8 · React 19 + Vite 8 · PostgreSQL (pg + node-pg-migrate)

## Local database

Finished matches are persisted to PostgreSQL (any modern version; a Homebrew
`postgresql@14`+ service works):

```sh
brew install postgresql@14 && brew services start postgresql@14  # if not installed
createdb card_clash_dev
cp .env.example .env                    # DATABASE_URL lives at the repo root
npm run migrate -w @card-clash/server   # creates the matches table
```

A DB failure never blocks gameplay — the server logs it and the match still
ends normally.

## Build & CI

- `npm run build` — engine and server compile with tsc to `dist/` (test files
  excluded), the client builds with vite. `npm start -w @card-clash/server`
  runs the built server with plain Node.
- Engine resolution: dev tools (vitest, tsx via `--conditions=development`)
  load `src/`; production Node loads `dist/` (conditional `exports`).
  ⚠️ Running the server ad-hoc (`node`, `tsx`, an IDE debugger) WITHOUT
  `--conditions=development` resolves the engine from a possibly stale
  `dist/` — use `npm run dev`, or pass the flag.
- `node scripts/smoke.mjs [baseUrl]` — create/join/one-round smoke against
  any running server (CI runs it against the built container).
- `docker build -t card-clash-server .` — the server image (engine + server
  only; the client deploys separately). Run:
  `docker run -p 3000:3000 -e DATABASE_URL=... card-clash-server`.
- CI (`.github/workflows/ci.yml`): lint, typecheck, tests, build, and the
  Docker build run on every PR and push to main.

## Packages

| Package           | Role                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `packages/engine` | Pure, deterministic rules engine — no I/O, zod is its only dependency. The unit-test showcase. |
| `packages/server` | _(planned, Epic 2)_ Express 5 + Socket.IO; server-authoritative match state                    |
| `packages/client` | _(planned, Epic 2)_ React 19 SPA rendering per-player projections                              |

## Commands

Requires **Node ≥24** — enforced at install time via `.npmrc` (`engine-strict=true`).

```bash
npm install        # bootstrap all workspaces (fails on Node <24 by design)
npm run dev        # start both client and server concurrently
npm test           # vitest run across all projects
npm run typecheck  # root tsc (vitest.config.ts), then per-workspace tsc --noEmit
```

## Docs

Planning artifacts (PRD, architecture, epics, stories) live in `_bmad-output/`.
The architecture document is the binding consistency contract: `_bmad-output/planning-artifacts/architecture.md`.
