---
baseline_commit: 281c4e06172e8b8b909c88fd1a677fc9a2863283
---

# Story 4.2: The game lives on the internet

Status: in-progress — spec approved 2026-10-25; code done, waiting on Danilo's Render steps (Task 6)

<!-- Process note (PRD D23): AI implements this story fully via bmad-dev-story — code, tests,
     commit, PR, review, merge. Danilo approves this spec before dev starts.
     ⚠️ THIS story has HUMAN-GATED steps (Render account, a real two-browser match) — see Task 1a. -->

<!-- Writing note: plain, simple English. Short sentences. Define each new term on first use. -->

<!-- History: first written 2026-07-17 for Cloudflare Containers (D25) as "The server lives on
     the internet". Re-scoped 2026-10-25 (D26): hosting must be free, so Render replaces
     Cloudflare, and the server now also serves the client — the old Story 4.3 is merged here.
     The WIP commit 6e11bf7 is kept for its graceful shutdown + Neon work; its Cloudflare
     files are removed by this story. -->

## Story

As a player,
I want to open a public web page, create a match, and send the link to a friend anywhere,
so that we can play for real without anyone's laptop running.

**Plain-English goal:** The whole game goes live at ONE free address. A Render free web service runs our Docker image. The server inside it answers three kinds of requests on the same address: the website (the built React files), the REST API, and Socket.IO. The database is Neon (free, already set up). Every merge to `main` deploys automatically. Cost: zero.

**Terms used in this story (defined once):**

- **Render web service** — a program Render runs for us from our Docker image, reachable at a public `https://<name>.onrender.com` address.
- **sleep (spin-down)** — on the free plan, Render stops the service after 15 minutes with no incoming HTTP request and no incoming WebSocket message. The next visitor wakes it; that takes about 1 minute.
- **same origin** — the page and the server it talks to share one address (scheme + host + port). Then the browser needs no CORS permission, and the client can use relative URLs like `/api/matches`.
- **relative URL** — a URL without a host (`/api/matches`). The browser fills in the address of the current page.
- **Vite proxy** — in dev, the Vite server (port 5173) forwards `/api` and `/socket.io` requests to our server (port 3000). The browser only sees 5173, so dev is same-origin too.
- **deploy hook** — a secret URL from Render. A `POST` to it starts a deploy.

## Acceptance Criteria

(Verbatim from epics.md#Story-4.2, re-scoped 2026-10-25, split for traceability.)

1. **Given** the Docker image from 4.1, now also containing the built client, **when** the deploy workflow runs on merge to main, **then** Neon migrations run first, then one Render free web service deploys the image, and a single public URL serves the website, the REST API and Socket.IO.
2. **And** config comes from real env (`DATABASE_URL`, `PORT`; no .env in the image), the container shuts down gracefully on SIGTERM (`pool.end()` — closes the deferred-work item), and the client uses relative URLs — no hardcoded `localhost:3000` left (closes the deferred-work item).
3. **And** two people on different networks complete a full match in browsers — create, share link, play, forfeit path, result, rematch — and it appears in the recent-matches list from Neon; a `[db]`-style failure never crashes the deployed server.
4. **And** a connected match that sits idle longer than Render's 15-minute sleep timer still works (else the D26 Koyeb fallback is taken), and the README documents the deploy setup.

## Tasks / Subtasks

- [ ] **Task 1: Design decisions + HUMAN-GATED setup (AC: all) ⚠️ record each in Completion Notes**
  - [ ] **1a — Danilo's inputs.**
    1. **Render account:** sign up free at render.com with GitHub. Confirm no credit card was asked for (if one is, STOP and tell the AI — the budget rule is zero cost).
    2. **Create the service** following the steps the AI gives (see 1b). Then copy the **deploy hook URL** (service → Settings → Deploy Hook) and give it to the AI ONLY via `! gh secret set RENDER_DEPLOY_HOOK_URL` typed in-session, so it never appears in chat.
    3. **Neon:** already done in the WIP commit (migrated; `NEON_DATABASE_URL` repo secret exists since 2026-07-17). Danilo pastes the same URL into the Render service's `DATABASE_URL` env var (dashboard, marked secret). Nothing else needed.
    4. **The real match (AC3):** Danilo plays one full match against a friend on another network, after the deploy works.
  - [x] **1b — Service shape.** Prefer a **Blueprint**: a `render.yaml` at the repo root that describes the service as code (reviewable in the PR). Planned fields: `type: web`, `runtime: docker`, `plan: free`, `dockerfilePath: ./Dockerfile`, `healthCheckPath: /api/health`, auto-deploy OFF (deploys come only from our workflow, after migrations), `envVars: DATABASE_URL` with `sync: false` (value set in the dashboard, never in git). Region: the one closest to the Neon project's region. ⚠️ Verify every field name against the live Render Blueprint docs at implementation time — do not trust this list blindly. If Blueprints turn out to be unavailable on the free plan, use the dashboard instead and record the exact settings in the README. Record the choice.
  - [x] **1c — Deploy workflow.** Rewrite `.github/workflows/deploy.yml`: trigger `push` to `main` (already gated by branch protection); steps: checkout → setup-node → root `npm ci` → migrate Neon (`npm run migrate -w @card-clash/server` with `DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}` — unchanged from the WIP) → `curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"`. Keep `permissions: contents: read` and `cancel-in-progress: false`. Remove the Cloudflare steps. Note: the hook only STARTS the deploy; the workflow does not wait for it. Post-merge verification (Task 7) covers the rest. Record.
  - [x] **1d — PORT.** Render tells the app which port to listen on through the `PORT` env var. Add `PORT` to `configSchema` in `config.ts` as an optional number with default `3000` (`z.coerce.number().int().positive().default(3000)`), and listen on it in `server.ts` (replaces the hardcoded `const port = 3000`). Locally nothing changes. Record.
  - [x] **1e — Same origin, no CORS.** In production the page and the server share one address, and in dev the Vite proxy makes it so too. So: remove the `cors` middleware in `app.ts`, remove the `cors` option from the Socket.IO server in `server.ts`, and remove the `cors` dependency. Both `CLIENT_ORIGIN` constants go away. Effect: other websites get no CORS permission at all (deny by default — stricter than before). Update the CORS test in `app.test.ts` to assert that a foreign `Origin` gets NO `Access-Control-Allow-Origin` header. Record.
  - [x] **1f — Serving the client.** In `app.ts`, after the API routes: `express.static(<client dist dir>)`. The dir is resolved from the server file's own location (like `ENV_PATH` in `config.ts`), so it works in dev, in `dist/`, and in the image. Only mount it when the dir exists — in dev, Vite serves the page, and the server must still start without a client build. Join links are `/?match=<id>` — the path is `/`, so `index.html` is served by `express.static` with no extra "SPA fallback" route. Unknown `/api/*` paths must still return the JSON 404, not HTML. Record the exact path logic.
  - [ ] **1g — Sleep check (AC4).** No separate spike: deploy for real, then test. Reason it should pass: Socket.IO's server sends a `ping` every 5s and the client answers with a `pong` — that `pong` is an incoming WebSocket message, which Render counts as activity. Test: open a match with two clients, leave them connected and silent for 20 minutes, then play a round. Also time one cold start (first request after sleep). **If the idle match dies → record evidence and switch to the Koyeb free instance (D26 fallback): same image, same env vars.** Do not sink time into workarounds on Render.
  - [x] **1h — Image platform and size.** Render builds the image itself from the Dockerfile on its own amd64 machines — no local build or registry push needed. The client build adds ~4 MB of card images; fine. Record.
  - [x] **1i — What goes away.** Delete `deploy/cloudflare/` (Worker glue from the WIP commit). Remove `CLOUDFLARE_API_TOKEN` usage (the repo secret was never created; check with `gh secret list`). Update the Dockerfile header comment (no Cloudflare, no Fly). Record.

- [x] **Task 2: Graceful shutdown (AC: 2)** — done and verified in WIP commit 6e11bf7 (`io.close()` + `closePool()` on SIGTERM/SIGINT, 5s unref'd force-exit timer, clean exit 0 under `docker stop`). Render also sends SIGTERM on redeploy and sleep, so this is still needed. Keep as is.

- [x] **Task 3: Server — PORT, no CORS, serve the client (AC: 1, 2)** — `packages/server`
  - [x] `config.ts`: `PORT` per 1d. Test in `config.test.ts`: default 3000, a valid value is parsed, a non-number is rejected.
  - [x] `server.ts`: listen on `loadConfig().PORT`; log the port. Remove the Socket.IO `cors` option (1e).
  - [x] `app.ts`: remove `cors` (1e); static serving per 1f.
  - [x] Tests (`app.test.ts`, supertest): foreign origin gets no CORS header; with a temp client dir containing an `index.html`, `GET /` and `GET /?match=abc` return it; `GET /api/does-not-exist` still returns JSON 404; `GET /api/health` still 200. Make the client dir injectable (e.g. a small `createApp({ clientDir })` or an exported helper) so the test does not depend on a real build — choose the smallest change and record it.
  - [x] `package.json`: drop `cors` and `@types/cors`; `npm install` to update the lockfile.

- [x] **Task 4: Client — relative URLs + Vite proxy (AC: 2)** — `packages/client`
  - [x] `socket.ts`: `io()` with no URL (connects to the page's own address).
  - [x] `HomeScreen.tsx`: `fetch('/api/matches', …)`. `RecentMatches.tsx`: `fetch('/api/matches/recent', …)`. After this, `grep -rn localhost packages/client/src` finds only tests (if any).
  - [x] `vite.config.ts`: `server.proxy` for `/api` → `http://localhost:3000`, and `/socket.io` → `http://localhost:3000` with `ws: true`.
  - [x] Update any test that asserts the old absolute URLs (`RecentMatches.test.tsx` mocks `fetch`).
  - [x] Live check: `npm run dev`, play one round in two browser tabs at `http://localhost:5173`.

- [x] **Task 5: The image contains the client (AC: 1)**
  - [x] `Dockerfile` build stage: also copy `packages/client` and run its build (needs the client's dev dependencies — the build stage already does a full `npm ci`). Runtime stage: copy `packages/client/dist` to the path the server expects (1f). Header comment updated (1i).
  - [x] `ci.yml` smoke step: additionally `curl -sf http://localhost:3000/ | grep -q '<div id="root">'` (the page is served). Keep `scripts/smoke.mjs`.
  - [x] Local check: `docker build` + `docker run -p 3000:3000 -e DATABASE_URL=<local>` → open `http://localhost:3000` in two tabs and play a round; this is exactly the production shape.

- [ ] **Task 6: Render + deploy workflow (AC: 1)**
  - [x] `render.yaml` per 1b (or dashboard settings recorded in the README).
  - [x] `deploy.yml` per 1c. Delete `deploy/cloudflare/` per 1i.
  - [ ] Danilo's 1a steps; `RENDER_DEPLOY_HOOK_URL` secret set.
  - [ ] First deploy by hand (dashboard "Manual Deploy" or one `curl` to the hook) BEFORE merging, so the merge isn't the first test of the service.

- [ ] **Task 7: Prove it (AC: 3, 4)**
  - [ ] `node scripts/smoke.mjs https://<name>.onrender.com` passes.
  - [ ] Scripted full match over the public URL → `curl https://<name>.onrender.com/api/matches/recent` shows the new row (Neon write proven end to end).
  - [ ] Forfeit over the real network: disconnect one client → the survivor gets the forfeit within ~10s (allow some margin); a row with `end_reason='forfeit'` appears.
  - [ ] Sleep check per 1g, with evidence (timestamps).
  - [ ] Danilo + a friend on another network: full match in browsers — create, share link, play, a forfeit, result, rematch — and it shows in the recent list (AC3).
  - [ ] DB-failure path: not re-tested in prod (proven in 3.1/3.2); check that the Render logs show no crash traces during the smoke runs.
  - [x] README: replace the "client deploys separately" text; add a **Deployment** section: the one-service shape, env vars, secrets, how a deploy happens, how to redeploy by hand, where the logs are (Render dashboard), the sleep behavior and the ~1 min wake-up. Update the Packages table (server and client are no longer "planned").
  - [x] `deferred-work.md`: mark resolved — graceful shutdown (3.1/3.2 item), hardcoded `localhost:3000` API base (3.2 item).
  - [ ] Commit on `story/4.2`, push, PR, `bmad-code-review`, merge per D23. POST-MERGE: watch the first `deploy.yml` run, then re-run the public smoke.

## Dev Notes

### Working agreement

- AI implements everything (D23), EXCEPT the 1a human steps (Render account and service, the hook secret, the friend match), which Danilo does. This spec is approved by Danilo before dev continues. [Source: .decision-log.md#D23; #D26]

### Scope guard — what is NOT in 4.2

- **No custom domain** — `onrender.com` is fine.
- **No keep-awake pinging.** Render says it is not a supported way to stop sleep, and it burns free hours. Sleep between play sessions is accepted (D26).
- **No scaling** — exactly one instance is a hard requirement (in-memory store), not a cost choice.
- **No reconnect work** — a sleep or redeploy still kills in-flight matches (D26 accepted; D16 reconnect is the later fix).
- **No new deck/theme work** — One Piece only (D26 direction).
- **No art changes** — the committed One Piece images ship as they are (D26).

### Architecture constraints that bind this story

- **Same origin in production and dev** — architecture.md, Infrastructure & Deployment, amended 2026-10-25 (D26). The client uses only relative URLs.
- **In-memory match store ⇒ exactly one instance.** The free plan runs one instance; do not add scaling settings.
- **Config via env only; fail-fast `loadConfig()` at startup** — a missing `DATABASE_URL` shows as a failing deploy, which is correct. No `.env` in the image (4.1 boundary).
- **Server restart kills in-flight matches — accepted** (D26, same as D25 and v1).

### Previous work intelligence

- WIP commit 6e11bf7 (2026-07-18): graceful shutdown done and verified; Neon migrated; `NEON_DATABASE_URL` repo secret exists; the Cloudflare glue and the Cloudflare half of `deploy.yml` are now dead code.
- `scripts/smoke.mjs [baseUrl]` (4.1) plays a real round over WebSocket — the verification tool at every stage: local container → Render URL.
- `pool.ts` is lazy and `closePool()` no-ops when the pool was never created (health-only traffic).
- The migrate script's `--envPath ../../.env` is silent when the file is missing and falls back to `process.env.DATABASE_URL` — verified in the first 4.2 spec; it works in CI as is.
- Neon: use the DIRECT (non-pooler) URL for migrations; the `-pooler` URL breaks node-pg-migrate. The WIP migration already ran against it successfully.
- Forfeit detection is ~10s (`pingInterval`/`pingTimeout` 5000/5000, story 2.6). Through Render's proxy the timing may stretch a little.
- The join link is `${window.location.origin}/?match=<id>` (`HomeScreen.tsx`) — it becomes the Render address automatically once the page is served from there.
- Render facts as of 2026-10 (verify at implementation): free web services spin down after 15 min with no incoming HTTP request or incoming WebSocket message; wake-up takes ~1 min; 512 MB RAM; 750 free instance hours per workspace per month (a month is ~730 h, so one service fits even if it never sleeps).

### Project Structure Notes

- New: `render.yaml` (if Blueprint).
- Update: `packages/server/src/{config.ts, server.ts, app.ts}` + tests · `packages/server/package.json` (drop `cors`) · `packages/client/src/{socket.ts, components/HomeScreen.tsx, components/RecentMatches.tsx}` + tests · `packages/client/vite.config.ts` · `Dockerfile` · `.github/workflows/{ci.yml, deploy.yml}` · `README.md` · `deferred-work.md`.
- Delete: `deploy/cloudflare/`.

### References

- [Source: epics.md#Story-4.2] — story statement + ACs (re-scoped 2026-10-25)
- [Source: .decision-log.md#D26] — free hosting, same origin, sleep semantics, Koyeb fallback, direction, card art
- [Source: architecture.md — Infrastructure & Deployment (amended 2026-10-25)]
- [Source: implementation-artifacts/4-1-…-ci-gate.md] — image shape, smoke script
- [Source: implementation-artifacts/deferred-work.md — 3-1 and 3-2 sections] — the items this story closes
- Render changelog: https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages

## Dev Agent Record

### Agent Model Used

claude-fable-5 (first spec + WIP), claude-opus-5-5 (re-scope 2026-10-25)

### Debug Log References

### Completion Notes List

Decisions (fill at implementation):

- 1a — Render account created 2026-10-25 by Danilo via GitHub sign-up; **no credit card asked** (free plan confirmed). Service creation, hook secret and friend match: pending.
- 1b — Blueprint: `render.yaml` at repo root — `type: web`, `runtime: docker`, `plan: free`, `region: frankfurt`, `dockerfilePath: ./Dockerfile`, `healthCheckPath: /api/health`, `autoDeployTrigger: 'off'`, `envVars: DATABASE_URL (sync: false)`. Field names verified against render.com/docs/blueprint-spec on 2026-10-25 (`autoDeploy: false` is the deprecated form). No `branch` field: the branch is picked when the Blueprint is created (story/4.2 for the pre-merge test, then main).
- 1c — `deploy.yml`: checkout → setup-node → `npm ci` → migrate Neon (unchanged) → `curl -fsS -X POST "$RENDER_DEPLOY_HOOK_URL"`. `contents: read`, `cancel-in-progress: false`. Cloudflare steps removed.
- 1d — `PORT: z.coerce.number().int().min(1).max(65535).default(3000)` in `configSchema`; `server.ts` listens on `loadConfig().PORT` and logs `server listening on port N`. 4 new config tests (default, parse, non-number, out of range).
- 1e — `cors` middleware, Socket.IO `cors` option, both `CLIENT_ORIGIN` constants, and the `cors` + `@types/cors` deps removed. Test now asserts a foreign Origin gets NO `Access-Control-Allow-Origin`. Verified live: `curl -H "Origin: https://evil.example"` → no CORS header.
- 1f — `createApp(clientDir = CLIENT_DIST)` in `app.ts`; `CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url))` (same from src/, dist/ and /app in the image). `express.static` mounted after the API routes, only if the dir exists. `export const app = createApp()` keeps every existing import working; tests inject a temp dir. Spec correction: unknown `/api/*` paths were never JSON 404s (Express's default 404 is HTML text); the real requirement — they must not get `index.html` — is what the test asserts.
- 1g — pending (needs the live service).
- 1h — Render builds the image itself. Local image 379 MB (node:24-slim base + server deps + ~4 MB client). Verified locally with `-e PORT=10000`: page, `/?match=abc`, card art and JS bundle served; no `localhost:3000` in the bundle; `scripts/smoke.mjs` PASS ×3; `/api/nope` → 404; a `[db]` ECONNREFUSED (no DB in the test) was logged and the server kept running; `docker stop` → `[shutdown] clean exit`, exit 0.
- 1i — `deploy/cloudflare/` deleted. `CLOUDFLARE_API_TOKEN` was never created (`gh secret list` shows only `NEON_DATABASE_URL`). Dockerfile header rewritten.
- Dev-loop note: on Danilo's machine port 3000 was held by another project's dev server (QueenZ, Next.js), so `npm run dev` failed with EADDRINUSE. The proxy was verified instead with the server on `PORT=3100` and a throwaway Vite instance proxying to it: `scripts/smoke.mjs http://localhost:5199` PASS ×3 (REST + WebSocket through the proxy). Stop the other app before `npm run dev`.

### File List

- `packages/server/src/config.ts` (modified)
- `packages/server/src/config.test.ts` (modified)
- `packages/server/src/app.ts` (modified)
- `packages/server/src/app.test.ts` (modified)
- `packages/server/src/server.ts` (modified)
- `packages/server/src/db/pool.ts` (modified — WIP commit 6e11bf7)
- `packages/server/package.json` (modified)
- `package-lock.json` (modified)
- `packages/client/src/socket.ts` (modified)
- `packages/client/src/components/HomeScreen.tsx` (modified)
- `packages/client/src/components/RecentMatches.tsx` (modified)
- `packages/client/src/components/RecentMatches.test.tsx` (modified)
- `packages/client/vite.config.ts` (modified)
- `Dockerfile` (modified)
- `render.yaml` (created)
- `.github/workflows/ci.yml` (modified)
- `.github/workflows/deploy.yml` (created in WIP, rewritten)
- `deploy/cloudflare/` (created in WIP, deleted)
- `.env.example` (modified)
- `README.md` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)
- `AGENTS.md`, `CLAUDE.md`, `.agents/skills/{create-plan,load-project-context,record-change}/SKILL.md` (created — agent instructions adapted from QueenZ; added to this PR at Danilo's request)
