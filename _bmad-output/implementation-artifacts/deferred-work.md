# Deferred Work

## Deferred from: code review of 1-1-monorepo-foundation-with-a-proven-test-harness (2026-06-11)

- ~~`outDir: "dist"` is configured in `packages/engine/tsconfig.json` but no build script exists, and `include: ["src"]` would emit `*.test.ts` into dist.~~ **Resolved in Story 4.1 (2026-07-17):** `tsconfig.build.json` per package excludes tests; real build scripts exist.
- Root `typecheck` uses `npm run typecheck --workspaces --if-present`: a workspace that forgets its `typecheck` script passes vacuously. From Story 2.1 on, every new package must ship a `typecheck` script; consider dropping `--if-present` once all packages have one.
- ~~`packages/engine/src/index.ts` uses a default export and a non-deck-flavored `hello()`; Story 1.2 replaces it with the real named-export barrel (`export { ... } from './deck/deck.js'`).~~ **Resolved in Story 1.2 (2026-06-11):** real named-export barrel shipped (`Card`/`StatKey`/`Deck` types + `onePieceDeck`); `index.test.ts` hello test deleted, `deck.test.ts` is the engine suite.
- `tsconfig.base.json` omits `skipLibCheck` — future dependencies' `.d.ts` files can fail the whole workspace typecheck. Make a conscious keep/add decision when the dependency count grows.
- `vitest.config.ts` `projects: ["packages/*"]` treats any directory under packages/ as a Vitest project. Only matters if non-package dirs appear there.
- ~~Engine `exports`/`main`/`types` point at `./src/index.ts`; plain Node cannot load `.ts` from `node_modules`.~~ **Resolved in Story 4.1 (2026-07-17):** conditional exports (dev → src, default → dist); engine declared as a server dependency.

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

## Deferred from: code review of 2-2-create-a-match-and-get-a-shareable-link (2026-06-23)

- Join hardening (story 2.3): `match:join` has no player cap, no `status === 'waiting'` guard, and no per-socket dedupe — a match can accept a 3rd+ player or a repeated join from the same socket. The `MATCH_FULL` / join-to-full path is explicitly 2.3 per the 2.2 scope guard; add the cap + status check + socket dedupe there.
- `matchStore` eviction (story 2.5 / Epic 3): the in-memory `Map` only grows — every created match (plus abandoned lobbies) lives for the process lifetime. Eviction is tied to `match:ended` + the FR27 write; an abandoned-lobby TTL is a later hardening. No match-end lifecycle exists yet to hook.
- Token enforcement (story 2.4+): the per-player `token` is issued at join but nothing verifies it yet. By design — enforcement begins when in-match gameplay events carry the token.

## Deferred from: code review of 2-3-friend-joins-cards-are-dealt-the-table-appears (2026-06-26)

- Client DOM test infrastructure (early 2.4): set the client vitest `environment: 'jsdom'` and add a render lib (e.g. @testing-library/react). Unblocks the deferred 2.3 tests — `CardView` render (8 labeled stats + holder-only trump badge) and the join-from-URL initial screen — both manually verified for 2.3. 2.4 adds interactive stat selection, which wants component tests anyway.
- `MATCH_FULL` (and the status/socket-dedupe) join guards have no automated test — they live inside the socket handler. Extract the guard into a pure `canJoin(entry, socketId)` helper to unit-test, or add a socket round-trip test when socket integration testing is set up. Manually verified for 2.3.

## Deferred from: code review of 2-3 (2026-06-26)

- Disconnect handling (story 2.6 / FR5): no `socket.on('disconnect', …)` removes a lobby player. A player who drops mid-lobby stays in `entry.players`; a later 2nd join still auto-starts and emits `match:state` to the dead socket. Add lobby cleanup + forfeit in 2.6.
- Joiner can hang on `waiting` if the creator's socket-join silently failed (no client waiting-timeout, no lobby-presence event). Pair with the 2.6 disconnect work — likely a client-side waiting timeout / lobby-status signal.
- Reconnect identity: the same-socket dedupe in `match:join` keys on `socket.id` (changes on reconnect), so it can't recognize a reconnecting player. Proper identity uses the per-player token seam — part of the deferred reconnect work (post-2.6).

## Deferred from: code review of 2-4 (2026-06-27)

- Match-end experience (story 2.5): when `applyCommand` returns a state with `result` set, the client still renders the playable table (board "freezes") and the server leaves the entry `status: 'playing'`. 2.5 adds the `ResultScreen`, the `match:ended` event, status→`ended`, and store eviction. Until then the end is invisible and further `selectStat` clicks just get `MATCH_OVER`.

## Deferred from: code review of 2-5 (2026-06-28)

- AC1 eviction (story 2.6 / abandoned-TTL): no `deleteMatch` exists; finished matches stay in the in-memory Map. In tension with the Option-A rematch (which reuses the entry), so eviction needs a different trigger — disconnect cleanup (2.6) and/or an abandoned-match TTL. The literal AC1 "evict after the ended event fires" is unmet until then.
- One-sided rematch has no exit: if one player accepts and the opponent never does, the accepter is stuck on "Waiting for opponent…" with no decline/timeout. The "opponent left" case lands with disconnect/forfeit (2.6); add a rematch decline/timeout as a small follow-up.

## Deferred from: code review of 2-6-vanishing-opponents-forfeit-fairly (2026-07-16)

- Never-joined matches leak forever: an entry created via `POST /api/matches` whose creator never sends `match:join` has no socketId, so the new disconnect-driven cleanup structurally cannot reach it (`findMatchBySocketId` never matches). Pre-existing since 2.2. Fold into the abandoned-match TTL sweep (same bucket as the both-idle-on-result-screen case).
- Forfeited player who silently reconnects (blip > ~10s, no page reload) stays stuck on a dead match screen — their own `disconnect` only flips `status`, and every action returns `MATCH_NOT_FOUND` until they reload. Proper handling IS the grace-period reconnect follow-up (decision D16); do not band-aid separately.
- One socket can join two different `waiting` matches (the `ALREADY_JOINED` guard is per-entry); on disconnect only the first entry found is resolved and the second leaks with a dead socketId. Pre-existing join-hardening gap; fix in the join handler (e.g. reject when `findMatchBySocketId(socket.id)` hits) when touching the lobby next.
- Cosmetic race: an in-flight `match:selectStat` that loses the race against a forfeit gets `MATCH_NOT_FOUND` back, briefly showing a stray "Match not found" alert on the winner's result screen. Harmless; revisit with reconnect/UX polish.

## Deferred from: code review of 3-1-finished-matches-are-written-to-postgresql (2026-07-16)

- The `matches` table stores no `match_id` and identifies players by nickname only (AC1's v1 column list; NFR5 = no accounts). Consequences accepted for v1: rows can't be correlated with server logs or deduplicated, and two players with the same nickname make `winner_nickname` ambiguous. Revisit when the schema next evolves (3.2+ or accounts).
- No graceful shutdown: `pool.end()` is never called, so an insert in flight during a server stop is silently lost. Belongs to the deployment story (NFR6) alongside signal handling.
- CardView art that failed twice stays on the fallback for the whole session (failure map is per-card, never reset). Cosmetic, accepted in the 3.1 review; a per-appearance retry would need effect-style state sync again.

## Deferred from: code review of 3-2-recent-matches-on-the-home-screen (2026-07-16)

- Hardcoded `http://localhost:3000` API origin is now in three client places (HomeScreen create fetch, `socket.ts`, RecentMatches fetch). Works for the local-dev deployment shape; replace with one `VITE_API_URL`-style base (or relative paths + proxy) when the NFR6 remote-host deployment story lands.
- `RecentMatch` wire type is declared in the server db layer and mirrored in the client (client cannot import the server package). Move REST payload types into the engine protocol package (the established home for shared wire types) on the next protocol touch.
