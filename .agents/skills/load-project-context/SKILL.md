---
name: load-project-context
description: >-
  Loads the architectural, domain and operational context of the card-clash project by reading
  its planning artifacts and docs. Use when starting a new session, onboarding, or when asked to
  orient yourself, load context, or understand card-clash's architecture, rules and conventions.
---

# Load Project Context (card-clash)

card-clash is One Piece Top Trumps for two players over a shared link. It is a
TypeScript npm-workspaces monorepo: a pure rules engine, an Express 5 +
Socket.IO server, and a React 19 + Vite client, with finished matches stored in
PostgreSQL. This skill orients an agent by reading the project's own documents
rather than guessing from code.

Read in order. Stop early only if the task is clearly scoped to one package.

---

## 1. The system and how it is built

- [README.md](../../../README.md) — stack, commands, local database, build and
  CI, package roles.

- [AGENTS.md](../../../AGENTS.md) — role, collaboration rules (the approval
  gate, decisions that belong to the user), must-do practices, where code
  lives, known violations, testing, commands. `CLAUDE.md` just points at it.

Planning artifacts live in `_bmad-output/` and are the source of truth.

## 2. The binding contract

- [architecture.md](../../../_bmad-output/planning-artifacts/architecture.md) —
  decisions with reasons, naming and structure patterns, boundaries, data flow.

The document says it is binding: if a pattern turns out wrong, **amend the
document first, then the code**. Read _Implementation Patterns & Consistency
Rules_ and _Architectural Boundaries_ in full.

Non-negotiables from it:

- `packages/engine` imports only `zod`. No socket.io, pg, React or Node APIs.
- `projectFor(state, playerId)` is the **only** path from `MatchState` to
  anything sent to a client (NFR2). Hand-building a payload from raw state is
  the one unforgivable sin.
- zod-parse every external payload at the boundary (route or socket handler)
  before calling the engine. zod checks shape; the engine checks game rules.
- The engine never throws for rule violations. `applyCommand(state, command)`
  returns `{ ok: true, state, effects } | { ok: false, error }`. Throws are for
  programmer error only. Randomness enters only through an injected `Rng`.
- Full-snapshot protocol: after every accepted command, each player gets their
  complete `PlayerView` via `match:state`. No deltas.
- SQL lives only in `db/matchRepository.ts`; only `db/pool.ts` imports `pg`.
  A DB failure is logged and never crashes the server or blocks gameplay.
- Errors share one shape: `{ error: { code, message } }` with stable codes.
- One vocabulary: `match` (not game/room), `stat`, `stack`, `pot`,
  `superTrump`, `chooser`. Tests sit beside the code (`x.test.ts`).

**The directory tree in architecture.md is the 2026-06-10 plan.** The real
layout drifted a little (e.g. the server entry is `server.ts`, not `index.ts`;
ties and match end live in `match/applyCommand.ts` and `match/round.ts`; the
client socket is `src/socket.ts`). Trust the code for file locations; trust the
document for rules.

## 3. Product scope and decisions

- [prd.md](../../../_bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/prd.md)
  — 31 FRs and 6 NFRs. Appendix A is the 32-card deck.
- [.decision-log.md](../../../_bmad-output/planning-artifacts/prds/prd-card-clash-2026-06-10/.decision-log.md)
  — numbered decisions (`D1`…). Cite them by number. The ones that shape
  current work:

| Decision | Says                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------- |
| D16      | Reconnect with a grace period is the planned follow-up (not built)                              |
| D23      | AI plans and implements via BMAD; Danilo requests features and approves specs. Git is delegated |
| D24      | Multi-player: 2–5 players per match, after deploy. Keep a 5→8 bump cheap                        |
| D25      | Deploy stack: GitHub Actions, Cloudflare Containers (Fly.io fallback), Neon, Cloudflare Pages   |

## 4. Where the work stands

- [epics.md](../../../_bmad-output/planning-artifacts/epics.md) — epics and
  stories with acceptance criteria.
- [sprint-status.yaml](../../../_bmad-output/implementation-artifacts/sprint-status.yaml)
  — status of every story. Find the one marked `in-progress`.
- The story file for that story in `_bmad-output/implementation-artifacts/`
  — tasks, decisions, and the Dev Agent Record.
- The latest `epic-*-retro-*.md` — lessons and the agreed pipeline.

## 5. Known gaps — the honest state

- [deferred-work.md](../../../_bmad-output/implementation-artifacts/deferred-work.md)
  — the running debt ledger. Struck-through items are resolved.

Code alone will not tell you these. Check them against the task:

- **Live matches live in server memory.** A restart, redeploy or container
  sleep kills every match in flight. So the server must run as exactly **one**
  instance.
- **No reconnect.** A page refresh or a network drop over ~10s is a forfeit.
- **Two players only** today. D24 (2–5 players) is planned, not built.
- **One deck** (`onePieceDeck`) behind the `Deck` interface. More sets are planned.
- The client calls a hardcoded `http://localhost:3000`, and server CORS allows
  only `http://localhost:5173`. Story 4.3 fixes both.
- No abandoned-match cleanup: matches that are never joined or never finished
  stay in memory.

## 6. Verify reality against the docs

Documents drift. Confirm before relying on them:

```bash
node -v                       # expect v24+ (.nvmrc; install fails below 24)
git branch --show-current && git status --short
npm run typecheck
npm test
```

Postgres is only needed for the server's DB paths and migrations (see README).

---

## Output Format

Report back concisely, in plain short sentences:

1. **State** — Node version, branch, uncommitted changes, test result.
2. **Packages** — engine / server / client, and what each owns.
3. **Live invariants** — the rules above that will constrain the task at hand.
4. **Relevant gaps** — any known gap or deferred item that touches the task.
5. **Ready** — ask for the task.
