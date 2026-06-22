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

## Deferred from: code review of 1-4-round-resolution-compare-transfer-pass-the-turn (2026-06-19)

- Tie resolution `throw`s a hard `Error` in `applyCommand` (intentional placeholder per Task 4). Reachable in normal play: `onePieceDeck` has many duplicate stat values (bounty 0 ×3, bounty 3,000,000,000 ×4, plus repeated haki/loyalty/devilFruitMastery values), so a full seeded match will hit a tie before story 1.6 implements tie→pot mechanics. Resolve in 1.6.
- No guards around empty/degenerate state in `applyCommand`: `shift()!` on an empty stack and `find()!` for the opponent both rely on the 2-player, non-empty invariant. A player reaching 0 cards (then acting again) would crash, and there is no end-of-match signal. Spec defers match-end / elimination to story 1.7.

## Deferred from: code review of 1-6-ties-and-the-grand-line-pot (2026-06-21)

- Both-empty tie (each player plays their last card into the same tie): `applyCommand` resolves it as opponent-takes-all because the `chooserStack.length === 0` branch is checked before `opponentStack.length === 0`. Safe (no crash, multiset conserved) but arbitrary — the proper draw / sudden-death rule (FR25) lands in 1.7. (Accepted per story 1.6 decision 1e.)
- Reinforces the 1.4-review defer: FR23 elimination now *legitimately* produces a 0-card player, so the unguarded `shift()!` is reachable if `applyCommand` is called again on a finished state. 1.7's `ended`/`endReason` guard (FR24) must block acting on a finished match.
- `lastRound.winner === null` cannot distinguish a pushed tie from an FR23 elimination; 1.7 end-detection should read stack sizes, not `lastRound.winner`.

## Deferred from: code review of 2-1-client-and-server-come-alive-with-a-working-dev-loop (2026-06-22)

- Reconnect / initial-failure UX is coarse: `connect_error` fires on every reconnect attempt and pins the UI to `disconnected`; a first-ever connect failure (server never reached) also shows `disconnected` with no distinct "cannot reach server" state. By design for 2.1 (AC3 scopes the enum to `connecting | connected | disconnected`; `connect_error` → `disconnected` is the chosen mapping). Extends the existing reconnect-state defer — richer reconnecting/error states are 2.2+ polish when the socket carries real game events.
