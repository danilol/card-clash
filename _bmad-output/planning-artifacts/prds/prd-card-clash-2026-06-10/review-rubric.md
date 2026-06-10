# PRD Quality Review — Card Clash (One Piece Top Trumps)

Reviewed: `prd.md` + `addendum.md` against the PRD quality rubric, calibrated to the agreed stakes (hobby/solo, interview prep, ~3-page target; decision log D1/D10).

## Overall verdict

This is a genuinely good PRD for its stakes. It has a real thesis (learning vehicle first, playable game second), a counter-metric that actually arbitrates conflicts (time-to-playable), decisions stated as decisions with rejected alternatives preserved, and rules written as testable FRs that the unit-tested engine — the interview artifact — can be built against directly. What's at risk is narrow: a small family of edge-case rule gaps around the pot at non-standard match endings and an unimplementable "instant" disconnect rule, plus the Appendix A values still being formally unconfirmed while labeled authoritative. None of these block downstream architecture/epics work; the pot edges should be resolved before the engine's test suite is written.

## Decision-readiness — strong

Decisions are made, not floated. The counter card is "Fixed: Buggy" (§5.3 FR18), Super Trump visibility is "known to its holder only" (FR19), disconnects are "instant forfeit" with the alternative explicitly deferred (FR5, §7.1) — and the addendum's "Rejected alternatives" table names what was given up and why ("hidden until played… strategically inert" is real reasoning, not theater). The counter-metric in §2 ("if polishing any feature delays the first complete friend-vs-friend match, the feature loses") gives a decision-maker an actual tiebreaker, and the AI-assistance constraint is stated as binding ("a feature delivered as generated code counts as a failure"). Open items are genuinely open: OQ2 (licensed IP) has no smuggled answer, and the §8 NOTE FOR PM sits at a real tension (Age low-wins making Chopper a counterintuitive powerhouse) with a stated disposition ("charm, not a bug; revisit only if playtests say otherwise").

### Findings
- **low** Appendix A authority is self-contradictory (§Appendix A header vs §8 OQ1) — the deck is labeled "normalized, authoritative for v1" while OQ1 says the normalization choices are "facilitator assumptions pending Danilo's review." An engineer can't tell whether to hardcode these values yet. *Fix:* after Danilo's review, drop the "pending" flag from OQ1 (or relabel the appendix "provisional until OQ1 closes").

## Substance over theater — strong

Nothing here is furniture. There are no personas at all — §4 dispatches the user model in one sentence ("one user type: a casual player who receives or creates a match link"), which is exactly right for this product. The NFRs are product-specific where boilerplate would have been easy: NFR1 makes the deterministic, isolatable rules engine a *product* requirement with the reason stated ("the engine is the interview artifact"); NFR2 names the exact hidden information (opponent cards, deck order, Super Trump location); NFR5 and NFR6 are concrete to this deployment. The Vision (§1) could not be swapped into another PRD — it names the deck size, the win condition, and the dual purpose with an explicit priority order. The addendum's research digest earns its place by feeding a specific FR (round cap, FR25) rather than decorating.

No findings.

## Strategic coherence — strong

The thesis — interview-relevant engineering wrapped in a game fun enough that "a friend will actually play a full match over a shared link" — is stated in §1 with an explicit priority order, and the scope follows from it everywhere: no accounts (addendum: rejected because they "delay time-to-playable, the counter-metric"), placeholder UI, instant forfeit, hardcoded deck. The §2 goals table maps one-to-one onto the thesis (playable v1, interview-ready engine, persistence practice, incremental growth), and §7's future direction is ranked rather than a wishlist, with an engineering implication attached ("the rules engine should not bake in the two-player assumption where avoiding it is cheap" — per decision D19). Success criteria are qualitative rather than numeric, which fits hobby stakes; the one quantitative discipline that matters (counter-metric) is present.

No findings.

## Done-ness clarity — strong

This is the dimension the rubric says to be unforgiving on, and the PRD mostly survives it. Nearly every FR has a testable consequence: FR7 ("16 cards per player, face-down"), FR13 (Age low-wins named as the single exception), FR17/FR18 (Super Trump precedence and its one exception, including tie-breaker rounds), FR25 (a numeric round cap with a defined tiebreak), FR27 (the exact persisted fields enumerated). FR14 even pins card-return order with an assumption tag — the kind of determinism the unit-tested engine needs. The gaps that remain are real but few, and they cluster around the pot at non-standard endings.

### Findings
- **medium** Pot disposition at non-standard endings is unspecified (FR23, FR24, FR25) — FR24 claims the winner "thereby holds all 32 cards," but if elimination happens via FR23 (no next card mid-tie-chain) the pot is non-empty and nobody holds it; likewise FR25's round-cap count ("the player holding more cards wins") doesn't say whether pot cards count for anyone. The engine's test suite will force this question; better the PRD answers it. *Fix:* one sentence, e.g. "any pot cards go to the match winner and are excluded from FR25's card count."
- **medium** "Disconnects… the match ends immediately" is not implementable as written (FR5) — there is no definition of what a disconnect is; a literal instant forfeit triggers on any transient network blip and will sour real friend-vs-friend matches, undermining the §2 "playable v1" goal. *Fix:* define it as a threshold ("no heartbeat for N seconds ⇒ forfeit") — this is not the deferred grace-period feature, just making v1's rule testable.
- **low** Rematch semantics unstated (FR26) — "offers a rematch with the same opponent" doesn't say whether rematch re-runs full match setup (fresh shuffle, new Super Trump draw per FR9). Inferable, but the engine needs it pinned. *Fix:* "rematch re-runs §5.1 setup from scratch."
- **low** Residual adjectives — FR12 "winning value clearly indicated," FR16 "a clear 'opponent is choosing…' state," NFR4 "usable (not optimized) on mobile." All acceptable at hobby stakes and partially redeemed by concrete state names, but they are the only spots where "done" is a judgment call. *Fix:* leave for `bmad-ux` to bound; no PRD change strictly needed.

## Scope honesty — strong

Omissions are explicit, not inferred. §3 lists nine out-of-scope items by name (including the easy-to-silently-assume ones: reconnect, chat, spectating, artwork). De-scoping is done in the open: FR5 ships instant forfeit with the grace period named as "the first planned follow-up," and the addendum records that grace-period effort was assessed ("moderate… not huge") and deferred by an explicit rule, not hand-waved. Inferences the user didn't confirm carry inline `[ASSUMPTION]` tags (FR9, FR10, FR14, FR23, FR25, FR26, FR28, NFR4, Appendix A) — nine of them plus two OQs and one NOTE FOR PM, a density that is healthy, not alarming, for a same-day fast-path PRD at these stakes, especially since OQ1 names the confirmation step. The one structural gap (no Assumptions Index) is mechanical, noted below.

No findings.

## Downstream usability — adequate

This is a chain-top PRD — the addendum explicitly routes to `bmad-create-architecture`, epics, and stories — so this dimension matters. IDs are clean: FR1–FR30 contiguous and unique, NFR1–6, OQ1–2; every cross-reference I chased resolves (§7 from FR5, Appendix A from FR6, FR18 from the Appendix footnote, FR4 from NFR2, PRD↔addendum references). Domain terms (Super Trump / "the Will of D.", Counter card, pot / "Grand Line Pot", chooser) are bolded and defined at first use, which substitutes acceptably for a glossary at 3 pages. The weak spot is stat naming: the deck module and card UI (FR29 "8 labeled stat values") need canonical stat names, and the PRD gives three variants.

### Findings
- **low** Stat names drift between FR6 and Appendix A — FR6 says "Loyalty/Honor," "Devil Fruit Mastery," "Fear Factor," "Speed/Agility"; the table headers say "Loyalty," "DF Mastery," "Fear," "Speed." The hardcoded deck module and the FR29 card labels need one canonical set. (Same family: the addendum's normalization detail says "Whitebeard" where the table says "Edward Newgate.") *Fix:* declare one of the two name sets canonical in FR6 or the Appendix header.

## Shape fit — strong

The shape matches the product. For a hobby/solo game whose core deliverable is a rules engine, rules-as-FRs (§5, organized by game phase) is the right spine, and the PRD correctly skips personas and user journeys — the single "casual player" sentence in §4 plus the FR4–FR5 session flow carry everything UJs would have. Rigor is light where the rubric permits (no numeric success metrics, no acceptance-criteria section) while the substance bar is still met (testable FRs, named trade-offs). The PRD/addendum split is disciplined: stack intent, the AI-mentorship working agreement, rejected alternatives, and research live in the addendum with owners named, keeping the body at its ~3-page target without losing the material. The appendix deck data is load-bearing, not decoration — FR6 declares it authoritative.

No findings.

## Mechanical notes

- **Assumptions Index roundtrip: fails (no index).** Nine inline `[ASSUMPTION]` tags (FR9, FR10, FR14, FR23, FR25, FR26, FR28, NFR4, Appendix A intro; plus the Dragon bounty one repeated in the addendum) but §8 Open Items only surfaces the Appendix A cluster via OQ1. A five-line index in §8 would let Danilo confirm them in one pass — cheap and worth doing given OQ1 already promises that review.
- **ID continuity: clean.** FR1–FR30 with no gaps or duplicates; NFR1–6; OQ1–2.
- **Glossary drift: minor.** "pot" vs "Grand Line Pot" (heading vs body — fine), "Super Trump" vs "the Will of D." (alias defined at first use — fine), stat-name variants (flagged above as a finding since they feed code), "Whitebeard"/"Edward Newgate" in the addendum.
- **Cross-references: all resolve**, including PRD→addendum and addendum→PRD (NFR1, FR27/FR28, NFR6).
- **Required sections for these stakes: present.** Vision, goals + counter-metric, scope/non-goals, FRs, NFRs, future direction, open items. No UJ section — correct for this shape, per Shape fit.
