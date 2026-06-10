# Reconciliation — Source Rules & Chart vs PRD (prd-card-clash-2026-06-10)

Scope: original user-supplied "One Piece: Top Trumps — Game Rules (v1.0)" + 32-character chart + verbal context, reconciled against `prd.md` and `addendum.md`. Known intentional deviations (8 stats, Buggy as fixed Counter, Age as low-wins, 1v1-only, instant forfeit, data normalizations incl. Dragon = 5,000,000,000 and No DF = 0) are NOT re-flagged.

## Gaps (source content not represented, or dropped without a note)

1. **"Reads aloud" flavor silently dropped.** Source rule 4 has players reading the category and value aloud ("Bounty: 1.5 Billion!"). FR12's mutual reveal is the functional digital equivalent, but the announcement/callout flavor (e.g., a "Chooser calls: Bounty — 1.5 Billion!" banner) appears nowhere in the PRD or the addendum's UX digest, and the drop is not acknowledged. Minor, but it is the one flavor idea in the source with no trace.
2. **First-turn rule replaced, source version not mentioned.** Source rule 4: "Player 1 chooses" the first category (i.e., a defined first player — naturally the match creator). PRD FR10 selects the first chooser at random, marked `[ASSUMPTION]`, but does not note that the source specified Player 1. The deviation is visible (flagged as an assumption) but the source's contrary instruction is not surfaced for the owner to consciously confirm.
3. **Bounty display formatting unspecified.** The source's read-aloud example implies billions-scale presentation ("1.5 Billion!"). FR29/FR30 say "labeled stat values" with no formatting guidance for 10-digit bounties on a placeholder card. Nitpick; flag only because the source example hints at expected presentation.

Everything else in the source rules text is either represented (see Verified-faithful) or covered by the known-deviation list.

## Contradictions (PRD vs source — all flagged in the PRD as assumptions, none silent)

1. **FR25 round cap vs source victory condition.** Source rule 1/6: objective is to "win every card"; "the game ends instantly when one player has successfully collected all 32 cards." FR25 ends a match at 100 rounds with most-cards-wins — a player can become Pirate King holding fewer than 32 cards. PRD marks it `[ASSUMPTION — safety valve]` with research rationale (addendum confirms loop risk), so it is a conscious contradiction, but it does directly contradict the source's stated victory condition and should be on the owner's confirm list.
2. **FR9 excludes Buggy from the Super Trump draw.** Source rule 2 says the system "randomly selects one character card" — no exclusion; under the source text Buggy could himself be the Super Trump. PRD adds a redraw rule (marked `[ASSUMPTION]`). Reasonable, but it changes the probability space (31/32 instead of 32/32) and is an invented rule, not a source rule.
3. **First chooser: random (FR10) vs "Player 1" (source rule 4).** Same item as Gap 2, listed here because it is a direct behavioral contradiction, albeit assumption-flagged.

No unflagged/silent contradictions were found between PRD sections and the source. PRD body, Appendix A, and addendum are internally consistent with each other.

## Data-check (Appendix A vs source chart, after known normalizations)

All 32 rows verified cell by cell (8 stats × 32 characters = 256 values). **Zero mismatches.**

- Annotated values correctly normalized to the primary number: Usopp Fear 15 (not fake 99), Jinbe Speed 65 (not in-water 92), Roger/Whitebeard/Ace ages kept as listed despite "(Dec.)", Akainu Loyalty 60, Kuzan Loyalty 50, Hancock Loyalty 90, Dragon DF 90 ("Est."), Kuma Loyalty 100, Kizaru Speed 100, Teach DF 98.
- Marine bounties (Garp, Akainu, Kizaru) = 0 per source. Dragon bounty = 5,000,000,000 per known normalization. All "No DF" → 0 on exactly the 10 characters the source marks (Zoro, Nami, Usopp, Sanji, Franky, Jinbe, Shanks, Mihawk, Roger, Garp).
- All 32 character names and their order (#1–#32) match the source exactly.
- One trivial documentation slip in `addendum.md` ("Data normalization detail"): it cites a dropped annotation *Bon Clay Loyalty 100 ("Okama Way")* — the source chart has no annotation on Bon Clay's Loyalty (his annotations are on Speed "(Okama Kenpo)" and Battle IQ "(Infiltration expert)"). The value 100 is correct; only the quoted annotation is invented. No impact on the deck data.

## Verified-faithful (brief)

- **Rules:** 32-card deck; win-all-cards objective; Pirate King framing; random per-match Super Trump that auto-wins regardless of stats (FR17, extended to tie-breakers); Counter-card instant win (FR18); shuffle + equal deal + face-down stacks + top-card-only visibility (FR7/FR8); chosen stat compared, highest wins, winner stacks cards at bottom (FR11–FR14); low-stat-wins category exists (Age, FR13); round winner chooses next (FR15); tie → central pot, same chooser re-picks from next card, tie-breaker winner takes played cards + entire pot (FR20–FR21), with chaining (FR22) and out-of-cards edge (FR23) as sensible additions; elimination at zero cards and instant end at 32 (FR24).
- **Flavor:** "the Will of D." (FR9, §5.3), "the Grand Line Pot" (§5.4), "Pirate King" (§1), face-down stacks (FR7) all survive. Clockwise multi-player flow consciously deferred and explicitly preserved in §7.2.
- **Verbal context:** interview-practice purpose (§1, §2); TypeScript + unit testing + modern patterns (addendum stack intent, NFR1); database persistence (FR27/FR28); browser-playable (NFR4); 1v1 now with multi-player future (§7.2); incremental basic-loop-first (counter-metric, §2); One Piece first / multi-theme later with configurable values & layouts (§7.3); placeholder card UI with character name (FR29); hardcoded deck (FR6); "Danilo writes all code, AI mentors only" captured as a binding constraint (§2) and operationalized in the addendum's working agreement.
