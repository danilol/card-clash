# Deferred Work

## Deferred from: code review of 1-1-monorepo-foundation-with-a-proven-test-harness (2026-06-11)

- `outDir: "dist"` is configured in `packages/engine/tsconfig.json` but no build script exists, and `include: ["src"]` would emit `*.test.ts` into dist (importing devDependency vitest). Address in the first story that introduces a real build (2.1) — likely via a `tsconfig.build.json` or `exclude`.
- Root `typecheck` uses `npm run typecheck --workspaces --if-present`: a workspace that forgets its `typecheck` script passes vacuously. From Story 2.1 on, every new package must ship a `typecheck` script; consider dropping `--if-present` once all packages have one.
- ~~`packages/engine/src/index.ts` uses a default export and a non-deck-flavored `hello()`; Story 1.2 replaces it with the real named-export barrel (`export { ... } from './deck/deck.js'`).~~ **Resolved in Story 1.2 (2026-06-11):** real named-export barrel shipped (`Card`/`StatKey`/`Deck` types + `onePieceDeck`); `index.test.ts` hello test deleted, `deck.test.ts` is the engine suite.
- `tsconfig.base.json` omits `skipLibCheck` — future dependencies' `.d.ts` files can fail the whole workspace typecheck. Make a conscious keep/add decision when the dependency count grows.
- `vitest.config.ts` `projects: ["packages/*"]` treats any directory under packages/ as a Vitest project. Only matters if non-package dirs appear there.
- Engine `exports`/`main`/`types` point at `./src/index.ts` (decision 2026-06-11: accepted for now). Works for tsc/Vitest; plain Node cannot load `.ts` from `node_modules`. MUST be repointed to `dist/` in the story that introduces the engine build (2.1), before the first runtime consumer imports `@card-clash/engine`.

## Deferred from: code review of 1-2-the-32-card-one-piece-deck-as-typed-data (2026-06-11)

- Type-only circular import between `packages/engine/src/types.ts` and `packages/engine/src/deck/deck.ts` (each imports types from the other). Harmless while type-only (erased at emit); a consequence of the recorded decision to re-export `Deck` from `types.ts` for AC4. Revisit if either file gains value exports or the layout changes.
- Quote-style inconsistency across engine source files (`types.ts`/`index.ts` single quotes; `deck.ts`/`onePieceDeck.ts`/`deck.test.ts` double quotes). No formatter is configured; decide on Prettier/Biome (or an ESLint rule) in a tooling-focused moment rather than hand-normalizing.

## Deferred from: code review of 1-3-match-setup-shuffle-deal-and-the-will-of-d (2026-06-12)

- `Deck` type reachable via two import routes (`setup.ts` imports from `deck/deck.js` directly; the barrel exports it via `types.js` re-export). Same family as the 1.2 deferred circular-import item — one refactor away from drift. Revisit when the engine layout changes (e.g. 2.1 build wiring).
