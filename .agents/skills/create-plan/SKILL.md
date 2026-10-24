---
name: create-plan
description: >-
  Creates structured, trackable engineering plans for card-clash following its package
  boundaries (pure engine, server, client), bottom-up layer-by-layer execution with tests paired
  to each layer (never a monolithic test phase at the end), and a mandatory documentation impact
  evaluation. Use whenever asked to plan, scope, or design a feature or refactoring task.
---

# Create Plan Skill

Standardises how feature and refactoring work is planned in card-clash.

## Where the plan goes

Default: **propose the plan in the chat and wait for approval.** Danilo
approves every plan before code is written (decision D23). Do not create files
while proposing.

Write the plan to `FEATURE.md` at the repository root only when the user asks for
a written or trackable plan, or when the work spans several sessions and progress
needs to survive between them. Use the checkbox template below in that case.

Write plans in plain, simple English: short sentences, one idea per sentence,
define each new term on first use.

---

## Core Principles

1. **Start with the why and the what.** Define the problem and the target
   technical specification before breaking anything into tasks.
2. **Respect the package boundaries.** Every new type or function states which
   package and folder it lives in, and why:
   - `packages/engine` — pure rules, imports only `zod`. No socket.io, pg,
     React or Node APIs. Shared wire types and zod command schemas live in
     `engine/src/protocol/`; both server and client import them.
   - `packages/server` — all I/O. Organised by layer: `routes/`, `sockets/`,
     `store/` (live matches in memory), `db/` (finished matches in Postgres).
   - `packages/client` — imports engine **types only**. One reducer in
     `state/`, screens and views in `components/`.
     If a plan needs to break a rule in `_bmad-output/planning-artifacts/architecture.md`,
     the first task is amending that document.
3. **Bottom-up, with tests paired to each layer.** Build in dependency order and
   **verify each layer before starting the next**. Never defer testing to a final
   phase:

   | Layer                                             | Paired verification                                                  |
   | ------------------------------------------------- | -------------------------------------------------------------------- |
   | Protocol (`engine/src/protocol/`)                 | zod schema tests; `*.test-d.ts` type tests for event maps            |
   | Engine rules (`engine/src/match/`, `deck/`)       | Vitest with a seeded `Rng`; card-count invariants                    |
   | Projection (`engine/src/projection/`)             | Assert hidden info is absent, including in serialised JSON           |
   | Server store and pure helpers                     | Unit tests (extract pure helpers like `resolveDisconnect`)           |
   | Database (`db/migrations/`, `matchRepository.ts`) | Mapper unit tests; migrate a local Postgres                          |
   | REST routes (`routes/`)                           | `supertest` against `app`, including error statuses                  |
   | Socket handlers (`sockets/`)                      | Pure-helper unit tests; `scripts/smoke.mjs` against a running server |
   | Client reducer (`state/`)                         | Reducer unit tests                                                   |
   | Client components                                 | Vitest + React Testing Library (jsdom)                               |
   | Build and deploy                                  | `npm run build`, `docker build`, `scripts/smoke.mjs <url>`           |

4. **Hidden information.** Anything a client sees goes through
   `projectFor(state, playerId)`. A plan that adds state fields says whether
   each field is visible, and to whom, and adds a projection test for it.
5. **Engine contract.** State changes go through
   `applyCommand(state, command)`, which returns a result instead of throwing
   for rule violations. New randomness comes from the injected `Rng`. Avoid
   2-player literals — multi-player (2–5, decision D24) is coming.
6. **Socket flow.** zod-parse → `applyCommand` → `projectFor` for each player →
   emit `match:state`. Bad input gets a typed error to the sender only, and
   state does not change. Disconnect detection stays at ~10s.
7. **Database failures never block play.** Log with the `matchId` and carry on.
   SQL only in `matchRepository.ts`; `pg` only in `pool.ts`.
8. **Documentation impact is mandatory.** Evaluate every doc below. If one is
   unaffected, say why. If affected, put an explicit update task in the plan.
   Keep doc updates concise — tables and tight bullets, no narrative filler.
9. **Trackable progress.** Every task gets a `[ ]` checkbox.
10. **Environment variables.** New or changed variables are parsed by zod in
    `packages/server/src/config.ts` (fail fast at startup). They need a task to
    update `.env.example`, the README, and — for production — the deploy
    secrets (`.github/workflows/deploy.yml`, `deploy/cloudflare/`).
11. **Skills stay decoupled.** Never reference another skill or its artifacts.
12. **Linear flow.** Guard clauses and the pipeline pattern. Extract collection
    searches into named helpers instead of nesting loops inside orchestration.

---

## Procedure

### 1. Understand the current state

- Read the relevant engine modules, server handlers and client components.
- Check `_bmad-output/implementation-artifacts/deferred-work.md`. It lists known
  gaps and which story claimed each one. Do not plan on top of a gap without
  noticing it.
- Check `sprint-status.yaml` in the same folder for work already in flight.
- Clarify ambiguities with the user before finalising.

### 2. Evaluate documentation impact

| Document                                                                          | Covers                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `README.md`                                                                       | Stack, commands, local database, build, CI, deployment |
| `_bmad-output/planning-artifacts/architecture.md`                                 | Binding decisions, patterns, boundaries, data flow     |
| `_bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md`           | FRs, NFRs, game rules, the deck (Appendix A)           |
| `_bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/.decision-log.md` | Numbered product decisions (`D1`…)                     |
| `_bmad-output/planning-artifacts/epics.md`                                        | Epics, stories and acceptance criteria                 |
| `_bmad-output/implementation-artifacts/deferred-work.md`                          | Known gaps and debt; mark items resolved               |
| `.env.example`                                                                    | Local configuration                                    |

### 3. Draft the plan

```markdown
# Feature Plan: <Title>

## 1. Business Need (The Why)

- **Background:** Current state.
- **The Problem:** Pain points or architectural mismatch.
- **The Goal:** Intended outcome.

## 2. Technical Specification (The What)

- **Contracts:** REST endpoints, socket events (`domain:action`), and payloads.
- **Engine Types:** New or changed types, commands and error codes.
- **Visibility:** For each new state field — who may see it, via `projectFor`.
- **Data Model Changes:** Migrations, tables, columns, indexes.
- **Deployment:** New env vars or secrets; effect on the single server instance.

## 3. Documentation Impact

- [ ] `README.md`: <Update needed / No change — rationale>
- [ ] `architecture.md`: <Update needed / No change — rationale>
- [ ] `prd.md`: <Update needed / No change — rationale>
- [ ] `.decision-log.md`: <Update needed / No change — rationale>
- [ ] `epics.md`: <Update needed / No change — rationale>
- [ ] `deferred-work.md`: <Update needed / No change — rationale>
- [ ] `.env.example`: <Update needed / No change — rationale>

## 4. Implementation (Bottom-Up, Tests Paired to Each Layer)

### Phase 1: Protocol and types (if applicable)

- [ ] **1.1** Types in `engine/src/types.ts`; command schemas and event maps
      in `engine/src/protocol/`.
- [ ] **1.2 (Tests)** Schema tests; type tests for the event maps.

### Phase 2: Engine rules

- [ ] **2.1** Rules in `engine/src/match/` (or `deck/`), through `applyCommand`.
- [ ] **2.2 (Tests)** Seeded-`Rng` tests, including card-count invariants.

### Phase 3: Projection

- [ ] **3.1** Expose new fields in `engine/src/projection/projectFor.ts`.
- [ ] **3.2 (Tests)** Hidden-info assertions, including serialised JSON.

### Phase 4: Database (if applicable)

- [ ] **4.1** SQL migration in `server/src/db/migrations/`; queries in
      `matchRepository.ts`; snake_case ↔ camelCase mapping there.
- [ ] **4.2 (Tests)** Mapper unit tests; migrate a local Postgres.

### Phase 5: Server transport

- [ ] **5.1** Store changes in `server/src/store/`; handlers in `sockets/`
      or `routes/`.
- [ ] **5.2 (Tests)** `supertest` for routes; pure-helper tests for sockets.

### Phase 6: Client (if applicable)

- [ ] **6.1** Reducer actions in `client/src/state/reducer.ts`, then socket
      wiring, then components.
- [ ] **6.2 (Tests)** Reducer tests; React Testing Library at each step.

### Phase 7: Wiring and Regression

- [ ] **7.1** Update `config.ts`, `.env.example` and deploy secrets if
      variables changed.
- [ ] **7.2** Run `npx prettier --check .`, `npm run lint`,
      `npm run typecheck`, `npm test`, `npm run build` — the same gates as CI.
- [ ] **7.3** Live check: `npm run dev` and play a round, or
      `node scripts/smoke.mjs <url>`.

### Phase 8: Documentation

- [ ] **8.1** Apply the updates identified in section 3.
```
