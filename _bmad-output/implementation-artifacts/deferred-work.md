# Deferred Work

## Deferred from: code review of 1-1-monorepo-foundation-with-a-proven-test-harness (2026-06-11)

- `outDir: "dist"` is configured in `packages/engine/tsconfig.json` but no build script exists, and `include: ["src"]` would emit `*.test.ts` into dist (importing devDependency vitest). Address in the first story that introduces a real build (2.1) — likely via a `tsconfig.build.json` or `exclude`.
- Root `typecheck` uses `npm run typecheck --workspaces --if-present`: a workspace that forgets its `typecheck` script passes vacuously. From Story 2.1 on, every new package must ship a `typecheck` script; consider dropping `--if-present` once all packages have one.
- `packages/engine/src/index.ts` uses a default export and a non-deck-flavored `hello()`; Story 1.2 replaces it with the real named-export barrel (`export { ... } from './deck/deck.js'`).
- `tsconfig.base.json` omits `skipLibCheck` — future dependencies' `.d.ts` files can fail the whole workspace typecheck. Make a conscious keep/add decision when the dependency count grows.
- `vitest.config.ts` `projects: ["packages/*"]` treats any directory under packages/ as a Vitest project. Only matters if non-package dirs appear there.
