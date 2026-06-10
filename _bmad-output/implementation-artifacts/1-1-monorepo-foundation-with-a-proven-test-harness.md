# Story 1.1: Monorepo foundation with a proven test harness

Status: ready-for-dev

<!-- Process note (binding, per PRD addendum & architecture handoff): Danilo hand-writes ALL code.
     This story is a tutorial-sized step guide + review contract, NOT a spec for a code-generating
     agent. AI role: explain, point, review. Do NOT run bmad-dev-story as designed on this story. -->

## Story

As Danilo (developer-learner),
I want a hand-built npm-workspaces monorepo with the engine package compiling and one Vitest test passing,
so that every later story starts from a working build-and-test loop.

## Acceptance Criteria

1. **Given** an empty repo, **when** I run `npm install && npm test` at the root, **then** the engine workspace is discovered, TypeScript 6 compiles it in strict mode (extending `tsconfig.base.json`), and one trivial test passes.
2. `packages/engine/package.json` declares zod as its only dependency.
3. **Given** the root package.json, **when** workspaces resolve, **then** `packages/*` is the workspace pattern and packages are ESM (`"type": "module"`).

## Tasks / Subtasks

- [x] Task 1: Replace the placeholder root `package.json` (AC: 1, 3)
  - [x] ⚠️ The repo root already contains a default `npm init -y` package.json (`"main": "index.js"`, no workspaces, no `"type"`) — rewrite it, don't extend it
  - [x] Set: `"private": true`, `"type": "module"`, `"workspaces": ["packages/*"]`
  - [x] Root scripts: `"test"` runs Vitest once across all projects (`vitest run`); add a `"typecheck"` script that runs `tsc --noEmit` in each workspace (`npm run typecheck --workspaces` pattern)
  - [x] Root devDependencies: `typescript` (6.0.x), `vitest` (^4) — shared toolchain lives at the root and hoists; runtime deps live in the package that uses them
- [x] Task 2: Write `tsconfig.base.json` at the repo root (AC: 1)
  - [x] Shared strict compiler options only — no `include`/`outDir` here (those are per-package)
  - [x] Key decisions to make and be able to defend: `"strict": true`, `"module"`/`"moduleResolution"`: `"nodenext"` (engine & server are run on Node 24, compiled by plain tsc — not bundled), a modern `"target"` (Node 24 supports ES2024), `"verbatimModuleSyntax": true` (forces explicit `import type` — the exact discipline the client will need later when it may import engine types only)
- [x] Task 3: Hand-create the engine package skeleton (AC: 1, 2)
  - [x] `packages/engine/package.json`: name `@card-clash/engine` (or `engine` — pick one convention and keep it), `"type": "module"`, `"private": true`, dependencies: **zod ^4 and nothing else**
  - [x] `packages/engine/tsconfig.json`: `"extends": "../../tsconfig.base.json"` + package-level `include: ["src"]` and compile settings
  - [x] `packages/engine/src/index.ts`: the public API barrel — for now export one trivial pure function (e.g., something deck-flavored you'll keep or replace in 1.2)
  - [x] `packages/engine/src/index.test.ts`: co-located Vitest test asserting that function's behavior (Vitest co-location is the project pattern — tests sit beside the code they test)
- [x] Task 4: Wire Vitest 4 at the root (AC: 1)
  - [x] Root `vitest.config.ts` using `test.projects: ['packages/*']`
  - [x] ⚠️ Do NOT create `vitest.workspace.ts` — that file was deprecated in Vitest 3.2 and removed in v4; `projects` in the root config is the current mechanism
- [x] Task 5: Repo hygiene (AC: 1)
  - [x] `.gitignore`: `node_modules/`, `dist/`, `.env`
  - [x] Optional now, required eventually: stub `README.md` (written by AI 2026-06-11 — docs, not implementation code, per working agreement)
- [x] Task 6: Prove the loop (AC: 1, 2, 3)
  - [x] `npm install` at root → engine workspace symlinked under root `node_modules`
  - [x] `npm test` → Vitest discovers the engine project and the one test passes
  - [x] `npm run typecheck` → tsc strict-compiles the engine with zero errors
  - [x] Commit; this is the baseline every later story builds on

### Review Findings

<!-- bmad-code-review 2026-06-11, reviewed merged PR #1 (6e77408^1..6e77408). Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. Per working agreement, code fixes are implemented by Danilo. -->

- [x] [Review][Decision] AC1 FAILS — the one test does not pass — `index.ts` returns `"Hello from Engine!"` (capital E, from `const name: string = "Engine"`) but `index.test.ts` asserts `"Hello from engine!"`. Verified red: `npm test` → `Tests 1 failed (1)`. Decide which string is canonical, then align the other side. (blind+edge+auditor, critical)
- [x] [Review][Decision] Engine package has no `exports`/`main`/`types` — `import "@card-clash/engine"` from another package fails under NodeNext (ERR_MODULE_NOT_FOUND/TS2307). Decide: add an `exports` map now, or defer to Story 2.1 when the first external consumer appears. (blind+edge, major)
- [x] [Review][Decision] `vitest.config.ts` is type-checked by nothing — root typecheck only fans out to workspaces; no root tsconfig includes it. Decide: add a minimal root `tsconfig.json` (not in the story's target tree), or accept the gap. (blind+edge, minor)
- [x] [Review][Patch] Add `"engines": { "node": ">=24" }` to root package.json — spec targets Node 24 / ES2024 but nothing enforces it; review machine ran Node v20.19.4 without warning [package.json]
- [x] [Review][Patch] Story bookkeeping: header still `Status: ready-for-dev` (sprint says `review`); Debug Log records `npm test:engine` (invalid — `npm run test:engine`); Completion Notes empty [this file]
- [x] [Review][Patch] `.gitignore`: redundant `_bmad/config.user.toml` line (covered by `_bmad/`); missing `coverage/` and `.env.*` variants (keep `.env.example` committed) [.gitignore]
- [x] [Review][Patch] README documents `typecheck` as plain `tsc --noEmit`; actual script is per-workspace delegation with `--if-present` [README.md]
- [x] [Review][Patch] Missing trailing newlines [packages/engine/src/index.ts, packages/engine/tsconfig.json, tsconfig.base.json]
- [x] [Review][Patch] Redundant type annotation `const name: string = "Engine"` — literal is already inferred [packages/engine/src/index.ts:2]
- [x] [Review][Defer] `outDir: "dist"` configured but no build script; `include: ["src"]` would emit test files into dist [packages/engine/tsconfig.json] — deferred to first build story (2.1)
- [x] [Review][Defer] `typecheck --if-present` silently skips workspaces lacking the script [package.json:9] — deferred; add `typecheck` script to every new package starting 2.1
- [x] [Review][Defer] `index.ts` is a default export, not a named-export barrel, and not deck-flavored [packages/engine/src/index.ts] — deferred; Story 1.2 replaces it with the real barrel
- [x] [Review][Defer] No `skipLibCheck` in tsconfig.base.json — third-party `.d.ts` can break typecheck [tsconfig.base.json] — deferred, conscious-decision item
- [x] [Review][Defer] `projects: ["packages/*"]` glob matches any directory, package or not [vitest.config.ts:5] — deferred, only bites if stray dirs land in packages/

## Dev Notes

### Working agreement (binding)

- Danilo types every file in this story by hand. AI may explain any concept here, review the result against this file + architecture.md, and pair on debugging via questions — but never paste-ready file contents. [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md#Working-agreement]
- The Vite client scaffold is the ONLY generator permitted in this project — and it belongs to **Story 2.1, not this story**. Scope here is root + engine only. [Source: planning-artifacts/architecture.md#Starter-Template-Evaluation]

### Stack (versions verified 2026-06-10 in architecture)

| Piece | Version | Where declared |
|---|---|---|
| Node.js | 24 LTS | runtime (consider `"engines"` field in root package.json) |
| TypeScript | 6.0.x | root devDependency |
| Vitest | 4.x | root devDependency |
| zod | 4.x | `packages/engine` dependency — its ONLY one |

[Source: planning-artifacts/architecture.md#Architecture-Validation-Results]

### Constraints that bite in this story

- **Engine purity is a package boundary, not a promise**: `packages/engine` imports zod only — no socket.io, no pg, no React, no Node APIs (`fs`, `path`, …). This story establishes the boundary; review checks `package.json` deps and imports. [Source: planning-artifacts/architecture.md#Architectural-Boundaries]
- **ESM + NodeNext gotcha**: with `"type": "module"` and `moduleResolution: "nodenext"`, relative imports in TS source must be written with a `.js` extension (`./deck/deck.js`) so the tsc output resolves at runtime on Node. Vitest tolerates either; tsc + Node do not. Adopt the `.js`-extension habit from the first file.
- **Vitest 4 projects**: monorepo test discovery = `test.projects` glob in root `vitest.config.ts`. Per-project configs can't extend the root config (it carries `projects`); not a problem at this story's size — one shared root config is enough.
- **No TS project references, no pnpm, no bundler for engine/server** — consciously rejected at this scale; build order via npm scripts is the decision. Don't add them "while you're in there". [Source: planning-artifacts/architecture.md#Development-Workflow-Integration]
- **Naming contract starts now**: modules camelCase, types PascalCase (no `I` prefix), constants SCREAMING_SNAKE_CASE, tests co-located `x.test.ts` beside `x.ts`. One concept = one name: `match`, `stat`, `stack`, `pot`, `superTrump`, `chooser`. [Source: planning-artifacts/architecture.md#Naming-Patterns]

### What "done" sets up for the next stories

- Story 1.2 (deck data) drops straight into `packages/engine/src/deck/` with `deck.ts` (Deck interface), `onePieceDeck.ts`, `deck.test.ts` — your barrel `index.ts` and test harness must make that frictionless.
- The engine package is the interview showcase; its test suite starts here with one trivial test and grows every story through 1.8.

### Project Structure Notes

Target tree after this story (slice of the full architecture tree):

```
card-clash/
├── package.json            # REWRITE: private, type:module, workspaces, scripts
├── package-lock.json       # generated by npm install
├── tsconfig.base.json      # NEW: shared strict options
├── vitest.config.ts        # NEW: test.projects: ['packages/*']
├── .gitignore              # NEW
└── packages/
    └── engine/
        ├── package.json    # NEW: zod only
        ├── tsconfig.json   # NEW: extends ../../tsconfig.base.json
        └── src/
            ├── index.ts        # NEW: public API barrel (the only door)
            └── index.test.ts   # NEW: the one passing test
```

Variances from architecture tree, with rationale: `vitest.config.ts` at root is not drawn in the architecture tree but is required by the root `npm test` script decision; `.env.example` deferred to the first server story (nothing reads env vars yet); `packages/server` and `packages/client` deferred to Epic 2 by epic scoping.

### References

- [Source: planning-artifacts/epics.md#Story-1.1] — story statement + ACs (authoritative)
- [Source: planning-artifacts/architecture.md#Starter-Template-Evaluation] — hand-assembled monorepo decision, init commands
- [Source: planning-artifacts/architecture.md#Project-Structure-&-Boundaries] — full target tree, engine boundary
- [Source: planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules] — naming/structure/process contract
- [Source: planning-artifacts/architecture.md#Implementation-Handoff] — "First Implementation Priority" matches this story
- [Source: planning-artifacts/prds/prd-card-clash-2026-06-10/addendum.md] — working agreement (Danilo codes, AI mentors)
- [Vitest Test Projects guide](https://vitest.dev/guide/projects) — `projects` replaces the removed workspace file (external, checked 2026-06-10)

## Dev Agent Record

<!-- This project runs human-implements / AI-reviews. Danilo fills File List & notes at completion;
     the review workflow (bmad-code-review on Danilo's commit) uses this section. -->

### Agent Model Used

N/A — hand-implemented by Danilo (AI mentor/review mode per working agreement)

### Debug Log References
scripts added:

- `npm run typecheck`
- `npm run test`
- `npm run test:engine`

### Completion Notes List

### File List
┌───────────────────────────────────┬───────┐
│               File                │ Lines │
├───────────────────────────────────┼───────┤
│ package.json                      │ +22   │
├───────────────────────────────────┼───────┤
│ tsconfig.base.json                │ +9    │
├───────────────────────────────────┼───────┤
│ vitest.config.ts                  │ +7    │
├───────────────────────────────────┼───────┤
│ packages/engine/package.json      │ +16   │
├───────────────────────────────────┼───────┤
│ packages/engine/tsconfig.json     │ +8    │
├───────────────────────────────────┼───────┤
│ packages/engine/src/index.ts      │ +4    │
├───────────────────────────────────┼───────┤
│ packages/engine/src/index.test.ts │ +9    │
├───────────────────────────────────┼───────┤
│ .gitignore                        │ +11   │
├───────────────────────────────────┼───────┤
│ README.md                         │ +28   │
└───────────────────────────────────┴───────┘

9 files, 114 insertions, no deletions.