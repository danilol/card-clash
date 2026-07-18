---
baseline_commit: 281c4e06172e8b8b909c88fd1a677fc9a2863283
---

# Story 4.2: The server lives on the internet

Status: in-progress

<!-- Process note (PRD D23): AI implements this story fully via bmad-dev-story — code, tests,
     commit, PR, review, merge. Danilo approves this spec before dev starts.
     ⚠️ THIS story has three HUMAN-GATED steps (billing, logins) — see Task 1a. -->

<!-- Writing note: plain, simple English. Short sentences. Define each new term on first use. -->

## Story

As a player,
I want the game server reachable at a public URL,
so that matches don't depend on anyone's laptop.

**Plain-English goal:** The Docker image from 4.1 goes live. Per decision D25: the server runs on **Cloudflare Containers** (a small Worker forwards every request — including WebSockets — to our container), the database moves to **Neon** (managed Postgres), and a **deploy workflow** ships every merge to `main` automatically. The story STARTS with a spike (a small throwaway experiment to answer a question cheaply) because one thing can only be learned by trying: whether a live Socket.IO match survives Cloudflare's container sleep behavior. If it doesn't, we switch to the pre-agreed Fly.io fallback — same image, no re-planning.

**Terms used in this story (defined once):**
- **Worker glue** — a tiny Cloudflare Worker + `Container` class (from `@cloudflare/containers`, bound as a Durable Object) that receives requests at the public URL and forwards them to the running container.
- **spike** — a time-boxed experiment with explicit pass/fail criteria, thrown away afterward; only its ANSWER is kept.
- **`sleepAfter`** — Container setting: how long with no requests before Cloudflare puts the container to sleep (killing our in-memory matches — accepted semantics per D25).
- **deploy workflow** — a second GitHub Actions file that runs on push to `main` (merges are already CI-gated by branch protection): migrate the Neon DB, then `wrangler deploy`.

## Acceptance Criteria

(Verbatim from epics.md#Story-4.2, split for traceability.)

1. **Given** the Dockerfile from 4.1, **when** the deploy workflow runs on merge to main, **then** the server runs on Cloudflare Containers behind a Worker (spike task first: verify WebSocket + idle/sleep semantics with a live Socket.IO match; if matches die mid-play from container sleep, fall back to Fly.io per D25 without re-planning).
2. **And** `DATABASE_URL` points at a Neon Postgres (migrations run against it), config comes from real env (no .env in the image), and the container shuts down gracefully (`pool.end()` on SIGTERM — closes the deferred-work item).
3. **And** a finished match played over the public URL lands in Neon and a `[db]`-style failure never crashes the deployed server.

## Tasks / Subtasks

- [ ] **Task 1: Design decisions + HUMAN-GATED setup (AC: all) ⚠️ record each in Completion Notes**
  - [ ] **1a — Danilo's three inputs (BLOCKING, in order).** Nothing deploys before these:
    1. **Billing consent:** Cloudflare Containers needs the Workers PAID plan (~$5/mo base). Danilo confirms explicitly in chat before the first deploy attempt.
    2. **Cloudflare auth:** `! npx wrangler login` typed by Danilo in-session (or a `CLOUDFLARE_API_TOKEN` he provides). The GitHub deploy workflow needs an API token as a repo secret regardless — create one scoped to Workers+Containers.
    3. **Neon:** Danilo creates a free Neon project (or provides an existing one) and supplies its `DATABASE_URL`. Stored ONLY as: local `.env` (gitignored) for verification + GitHub repo secret for the workflow. Never committed, never echoed into chat logs more than necessary.
  - [ ] **1b — Spike design + go/no-go criteria (AC1).** Hand-deploy (no workflow yet) the 4.1 image behind a minimal Worker to a `workers.dev` URL, then measure:
    - (i) Socket.IO works end to end through the Worker, including the WebSocket upgrade (`scripts/smoke.mjs <public-url>` passes).
    - (ii) A live match survives: for the SPIKE set a SHORT `sleepAfter` (`1m`–`2m`) so the test is fast and repeatable — keep a joined match idle (open WebSockets, no messages) past it, then play a round. Does it still work? An open WebSocket should count as activity; verify, don't assume. The production value (e.g. `30m`) is set only AFTER go.
    - (iii) Cold start after sleep is tolerable for match creation (a few seconds is fine).
    **Any criterion fails → STOP, record evidence, switch to Fly.io (D25 pre-agreed): same image, `fly launch`/`fly deploy`, secrets via `fly secrets`.** Do not sink time into working around Containers.
  - [ ] **1c — Worker glue shape.** ⚠️ The match store is IN-MEMORY — there must be exactly ONE container instance, ever: `max_instances = 1` and a fixed singleton id via `getContainer(env.GAME_SERVER, 'singleton')` (or equivalent) so every request lands on the same instance. `defaultPort = 3000` (the image's EXPOSE). Production `sleepAfter` chosen from spike evidence (e.g. `30m`; scale-to-zero between play sessions is the point of Containers). Also decide `instance_type` explicitly (default is the smallest ~256 MiB — likely enough for Node+socket.io, but choose it, don't inherit it). Record the exact wrangler config.
  - [ ] **1d — Secrets into the container.** `wrangler secret put DATABASE_URL` on the Worker; the Container class forwards it via `envVars = { DATABASE_URL: this.env.DATABASE_URL }`. Verify in the spike that the container process actually sees it (the server fail-fasts without it — a crash-looping container IS the signal). Record.
  - [ ] **1e — Migrations in deploy (the 4.1 deferred decision).** Migrations run FROM the deploy workflow against Neon, before `wrangler deploy`: `DATABASE_URL=<secret> npm run migrate -w @card-clash/server`. VERIFIED at spec time: the existing script's `--envPath ../../.env` is SILENT when the file is missing (dotenv returns the error without throwing) and node-pg-migrate falls through to `process.env.DATABASE_URL` — so the existing script works in CI as-is. A `migrate:ci` alias is optional clarity, not a necessity. Record which was used.
  - [ ] **1f — Deploy workflow shape.** New `.github/workflows/deploy.yml`: trigger `push` to `main` (already protection-gated); steps: checkout → setup-node → root `npm ci` → migrate (1e) → **`npm ci` INSIDE `deploy/cloudflare`** (it is not a workspace — without this, `wrangler` and `@cloudflare/containers` are missing and the first deploy fails; its own `package-lock.json` MUST be committed) → `npx wrangler deploy` from that directory. `wrangler deploy` needs Docker on the runner — `ubuntu-latest` has it; add nothing. Secrets: `CLOUDFLARE_API_TOKEN`, `NEON_DATABASE_URL` (set via `gh secret set`). `permissions: contents: read`; concurrency group with **`cancel-in-progress: false`** (never kill a mid-flight deploy — do NOT copy ci.yml's `true`). Record.
  - [ ] **1g — Image platform.** Cloudflare runs linux/amd64. `wrangler deploy` builds and pushes the image itself; the CI deploy runner is natively amd64. ⚠️ The SPIKE deploys from Danilo's Apple Silicon Mac — docs don't explicitly promise amd64 targeting there, so set `DOCKER_DEFAULT_PLATFORM=linux/amd64` for the spike's wrangler run and/or verify the pushed image's platform before blaming anything else for a crash loop. Record.
  - [ ] **1h — What stays broken on purpose.** Server CORS (`CLIENT_ORIGIN`) is still hardcoded to `http://localhost:5173` — browsers can't use the public URL yet. Fine: 4.2's verification is script-based (no browser CORS); 4.3 makes origins env-driven when the client deploys. Record so nobody "fixes" it here.

- [ ] **Task 2: Graceful shutdown (AC: 2 — closes the deferred-work item)** — `packages/server`
  - [ ] `server.ts`: on SIGTERM/SIGINT — log, `io.close()` (stops sockets + underlying http server), `pool.end()` (from a new `closePool()` export in `pool.ts` that no-ops if the pool was never created), then `process.exit(0)` explicitly; a short force-exit timer (e.g. 5s, `.unref()`'d) so a hung close can't block shutdown forever.
  - [ ] Verify: `docker stop` (sends SIGTERM) on a locally-run container → shutdown log lines, exit within the timeout, no crash trace.

- [ ] **Task 3: Worker glue (AC: 1)** — new top-level `deploy/cloudflare/`
  - [ ] Own mini-project (NOT an npm workspace member — keep the game monorepo clean): `package.json` + COMMITTED `package-lock.json` (`wrangler`, `@cloudflare/containers`), `wrangler.jsonc` (containers config pointing at `../../Dockerfile`, DO binding + migration, `max_instances = 1`), `src/worker.ts` (Container class per 1c/1d + fetch handler forwarding everything to the singleton).
  - [ ] Typecheck the worker: minimal `tsconfig.json` in `deploy/cloudflare` with `@cloudflare/workers-types` (or `wrangler types`) — wrangler's esbuild bundling does NOT type-check.
  - [ ] Hygiene: root `.gitignore` (`node_modules/`) and eslint (`**/node_modules`) already cover the new dir — verify, don't re-add. New files (worker.ts, deploy.yml, jsonc) must pass `npx prettier --check .` — CI enforces it.

- [ ] **Task 4: Neon (AC: 2)**
  - [ ] With Danilo's `DATABASE_URL` (1a) — ⚠️ it must be the DIRECT (non-pooler) endpoint: Neon's `-pooler` URL is PgBouncer transaction mode, which breaks node-pg-migrate's session assumptions. Run the migration against Neon, verify the table exists (psql `\d matches`, or skip psql and use the story's own pattern — a local server pointed at Neon + `curl /api/matches/recent`), and verify the local server runs against Neon once (proves TLS: Neon needs `sslmode=require`; check whether the URL param suffices for `pg` or an `ssl` config option is needed).
  - [ ] `.env.example` gains a commented Neon-shaped example line.

- [ ] **Task 5: The spike, then the real deploy (AC: 1)**
  - [ ] Run the 1b spike; record pass/fail per criterion WITH evidence in Completion Notes.
  - [ ] PASS → wire the final config; the public URL serves `/api/health` and `scripts/smoke.mjs <url>` passes. FAIL → execute the Fly fallback (same Task shape: `fly.toml`, secrets, deploy) and record the D25 fallback as taken.
  - [ ] `gh secret set CLOUDFLARE_API_TOKEN` / `NEON_DATABASE_URL`; commit `deploy.yml`; the story PR merge is the first live workflow run — verify it deploys.

- [ ] **Task 6: Prove it (AC: 3)**
  - [ ] `scripts/smoke.mjs https://<public-url>` — create/join/round over the internet.
  - [ ] Scripted FULL match over the public URL → `curl https://<public-url>/api/matches/recent` shows the new row (Neon write proven end to end, using our own API as the checker).
  - [ ] Forfeit over the real network: disconnect one client → survivor gets the forfeit within ~10s; row `end_reason='forfeit'` appears.
  - [ ] Break-glass check: temporarily point the Worker secret at an invalid DB URL is NOT required — the DB-failure path was proven in 3.1/3.2 and re-testing in prod risks confusion; instead verify the deployed logs show clean `[db]`-style behavior if anything fails during the smoke. (Honest scoping, not skipped verification.)
  - [ ] README: "Deployment" section (hosts, secrets, how to redeploy, how to see logs — `wrangler tail`).
  - [ ] Commit on `story/4.2`, push, PR, `bmad-code-review`, merge per D23; POST-MERGE: watch the first `deploy.yml` run and re-run the public smoke.

## Dev Notes

### Working agreement

- AI implements everything (D23), EXCEPT the three 1a human gates (billing, Cloudflare auth, Neon account) which Danilo does interactively. This spec was approved by Danilo before dev. [Source: .decision-log.md#D23; #D25]

### Scope guard — what is NOT in 4.2

- **No client work** — no `VITE_API_URL`, no Pages, no CORS-from-env (4.3). Browsers CANNOT play against the public URL yet; scripts can.
- **No custom domain** — `workers.dev` URL is fine until 4.3 decides otherwise.
- **No scaling** — `max_instances = 1` is a hard architectural requirement (in-memory store), not a cost choice.
- **No reconnect work** — a container sleep/redeploy still kills in-flight matches (D25 accepted; D16 reconnect is the later fix).
- **No CI layer-caching / registry work** beyond what `wrangler deploy` does itself.

### Architecture constraints that bind this story

- **In-memory match store ⇒ exactly one instance** — the whole request path must pin to a single container (1c). If Containers can't guarantee that, it's a spike FAIL criterion. [Source: architecture.md — Data Architecture]
- **Config via env only; fail-fast `loadConfig()` at startup** — a missing secret shows as a crash-looping container, which is correct behavior. No `.env` in the image (4.1 boundary). [Source: architecture.md — Infrastructure]
- **The image is the artifact** — deploy consumes the 4.1 Dockerfile unchanged (except Task 2's shutdown handler, which is server code, not image config).
- **Server restart kills in-flight matches — accepted** (D25 = same semantics as v1 local). [Source: .decision-log.md#D25]

### Previous work intelligence

- `scripts/smoke.mjs [baseUrl]` (4.1, committed) is the verification tool for every stage: local container → spike URL → final URL. It plays a real round — exactly what the spike's WS criterion needs. For the sleep test, run it, WAIT > sleepAfter with sockets open, then drive the chooser again.
- `pool.ts` is lazy with an error listener and timeouts (3.1/3.2 reviews); `closePool()` must handle "pool never created" (health-only traffic).
- The 3.2 review deferred `pool.end()` explicitly to this story (deferred-work.md) — mark it resolved.
- `GET /api/matches/recent` (3.2) doubles as the end-to-end Neon verifier — no psql needed against prod for Task 6.
- The migrate scripts hardcode `--envPath ../../.env` (3.1 decision 2a) — see 1e for the CI variant.
- Forfeit detection is ~10s (`pingInterval`/`pingTimeout` 5000/5000, story 2.6) — the Task 6 forfeit check inherits it; through a proxy/Worker the timings may stretch slightly; allow margin.
- Cloudflare facts current as of 2026-07: Containers GA (2026-04), Worker + Container-class (Durable Object) glue, `defaultPort`/`sleepAfter`/`envVars` on the class, wrangler builds and pushes the image. Verify against live docs during the spike — the platform is young and moves.

### Project Structure Notes

- New: `deploy/cloudflare/` (package.json, wrangler.jsonc, src/worker.ts — own mini-project, not a workspace) · `.github/workflows/deploy.yml`.
- Update: `packages/server/src/server.ts` (SIGTERM handler) · `packages/server/src/db/pool.ts` (`closePool()`) · `packages/server/package.json` (`migrate:ci`) · `.env.example` (Neon example) · README (Deployment section) · deferred-work.md (graceful-shutdown item resolved).
- The game packages and Dockerfile are otherwise untouched.

### References

- [Source: epics.md#Story-4.2] — story statement + ACs (verbatim)
- [Source: .decision-log.md#D25] — stack, fallback pre-agreement, accepted sleep semantics
- [Source: architecture.md — Data Architecture; Infrastructure & Deployment]
- [Source: implementation-artifacts/4-1-…-ci-gate.md] — image shape, smoke script, migrations-deferred note
- [Source: implementation-artifacts/deferred-work.md — 3-2 section] — the `pool.end()` item this story closes
- Cloudflare docs consulted 2026-07-17: containers overview / get-started / wrangler containers commands (verify at spike time)

## Dev Agent Record

### Agent Model Used

claude-fable-5

### Debug Log References

### Completion Notes List

Decisions (fill at implementation):
- 1a — human gates (billing consent, wrangler auth, Neon URL) — when/how provided:
- 1b — spike results per criterion, with evidence; go/no-go:
- 1c — final wrangler config (instance pinning, sleepAfter):
- 1d — secret path into the container:
- 1e — migrate:ci shape:
- 1f — deploy.yml shape:
- 1g — image platform handling:
- 1h — CORS stays localhost (4.3):

### File List
