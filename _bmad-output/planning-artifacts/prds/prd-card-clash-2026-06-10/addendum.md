# Card Clash — PRD Addendum

Depth that belongs downstream (architecture, solution design, UX) or earned a place but doesn't fit the PRD body.

## Stack intent (for architecture — owner: Danilo)

Stated upfront as part of the project's learning purpose; kept out of the PRD body because the PRD specifies capabilities, not implementation:

- **TypeScript** throughout, with deliberate use of modern JS/TS patterns (this is interview practice — pattern choices should be explainable, not just fashionable).
- **Unit testing** as a first-class deliverable; the rules engine is the showcase artifact (see PRD NFR1).
- **Database persistence** — a real database, exercised for match results (PRD FR27/FR28). Engine/transport/DB choices are architecture decisions, deferred to `bmad-create-architecture`.
- Deployment shape: runs locally and on a single small remote host that Danilo operates (PRD NFR6).

## Working agreement for downstream phases (owner: Danilo)

**Revised 2026-07-16 (D23, supersedes the original D18 agreement):** AI plans and implements; Danilo requests features and approves. Concretely, for any tool/skill/agent used downstream of this PRD:

- **AI does:** BMAD planning (architecture, epics, stories), full implementation via `bmad-dev-story` / `bmad-quick-dev` as designed, tests, code review, and git operations (commit, push, PR, merge) — no per-action confirmation needed.
- **Danilo does:** requests features, approves story specs before dev, and decides on anything that changes scope. Stories already marked ready-for-dev count as approved.
- **Communication:** summaries of delivered work stay in plain, simple English, with framework concepts explained concretely (Danilo is newer to Express/Socket.IO than to pure TypeScript).

<details><summary>Original D18 agreement (2026-06-10 → 2026-07-16, retired)</summary>

Danilo codes; AI mentors. Yes: tutorial-sized steps, explaining, direction-pointing, reviewing hand-written code, planning artifacts. No: generating implementation code, scaffolding, "fixing it for him." Code-executing skills (`bmad-dev-story`, `bmad-quick-dev`, `bmad-story-automator`) not used as designed; stories run manually with AI in mentor/review mode.

</details>

## Rejected alternatives (rationale preserved)

| Decision | Chosen | Rejected & why |
|---|---|---|
| Counter card | Fixed: Buggy | *Computed lowest-total card* (more logic/test surface — interesting but adds rules ambiguity); *random per match* (a second hidden variable muddies the Super Trump mechanic). |
| Super Trump visibility | Known to holder only | *Announced to both* (simplest UI but kills the surprise); *hidden until played* (most suspense, but no one can act on information they don't have — strategically inert). Holder-only creates a real decision: when do I spend my trump? |
| Session model | Link share, nickname, no auth | *Simple accounts* (more interview surface but delays time-to-playable, the counter-metric); *open lobby/matchmaking* (needs a lobby service; no real user base to match). |
| Disconnects | Instant forfeit (v1) | *Grace period* — assessed as moderate extra effort (reconnect token + timer on top of server-side state), not huge; deferred to first follow-up by the "simplest unless much harder" rule. *Resumable matches* — most DB practice but most effort; deferred. |
| Stat count | 8 (full chart) | *6 per original rules text* — would discard supplied data; rules text updated instead. |

## Research digest — digital Top Trumps comparables (2026-06-10)

- **Tie/pot canon:** the chosen rule (tied cards go to a communal pot, same chooser re-picks from next card, winner takes round cards + pot) matches both the official rule and what open-source clones implement (GitHub "top-trumps" topic). Chooser advantage rotating by round-win (not strict alternation) is also canonical.
- **Game end:** pure "win all cards" can run long or loop indefinitely with random decks; digital versions almost always add a round cap or timer with most-cards-wins. → informed PRD FR25.
- **Core-loop UX patterns** (for `bmad-ux` later): flip top card to chooser → tap a stat row → opponent card flips → winning stat highlighted on both cards → result banner → cards animate to winner's pile with counts updating. Non-chooser sees own card with stats locked plus "opponent is choosing…". Selection timers (10–30s) with auto-pick are common — deferred in v1.
- **Session flow at hobby scale:** host creates room → short shareable code/URL → auto-start at 2 players is the dominant pattern. Rejoin done via client-persisted session ID matched to room on reconnect, with a "disconnected" flag and grace window — the standard template when grace-period reconnect gets built.
- **Trump mechanics elsewhere:** Wizard (cards that always win / always lose, with an explicit tie rule) is the cleanest reference for absolute-override cards. Card battlers more often use one-shot modifiers (boost, peek, force re-pick) than auto-win cards — a future-theme idea if the Super Trump proves swingy.

## Data normalization detail (for the hardcoded deck module)

- Single numeric value per stat; annotations from the source chart dropped: Usopp Fear 15 (not "fake 99"), Jinbe Speed 65 (not in-water 92), Luffy Battle IQ 40, Kizaru Speed 100, Teach DF Mastery 98 (two fruits), Bon Clay Loyalty 100 ("Okama Way").
- "No DF" → Devil Fruit Mastery 0 (Zoro, Nami, Usopp, Sanji, Franky, Jinbe, Shanks, Mihawk, Roger, Garp).
- Marine bounties stay 0 (Garp, Akainu, Kizaru) — a deliberately weak stat on those cards.
- Deceased characters keep listed age (Roger 53, Whitebeard 72, Ace 20); with Age low-wins, this makes Ace's age a strong stat.
- Dragon's "Unknown" bounty → 5,000,000,000 (confirmed by Danilo, 2026-06-10) — thematically "world's worst criminal", slotted just below Roger/Whitebeard.
