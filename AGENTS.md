# 🏴‍☠️ card-clash — Agent Instructions

Conventions and context for any AI coding agent working in this repo. Written to
the vendor-neutral `AGENTS.md` convention, so it is not tied to one assistant —
`CLAUDE.md` is a one-line pointer at this file, and other tools can do the same.

card-clash is One Piece Top Trumps for two players over a shared link: a pure
TypeScript rules engine, an Express 5 + Socket.IO server, and a React 19
client, with finished matches stored in PostgreSQL. It is a practice project,
not a commercial product.

The binding design contract is
[`_bmad-output/planning-artifacts/architecture.md`](./_bmad-output/planning-artifacts/architecture.md).
If a rule here and that document disagree, the document wins — and the
disagreement gets flagged.

---

## Role Definition

Act as an expert software engineer specialising in **TypeScript (6) on
Node.js (24)**, **real-time web apps** and **PostgreSQL**. Working knowledge
expected in:

- Functional-core design: pure, deterministic state transitions with injected
  randomness
- Socket.IO and Express 5 on one shared `http.Server`
- React 19 with built-ins only (`useReducer` + context, no state library)
- Server-authoritative multiplayer with hidden information
- Docker, GitHub Actions, and the deploy stack in decision D26 (Render + Neon)

---

## Collaboration Guidelines

Work runs through BMAD stories (decision D23). The user requests features and
approves; the agent plans and implements.

1. **The approval gate is the plan.** A story spec (or, for small work, a plan
   proposed in chat) is approved before any code is written. No file or tool
   changes before that approval.
2. **Inside an approved spec, implement without stopping** for each step. Choices
   the spec delegates ("choose the smallest change and record it") are made and
   recorded in the story's Completion Notes.
3. **Git is delegated:** commit, push, open PRs and merge without asking each
   time. Never merge without the adversarial code review.
4. **Human-gated steps** (accounts, billing, secrets, logins) stop the work.
   Give exact click-by-click steps, then wait. Secrets go in with
   `! gh secret set …` typed by the user — never through the chat.

### Decisions belong to the user

Any choice with a real alternative that the approved spec does not cover is a
decision. Present it, do not make it: new dependencies, new packages, schema
changes, scope, cost (the budget is **zero** — every service must be free), and
anything touching uncommitted work you did not write.

- Give the options, the trade-off in one line each, and a recommendation. Then wait.
- A decision discovered mid-implementation stops the implementation. Ask, then continue.
- Work outside the approved spec — even an obvious fix nearby — is listed as a
  suggestion, not done. Small debts go in `deferred-work.md`.

---

## Git and pull requests

These rules apply to every contributor, human or AI.

- **Authorship.** Commits are authored only by the human who made them. No
  `Co-Authored-By` trailer and no tool attribution ("Generated with …") in
  commit messages or PR descriptions.
- **Branches.** Never commit or push to the default branch (`main`). Work on a
  feature branch and open a PR.
- **Commit messages.** A short imperative subject (under ~72 characters) saying
  what changed. Then a body saying why, when it isn't obvious.
- **PR descriptions** are short, plain and complete, in these sections:
  1. **What and why** — the problem and the change, in two or three sentences.
  2. **Changes** — grouped by area, one line each.
  3. **Decisions and trade-offs** — what a reviewer might question, and what
     was left out on purpose.
  4. **Testing** — what was run and the result. Say plainly what was not tested.
  5. **Follow-ups** — known gaps, if any.

Claude Code enforces the attribution rule through `.claude/settings.json`.
`.github/pull_request_template.md` gives hand-opened PRs the same shape.

---

## Must-Do Practices

- **Be brutally honest.** When asked for an opinion, do not sugar-coat or try to
  please.
- **Be concise.** I have ADHD and will not read long verbose prose. Short, direct,
  without dropping anything important.
- **Simple English.** English is my second language. Short sentences, one idea
  each, common words. Define a technical term the first time you use it. This
  applies to chat AND to every document (story specs, README, comments).
- **No plan mode.** Never use a plan-mode tool (`enter_plan_mode`,
  `ExitPlanMode`, or whatever the current assistant calls it), even when asked to
  plan, research or design. Propose in the normal chat flow instead.
- **Read before modifying.** Read a file's current contents before changing it.
- **Timestamps.** Postgres sets `created_at` (`DEFAULT now()`); dates travel as
  ISO 8601 strings in JSON.
- **Rule violations are values, not throws.** The engine returns
  `{ ok: false, error }` with a stable code. `throw` is only for programmer
  error (an impossible state).
- **Errors on the wire** use one shape: `{ error: { code, message } }`, with
  stable SCREAMING_SNAKE codes (`MATCH_FULL`, `INVALID_BODY`, …). A socket error
  goes to the sender only, and state does not change.
- **Avoid nesting.** Linear flows only — see _Linear Flow_ below.
- **Testing.** Vitest everywhere; `supertest` for REST; React Testing Library
  (jsdom) for components; seeded `Rng` for anything random.
- **Comments.** Explain the _why_ behind non-obvious logic, not the what. Cite
  the story or decision (`story 4.2, D26`) when a line exists because of one.
- **Formatting.** Prettier and ESLint. CI runs `npx prettier --check .` over the
  whole repo, including Markdown.

---

## Architecture & Conventions

1. **The engine is pure.** `packages/engine` imports only `zod`. No socket.io,
   pg, React or Node APIs. Randomness only through the injected `Rng`.
2. **Projection is the only door.** `projectFor(state, playerId)` is the single
   path from `MatchState` to anything a client receives (NFR2). A handler that
   builds a payload from raw state is the one unforgivable sin.
3. **Validate at the boundary.** zod-parse every external payload (REST body,
   socket event) before it reaches the engine. zod checks shape; the engine
   checks game rules.
4. **No ORM.** Raw `pg` with parameterised, hand-written SQL. SQL lives only in
   `db/matchRepository.ts`; only `db/pool.ts` imports `pg`.
5. **One vocabulary.** `match` (not game/room/session), `stat`, `stack`, `pot`,
   `superTrump`, `chooser`. Mirrors the PRD.
6. **No magic numbers.** Named constants for timeouts, limits and sizes.
7. **Shared types live in the engine.** Wire types, socket event maps and zod
   command schemas live in `engine/src/protocol/`. Server and client both
   import them — no retyping a payload by hand.

---

## Design Principles

Separation of concerns and the single responsibility principle are the default,
not a refinement.

**Single responsibility.** Every module, type and function has one reason to
change. If describing it needs "and", split it.

**Where code lives:**

| Place                               | Owns                                                                  | Never contains                       |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| `engine/src/deck`                   | The `Deck` interface and deck data (`onePieceDeck`)                   | Rules, I/O                           |
| `engine/src/match`                  | Setup and `applyCommand(state, command)` — every rule                 | I/O, transport or DB types           |
| `engine/src/projection`             | `projectFor` — what each player may see                               | Rules, serialisation shortcuts       |
| `engine/src/protocol`               | Event maps, zod command schemas, shared wire types                    | Logic                                |
| `server/src/routes`                 | REST ↔ engine/store translation (zod-parse, status codes)             | Game rules, SQL                      |
| `server/src/sockets`                | Socket events ↔ engine (parse → `applyCommand` → `projectFor` → emit) | Game rules, SQL, hand-built payloads |
| `server/src/store`                  | Live matches in memory                                                | SQL, rules                           |
| `server/src/db`                     | Finished matches in Postgres; snake_case ↔ camelCase mapping          | Rules, transport                     |
| `server/src/{config,app,server}.ts` | Env parsing, Express wiring, startup and shutdown                     | Business logic                       |
| `client/src/state`                  | One reducer: connection + screen + `PlayerView`                       | Rule simulation                      |
| `client/src/components`             | Rendering what the server sent                                        | Game rules                           |

**Packaging.**

- Name modules for what they provide. No `utils`, `common`, `helpers`.
- A module must earn its existence: a new one needs a real consumer.
- Pure helpers at every boundary (`resolveDisconnect`, `toMatchRecord`), so
  logic is unit-testable without sockets or a database.

**Every proposal states placement.** For each new type or function: where it
goes and why it belongs there, using the table above.

**Existing violations** are flagged when found, never silently copied or
silently fixed. Known ones (details in `deferred-work.md`):

- The `RecentMatch` wire type is declared in the server's `db/` layer and
  mirrored by hand in the client. It belongs in `engine/src/protocol/`.
- A type-only circular import between `engine/src/types.ts` and
  `engine/src/deck/deck.ts`.
- `StatKey` is a fixed union of One Piece stats, and the server hardcodes
  `onePieceDeck`. Fine for now; multi-deck support will have to remove both.
- architecture.md's directory tree is the 2026-06-10 plan. Real files differ
  (`server.ts` not `index.ts`; ties and match end live in
  `match/applyCommand.ts` + `match/round.ts`; client socket is `src/socket.ts`).
  Trust the code for locations, the document for rules.

---

## Linear Flow

Never inline a search, filter or matching loop inside a high-level handler.
Extract it into a named single-purpose helper and evaluate the result with a
guard clause in the caller.

Check negative conditions first and return early, so the happy path stays at
the root indentation level. Avoid `if/else` ladders. For multi-stage collection
work, use a pipeline — `filter`, then `map`, then `sort` — rather than tracking
state inside nested loops.

### ❌ Loop inlined in the handler

```ts
socket.on('disconnect', () => {
  for (const entry of matches.values()) {
    for (const p of entry.players) {
      if (p.socketId === socket.id) {
        // resolve forfeit...
      }
    }
  }
});
```

### ✅ Extracted helper plus guard clause

```ts
socket.on('disconnect', () => {
  const entry = findMatchBySocketId(socket.id);
  if (!entry) return;
  // resolve forfeit...
});

export function findMatchBySocketId(socketId: string): MatchEntry | undefined {
  for (const entry of matches.values()) {
    if (entry.players.some((p) => p.socketId === socketId)) return entry;
  }
  return undefined;
}
```

---

## Core Design Pillars

1. **Functional core.** `applyCommand(state, command): CommandResult` — a pure
   transition over plain immutable values. No mutable classes. Same seed, same
   game.
2. **Full-snapshot protocol.** After every accepted command, each player gets
   their complete `PlayerView` via `match:state`. No deltas and no client-side
   rule simulation: the client renders what it is told, so sync bugs cannot
   happen.
3. **Server-authoritative, in memory, one instance.** Live matches live in a
   `Map` on the server. A restart, redeploy or Render sleep ends every match in
   progress — accepted until reconnect (D16). So there must always be exactly
   ONE server instance.
4. **Persistence never blocks play.** A finished match is written to Postgres;
   a DB failure is logged with a `[db]` prefix and the `matchId`, and the game
   carries on.
5. **Same origin (D26).** In production the server also serves the built
   client; in dev Vite proxies `/api` and `/socket.io`. The client uses only
   relative URLs, and there is no CORS config.

---

## Real-Time Requirements

- **Disconnect detection ≈10s** (`pingInterval` 5000 + `pingTimeout` 5000,
  story 2.6). A blip shorter than that is ignored; longer is a forfeit.
- Socket events are `domain:action` camelCase: commands `match:join`,
  `match:selectStat`, `match:rematch`; events `match:state`, `match:ended`,
  `match:error`.
- REST is only for the non-real-time edges: `POST /api/matches`,
  `GET /api/matches/recent`, `GET /api/health`. No gameplay over REST, ever.

---

## Adding a Feature

Bottom-up, with tests paired to each layer — never one test phase at the end:

1. **Protocol and types** — `engine/src/types.ts`, `engine/src/protocol/`.
2. **Engine rules** — `engine/src/match/` through `applyCommand`; seeded tests,
   card-count invariants.
3. **Projection** — expose new state in `projectFor`, with a test that hidden
   information is absent (including in the serialised JSON).
4. **Database** (if needed) — a SQL migration in `server/src/db/migrations/`,
   queries in `matchRepository.ts`.
5. **Server transport** — store, then socket handler or route.
6. **Client** — reducer action, then socket wiring, then component.
7. **Docs** — architecture.md first if a pattern changes; README;
   `deferred-work.md`.

---

## Testing Strategy

**Unit** — engine rules with a seeded `Rng`, projection (hidden-info
assertions), pure server helpers, the client reducer. Co-located:
`deck.test.ts` beside `deck.ts`.

**HTTP** — `supertest` against the Express `app` (or `createApp(...)` with
injected options): success and every error status.

**Components** — React Testing Library in jsdom; stub `fetch` with
`vi.stubGlobal`.

**Live** — `node scripts/smoke.mjs <baseUrl>` creates a match, joins two
socket clients and plays a round, against any running server: dev, a local
container, or the deployed URL. CI runs it against the built Docker image.

The story pipeline (Epic 3 retro): approved spec → fresh-context spec
validation → TDD → live smoke → 3-layer adversarial review → merge. Each stage
catches something the others cannot.

---

## Code Quality Standards

- **Parameterised queries.** All SQL, without exception.
- **Errors keep their detail.** Pass the original error object to the log
  call (`console.error('[db] …', err)`); never replace it with a bare message.
- **Logging.** `console` with a short prefix (`[db]`, `[shutdown]`) and the
  `matchId` where there is one. No logging library until there is a need.
  Never log secrets (`DATABASE_URL`, deploy hooks, tokens).
- **JSON fields** are camelCase; the repository maps snake_case columns, and SQL
  never leaks past it.
- **Config** is env-only, zod-validated in `server/src/config.ts`, failing fast
  at startup. A new variable also updates `.env.example`, the README, and the
  Render service.

---

## Sources & Rights

- **Players are nicknames only** (NFR5). No accounts, no emails, no personal
  data in the database or the logs.
- **One Piece is licensed IP** (decision log Q5, D26). The 32 committed card
  images in `packages/client/public/images/cards/` are kept on purpose for
  private fan play with friends, and are removed on any takedown request. Do
  not add more licensed art.
- **AI-generated art of a licensed character is still the licensed
  character.** It is not a way around copyright.
- **Future themes and decks use original, non-copyrighted art** (D26). Deck
  data (names, numbers) is fine to store.
- **The repo is public.** Never commit secrets; `.env` stays gitignored.

---

## Commands

Requires Node ≥24 (`.nvmrc`; `npm install` fails below it by design).

```bash
npm run dev        # server (:3000) + client (:5173, proxies /api and /socket.io)
npm test           # vitest across all packages
npm run typecheck  # root tsc, then each workspace
npm run lint       # eslint
npx prettier --check .                # CI checks formatting of everything
npm run build                          # engine → server → client
npm run migrate -w @card-clash/server  # apply DB migrations (uses root .env)
node scripts/smoke.mjs [baseUrl]       # live create/join/round check
docker build -t card-clash .           # the whole game in one image
```

CI runs: prettier check, lint, typecheck, tests, build, Docker build, and the
smoke test against the container. Deploys run on merge to `main`
(`.github/workflows/deploy.yml`): migrate Neon, then trigger Render.

---

## Planning Artifacts

| File                                                                    | Holds                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------ |
| `_bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md` | 31 FRs, 6 NFRs, the rules, the deck (Appendix A) |
| `…/prd-card-clash-2026-06-10/.decision-log.md`                          | Numbered decisions (`D1`…) — cite them by number |
| `_bmad-output/planning-artifacts/architecture.md`                       | The binding design contract                      |
| `_bmad-output/planning-artifacts/epics.md`                              | Epics, stories, acceptance criteria              |
| `_bmad-output/implementation-artifacts/sprint-status.yaml`              | Status of every story                            |
| `_bmad-output/implementation-artifacts/<story>.md`                      | One story: tasks, decisions, Dev Agent Record    |
| `_bmad-output/implementation-artifacts/deferred-work.md`                | Known gaps and debt, and which story claims each |

---

## Development Phases

- **Epic 1** — The rules engine _(complete)_
- **Epic 2** — Play it: create, share link, play, forfeit, result, rematch _(complete)_
- **Epic 3** — Match history in PostgreSQL _(complete — v1 done 2026-07-17)_
- **Epic 4** — Ship it: CI _(complete)_; the whole game on one free Render
  service + Neon _(story 4.2, in progress)_

**Next, in this order (D24, D26):** play it with friends → multi-deck and
theme support on the same engine (League of Legends, football, …, original art)
and multi-player 2–5 (D24) → reconnect with a grace period (D16). Each starts
with a planning artifact the user approves.

### What is missing today

Treat these as unfinished when reasoning about behaviour:

- **No reconnect.** A page refresh or a drop longer than ~10s is a forfeit.
- **Two players only.** D24 (2–5) is planned, not built.
- **One deck.** Stats, card count and the Super Trump / counter rules are still
  One Piece-shaped.
- **No abandoned-match cleanup.** Matches never joined or never finished stay
  in memory until a restart.
- **Free-tier sleep.** After 15 idle minutes the server sleeps; the first
  visitor waits about a minute.
