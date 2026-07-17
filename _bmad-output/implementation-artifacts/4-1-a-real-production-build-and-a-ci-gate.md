---
baseline_commit: 88cfabb5f87228e6aed18b6b2360914621cd4c7f
---

# Story 4.1: A real production build and a CI gate

Status: done

<!-- Process note (PRD D23): AI implements this story fully via bmad-dev-story — code, tests,
     commit, PR, review, merge. Danilo approves this spec before dev starts. -->

<!-- Writing note: plain, simple English. Short sentences. Define each new term on first use. -->

## Story

As the maintainer,
I want proper builds and a CI pipeline that blocks broken merges,
so that every deploy starts from a proven artifact.

**Plain-English goal:** Today the app only runs through dev tools (`tsx`, `vite dev`). Before anything can be deployed (stories 4.2/4.3), we need three things: a real **production build** (compiled JavaScript that plain Node can run), a **Docker image** of the server (the artifact Cloudflare Containers and Fly.io both consume), and a **CI gate** on GitHub so a broken change can't merge. This story also pays the oldest debt in `deferred-work.md` (from story 1.1): the engine package's `exports` point at a `.ts` file that plain Node cannot load.

**Terms used in this story (defined once):**
- **production build** — running `tsc` to compile TypeScript into plain JavaScript in `dist/` folders, then starting the server with `node`, not `tsx`.
- **Docker image** — a packaged, runnable copy of the server (code + Node + dependencies). Both D25 hosts consume the same image, which is why the fallback is cheap.
- **CI (continuous integration)** — GitHub Actions running lint, typecheck, tests, and the build on every pull request; merge is blocked if any fail.
- **conditional exports** — a package.json `exports` block that gives different answers to different consumers (e.g. dev tools get `src/index.ts`, production Node gets `dist/index.js`).

## Acceptance Criteria

(Verbatim from epics.md#Story-4.1, split for traceability.)

1. **Given** the monorepo, **when** I run `npm run build`, **then** engine and server compile with tsc to `dist/` (test files excluded), the client builds with vite, and `node packages/server/dist/server.js` serves a real match locally (engine imports resolved from built output, not src).
2. **Given** a pull request, **when** CI runs (GitHub Actions), **then** lint, typecheck, tests, and the build must all pass before merge; the same workflow builds the server Docker image to prove the Dockerfile.
3. **And** a `Dockerfile` exists for the server (workspace-aware, small base image), runnable locally: a container serves the health endpoint and a socket round-trip.

## Tasks / Subtasks

- [x] **Task 1: Design decisions BEFORE coding (AC: all) ⚠️ record each in Completion Notes**
  - [x] **1a — Engine module resolution (the hard one).** Engine `package.json` currently has `exports/main/types` → `./src/index.ts`; vitest and tsx resolve through it today. Production needs `dist/index.js`. Two candidate shapes — INVESTIGATE at implementation and record the winner with evidence (dev loop unchanged AND built server passes the smoke):
    - **Option A (preferred, matches architecture "plain tsc"):** conditional exports — `{ ".": { "types": "./src/index.ts", "development": "./src/index.ts", "default": "./dist/index.js" } }`, and DELETE the now-ignored top-level `main`/`types` fields. Dev-loop verification: vitest should need **zero config** — Vite 8's default conditions include the special `development|production`, which resolves to `development` under test. ⚠️ If config IS needed, do NOT set `resolve.conditions: ['development']` — on Vite 8 a user array REPLACES the defaults (breaking other packages); extend instead: `conditions: [...defaultServerConditions, 'development']`. tsx needs `--conditions development` on the server dev script (Node flag passthrough). Proof that A wins: edit an engine source file → a server test sees the change WITHOUT rebuilding (catches the silent-stale-dist failure mode).
    - **Option B (fallback, smallest change):** keep `exports` → src and ship `tsx` in the production image, running TypeScript directly. No resolution changes at all; costs a bigger image and slower boot, and deviates from the architecture's "plain tsc" line (would need an architecture amendment note per its own rule).
  - [x] **1b — Test-file exclusion.** Both engine and server tsconfigs `include: ["src"]` with co-located `*.test.ts` — a plain `tsc` build would emit test files (and their vitest imports) into `dist/`. Decide: `tsconfig.build.json` per package (`extends` the package tsconfig, `exclude: ["**/*.test.ts", "**/*.test.tsx"]`) with build scripts using `-p tsconfig.build.json`. Record.
  - [x] **1c — Build orchestration.** Root `build` script runs engine → server → client in order (architecture: script-ordered, no TS project references at 3 packages). Client build is untouched (`tsc -b && vite build` exists). Record.
  - [x] **1d — Docker shape.** ⚠️ FIRST: `@card-clash/engine` is NOT a declared dependency of the server (server package.json lists only cors/dotenv/express/pg/socket.io/zod) — resolution works today only because workspaces symlink everything into root node_modules. Add `"@card-clash/engine": "*"` to server dependencies (and note the engine's own prod dep `zod` must survive pruning), OR keep the full workspace layout in the image (root package.json + lock + all workspace package.jsons, `npm ci` at root) so the symlink is recreated — decide and record. Multi-stage: build stage (node:24, `npm ci`, build ONLY engine + server: `npm run build -w @card-clash/engine -w @card-clash/server` — do not run the client's vite build in the image) → runtime stage (node:24-slim or alpine — pick and record) with production node_modules (candidate: `npm ci --omit=dev`; record what actually works). `.dockerignore` with nested-safe patterns: `**/node_modules`, `**/dist`, `.git`, `_bmad*`, `.env*` (bare `node_modules` matches only at the context root). The image must NOT contain any `.env` (config injected at runtime — 4.2's concern, but the boundary is set here).
  - [x] **1e — Container port/config.** The port is a hardcoded `const port = 3000` (`server.ts:16`); `CLIENT_ORIGIN` is hardcoded in TWO files — `server.ts:17` (Socket.IO CORS) and `app.ts:5` (Express CORS) — per story 3.1 decision 2b (kept out of config on purpose). For a container, decide the minimal change: keep 3000 fixed and EXPOSE it (hosts map ports; simplest, recommended for this story) vs folding the port into `config.ts` now. CLIENT_ORIGIN stays hardcoded (4.3's concern). Whatever is chosen must not make `app.ts` require env at import (the 3.1 constraint). Record.
  - [x] **1f — CI workflow shape.** One `.github/workflows/ci.yml`: trigger on `pull_request` + `push` to `main`; pin action majors (`actions/checkout@v4`+, `actions/setup-node@v4`+ with `node-version-file: .nvmrc` and `cache: npm`); steps: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build` → `docker build` (no push — deploy workflows are 4.2/4.3). Tests need no DB (proven — the suite runs without a `.env`); do NOT add a Postgres service. Record.
  - [x] **1g — Making the gate actually block.** A workflow alone does not block merges — that needs branch protection with required status checks on `main`. Set it via `gh api repos/danilol/card-clash/branches/main/protection` (or the repo settings UI) requiring the CI job; record what was set. If the API needs permissions `gh` doesn't have, leave the exact click-path for Danilo in the completion notes instead of silently skipping AC2's "must pass before merge".

- [x] **Task 2: Engine + server builds (AC: 1)**
  - [x] Engine: `tsconfig.build.json`, `build` script, `exports` per decision 1a. Server: same pattern (`build` script → `dist/`).
  - [x] Root: `build` script (engine → server → client). `npm run build` from a clean checkout succeeds.
  - [x] Prove the dev loop is UNBROKEN: `npm test` green, `npm run dev` works, and an engine source edit is picked up without rebuilding (per 1a evidence).

- [x] **Task 3: Dockerfile (AC: 3)** — repo root (needs workspace context)
  - [x] Multi-stage `Dockerfile` per 1d + `.dockerignore`.
  - [x] `docker build` succeeds locally; `docker run -p 3000:3000 -e DATABASE_URL=...` serves `/api/health`. ⚠️ Inside the container `localhost` is the container itself — the host's Postgres would be `host.docker.internal` on macOS. But note: this smoke (health + create/join) never touches the DB at all (the pool is lazy; writes only happen at match end), so any zod-valid `DATABASE_URL` passes startup — do NOT claim "Postgres works from the container" unless a match is actually finished through it.
  - [x] Socket round-trip against the container (no committed smoke script exists — write a small one; protocol: `POST /api/matches` `{nickname}` → `{matchId}`; two `socket.io-client` connections; `match:join` `{matchId, nickname}` with ack; expect `match:state` on both once the second joins — event contract in `packages/server/src/sockets/matchHandlers.ts`).

- [x] **Task 4: CI workflow (AC: 2)**
  - [x] `.github/workflows/ci.yml` per 1f.
  - [x] Push the branch → the workflow runs on GitHub and is green end to end (this story's PR is itself the proof).

- [x] **Task 5: Tests**
  - [x] No new unit tests expected (this story is build infrastructure); the REGRESSION bar is the point: full suite green (baseline 187), lint, typecheck — locally AND in CI.
  - [x] Built-output smoke: `node packages/server/dist/server.js` + a scripted match (create/join/one round) against it — proves AC1's "engine imports resolved from built output".

- [x] **Task 6: Prove it (AC: all)**
  - [x] Clean-ish verification: `npm run build` → run the dist server → smoke passes → stop.
  - [x] Docker: build + run + health + socket smoke (Task 3).
  - [x] CI green on the PR (Task 4). README gets a short "Build & CI" section.
  - [x] Commit on `story/4.1`, push, PR, `bmad-code-review`, merge per D23.

### Review Findings

Code review 2026-07-17 (three parallel layers; auditor verdict: all 3 ACs satisfied, verified live — it deleted the dists and re-ran the suite itself; Edge Case Hunter empirically disproved two suspected edges with a dist-marker test and sandbox installs). Triage: 6 patch, 2 defer/4.2-scoped, 7 dismissed with evidence.

- [x] [Review][Patch] Client imports the engine in 8+ files but never declared it as a dependency (verified: `npm ci -w client` creates no engine symlink) [packages/client/package.json] — fixed: `"@card-clash/engine": "*"` added.
- [x] [Review][Patch] CI built the image but never booted it — a broken CMD/runtime dep would ship green (two layers + auditor's "testimonial evidence" note converged) — fixed: committed `scripts/smoke.mjs` (create/join/one round) + CI step that runs the container, curls health, and plays a round; smoke verified locally against the container.
- [x] [Review][Patch] `.dockerignore` `.env*` matched only the context root — a future `packages/server/.env` could enter build-stage layers — fixed: `**/.env*` (+ `scripts` excluded from the image context).
- [x] [Review][Patch] CI workflow had default (write) token permissions and no concurrency control — fixed: `permissions: contents: read` + per-ref concurrency with cancel-in-progress; also added `npx prettier --check .` (verified passing repo-wide first).
- [x] [Review][Patch] Node major pinned in two unlinked places (.nvmrc vs three Dockerfile FROM lines) — fixed: sync comment in the Dockerfile.
- [x] [Review][Patch] Ad-hoc server runs (node/tsx/debugger) without `--conditions=development` silently execute stale engine dist — fixed: README warning.
- [x] [Review][Defer] Migrations + node-pg-migrate are not in the image — INTENTIONAL: the spec assigns "where migrations run in deploy" to story 4.2 (must be decided there, not silently forgotten).
- [x] [Review][Defer] No Docker layer caching in CI — full run is 1m24s; not worth the complexity yet. Revisit if CI slows.

Dismissed with evidence: missing `outDir` (set in package tsconfigs; container ran); stale-dist client bundles (marker test proved `vite build` resolves src); `exclude` replacement (base configs have no exclude; dist outside include); dropped `main`/`types` node10 fallback (no node10 consumers in the stack); no CI DB service (suite is DB-free by design and green); dangling client symlink in image (verified absent — `npm ci -w server` links engine+server only); unpinned `node:24-slim` (deliberate major pin, now documented).

## Dev Notes

### Working agreement

- AI implements everything (D23). This spec was approved by Danilo before dev. [Source: .decision-log.md#D23]

### Scope guard — what is NOT in 4.1

- **No deploying anywhere** — no wrangler, no Cloudflare/Fly accounts, no Neon. Stories 4.2/4.3.
- **No deploy workflow** — CI here tests and builds only; `docker build` without push.
- **No API-base/client env work** — 4.3 (`VITE_API_URL`).
- **No graceful shutdown / SIGTERM handling** — 4.2 (with the real host's lifecycle).
- **No CI database service** — the suite deliberately needs no DB; do not add a Postgres service container.

### Architecture constraints that bind this story

- **"Production build is plain tsc for engine/server, vite build for client; build order engine → server → client via script (no project references)."** Option 1a-B deviates from this — if chosen, amend the architecture doc first (its own rule). [Source: architecture.md — Development Workflow Integration]
- **Engine purity, projectFor-only door, data boundary — untouched** (this story moves no product code).
- **`app.ts` must stay importable without env** (3.1 decision 2b; supertest suite depends on it). Any PORT/config change must respect this.
- **Node 24 LTS, ESM (`"type": "module"`), nodenext resolution** — the compiled output keeps `.js` specifiers (already written as `.js` imports throughout). [Source: architecture.md — stack]

### The 1.1 debt this story closes (deferred-work.md, 2026-06-11)

- "`outDir: 'dist'` is configured … but no build script exists, and `include: ['src']` would emit `*.test.ts` into dist (importing devDependency vitest)" → Task 2 / decision 1b.
- "Engine `exports`/`main`/`types` point at `./src/index.ts` … plain Node cannot load `.ts` from `node_modules`. MUST be repointed to `dist/`" → decision 1a. Mark both items resolved in deferred-work.md when done.

### Previous work intelligence

- Suite baseline: 187 tests, 19 files; lint (`eslint .`) and `typecheck` (root `tsc --noEmit && npm run typecheck --workspaces`) both green and DB-free — CI can run all of them with no services.
- `config.ts` resolves the root `.env` via `new URL('../../../.env', import.meta.url)` — `dist/config.js` sits at the same depth as `src/config.ts` (both one dir under `packages/server`), so the path survives the build; `dotenv.config` on a missing file is quiet (container case).
- The migrate scripts use `--envPath ../../.env` — irrelevant inside the image (migrations run from CI/dev, not from the container; 4.2 decides where they run in deploy).
- The client `dev`/`build` and root `dev` (concurrently) scripts must keep working exactly as today — Danilo demos with `npm run dev`.
- Prettier DOES format YAML by default — `npm run format` will rewrite `ci.yml`; write it Prettier-compatible (2-space indent) so format runs don't churn it. ESLint does not check YAML.

### Project Structure Notes

- New: `packages/engine/tsconfig.build.json` · `packages/server/tsconfig.build.json` · `Dockerfile` · `.dockerignore` · `.github/workflows/ci.yml`.
- Update: `packages/engine/package.json` (exports per 1a, build script) · `packages/server/package.json` (build script) · root `package.json` (build script) · possibly `vitest.config.ts` / server dev script (1a conditions) · `README.md` (Build & CI section).
- No product source files change (except possibly `server.ts`/`config.ts` if 1e folds PORT in — keep minimal).

### References

- [Source: epics.md#Story-4.1] — story statement + ACs (verbatim)
- [Source: .decision-log.md#D25] — deployment stack; the Docker image is the shared artifact for both hosts
- [Source: architecture.md — Development Workflow Integration; Infrastructure & Deployment]
- [Source: implementation-artifacts/deferred-work.md — 1-1 section] — the two build debts this story closes
- [Source: .decision-log.md#D23] — AI implements; Danilo approves

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

- Docker Desktop was not running; launched via `open -a Docker` (also woke unrelated Supabase containers from Danilo's other project — untouched).
- First `docker build` took >10 min (base image pull) — subsequent builds are cached and fast.

### Completion Notes List

Decisions:
- 1a — **Option A won, with the strongest possible evidence:** conditional exports (`types`/`development` → `src/index.ts`, `default` → `dist/index.js`; top-level `main`/`types` deleted). Vitest needed ZERO config — the full 187-test suite passed with `dist/` deleted entirely, which proves dev resolution uses `src` (nothing else existed to resolve to). tsx dev script gained `--conditions=development` and was verified to boot with no dist present. The built server then passed the smoke with the engine resolved from `dist`.
- 1b — `tsconfig.build.json` per package (`extends` package tsconfig, excludes `**/*.test.ts(x)`); build scripts use `-p tsconfig.build.json`. Verified: zero `*.test.js` files in either dist.
- 1c — root `build` = engine → server → client via `&&`-chained `npm run build -w …`. Client build untouched. Server also gained `start` (`node dist/server.js`).
- 1d — engine added as a declared server dependency (`"@card-clash/engine": "*"`). Three-stage Dockerfile on `node:24-slim`: build stage (full `npm ci`, builds engine+server only — no vite build in the image), deps stage (`npm ci --omit=dev -w @card-clash/server` — creates the workspace symlink and hoists engine's zod), runtime stage (root+engine+server package.jsons for ESM `"type": "module"` resolution, node_modules, both dists). Image: 368 MB. `.dockerignore` uses nested-safe `**/` patterns; no `.env` can enter the image.
- 1e — port stays the hardcoded 3000 with `EXPOSE 3000` (hosts map ports); CLIENT_ORIGIN untouched (4.3). `app.ts` still imports without env.
- 1f — one `ci` job: checkout@v4, setup-node@v4 (`node-version-file: .nvmrc`, `cache: npm`), `npm ci` → lint → typecheck → test → build → `docker build` (no push). No DB service (suite needs none). Job named plain `ci` so a future required-status-check context is a stable string.
- 1g — **RESOLVED 2026-07-17:** Danilo made the repo public; branch protection on `main` is now active with required status check `ci` (set via `gh api`, verified). A red CI run now hard-blocks merges — AC2 fully enforced. (The original 403 blocker and click-path are kept in git history.)

Verification:
- Dev loop: 187 tests green with no dists; `tsx watch --conditions=development` boots with no dists; `npm run dev` unchanged for the client.
- AC1: `npm run build` clean; `node packages/server/dist/server.js` served health + create/join (16-card deal) + one resolved round — engine `createMatch`/`projectFor`/`applyCommand` all from built output.
- AC3: `docker build` (368 MB) → `docker run -p 3400:3000 -e DATABASE_URL=…` → health ok + the same socket smoke passed against the container; container removed after.
- AC2: workflow file in place; the PR for this story is itself the live CI proof (verified green before merge). Blocking enforcement pending the 1g plan decision.
- Regression gates: lint green, typecheck clean, 187/187 tests, prettier applied.
- deferred-work.md: the two 1.1 build debts marked resolved.

### Change Log

- 2026-07-17 — Story 4.1 implemented. Real production builds (conditional exports close the 1.1 engine-exports debt; tsconfig.build.json closes the tests-in-dist debt), three-stage 368 MB server Docker image, GitHub Actions CI (lint/typecheck/test/build/docker). Branch protection blocked by GitHub plan — decision left to Danilo (1g).
- 2026-07-17 — Addressed code review findings: 6 patches (client engine dependency, committed smoke script + CI container-boot step, .dockerignore hardening, CI permissions/concurrency/format-check, Node-version sync comment, README stale-dist warning), 2 deferred. Story → done.

### File List

- packages/engine/package.json (modified — conditional exports, main/types removed, build script)
- packages/engine/tsconfig.build.json (new)
- packages/server/package.json (modified — engine dependency, build/start scripts, dev script `--conditions=development`)
- packages/server/tsconfig.build.json (new)
- package.json (modified — root build script)
- package-lock.json (modified — engine dep)
- Dockerfile (new) / .dockerignore (new)
- .github/workflows/ci.yml (new)
- README.md (modified — Build & CI section)
- _bmad-output/implementation-artifacts/deferred-work.md (modified — 1.1 items resolved)
- scripts/smoke.mjs (new — review patch: committed smoke, run by CI against the container)
- packages/client/package.json (modified — review patch: engine dependency declared)
