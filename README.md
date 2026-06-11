# card-clash

One Piece Top Trumps for two players over a shared link — built as TypeScript interview practice. All code hand-written by Danilo; AI in mentor/review mode only.

## Stack

TypeScript 6 · Node 24 LTS · npm workspaces · Vitest 4 · zod 4
(later: Express 5 + Socket.IO 4.8 · React 19 + Vite 8 · PostgreSQL)

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
npm test           # vitest run across all projects
npm run typecheck  # root tsc (vitest.config.ts), then per-workspace tsc --noEmit
```

## Docs

Planning artifacts (PRD, architecture, epics, stories) live in `_bmad-output/`.
The architecture document is the binding consistency contract: `_bmad-output/planning-artifacts/architecture.md`.
