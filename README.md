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
- `docker build -t card-clash .` — the whole game in one image: the server,
  which also serves the built client. Run:
  `docker run -p 3000:3000 -e DATABASE_URL=... card-clash`, then open
  `http://localhost:3000`.
- CI (`.github/workflows/ci.yml`): lint, typecheck, tests, build, and the
  Docker build + smoke run on every PR and push to main.

## Deployment

The game runs on **one free Render web service** (decision D26), with the
database on **Neon** (free). The server serves the website, the REST API and
Socket.IO from one address, so there is no CORS setup and the client uses
relative URLs. In dev, Vite proxies `/api` and `/socket.io` to the server
for the same shape.

| Piece    | Where                                            | Config                                                   |
| -------- | ------------------------------------------------ | -------------------------------------------------------- |
| Service  | Render, from `render.yaml` (Blueprint)           | Docker, free plan, Frankfurt, health check `/api/health` |
| Database | Neon                                             | `DATABASE_URL` — the DIRECT (non-pooler) URL             |
| Deploy   | `.github/workflows/deploy.yml` on push to `main` | secrets `NEON_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`    |

- **How a deploy happens:** a merge to `main` runs `deploy.yml`. It migrates
  Neon first, then calls the Render deploy hook. Render builds the
  Dockerfile and switches over once `/api/health` answers. Auto-deploy on
  Render is off, so a deploy never skips the migration.
- **Redeploy by hand:** Render dashboard → service → Manual Deploy, or
  re-run the Deploy workflow in GitHub Actions.
- **Logs:** Render dashboard → service → Logs. Look for `[db]` and
  `[shutdown]` lines.
- **Env vars:** `DATABASE_URL` is set in the Render dashboard (never in git).
  `PORT` is set by Render itself; locally it defaults to 3000.
- **Sleep:** the free service sleeps after 15 minutes with no HTTP request
  and no incoming WebSocket message. The first visitor after that waits
  about 1 minute. A sleep or redeploy ends matches in progress (no
  reconnect yet). A connected match keeps the service awake: Socket.IO's
  ping/pong runs every 5 seconds.

## Packages

| Package           | Role                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `packages/engine` | Pure, deterministic rules engine — no I/O, zod is its only dependency. The unit-test showcase. |
| `packages/server` | Express 5 + Socket.IO; server-authoritative match state; serves the built client in production |
| `packages/client` | React 19 SPA rendering per-player projections                                                  |

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
