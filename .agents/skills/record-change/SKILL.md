---
name: record-change
description: >-
  Records engineering and architectural changes with detailed 'what' and 'why' rationales into
  CHANGES.md. Use when completing a task, modifying the codebase, adding architectural features,
  or when asked to update the changelog.
---

# Record Change Skill

Documents code, schema and architectural changes in `CHANGES.md` at the repository
root, initialising the file if it does not exist.

## When this is worth doing

`git log` already records what changed. An entry here earns its place only when
the **why** runs deeper than a commit message carries: a trade-off taken, a
constraint discovered, an approach rejected and the reason. Skip routine changes
whose rationale is obvious from the diff.

card-clash already has homes for most "why". Check them first, and do not
duplicate:

| Kind of change                | Its "why" already lives in                                                      |
| ----------------------------- | ------------------------------------------------------------------------------- |
| Work done as a story          | The story file's _Completion Notes_ in `_bmad-output/implementation-artifacts/` |
| A product or stack decision   | `.decision-log.md` (numbered `D1`…) next to the PRD                             |
| A change to a binding pattern | `_bmad-output/planning-artifacts/architecture.md` (amended first)               |
| Debt found or paid off        | `_bmad-output/implementation-artifacts/deferred-work.md`                        |

Use `CHANGES.md` for changes outside those flows — quick fixes, tooling,
dependency upgrades — or to link them together. Point to the story or decision
by name instead of repeating it.

## Principles

- **Deep rationale.** Do not restate the diff. Explain the motivation, the
  problem solved, the trade-offs, and anything surprising that was learned.
- **Technical precision.** Concrete signatures, before/after snippets, types,
  error codes.
- **Traceability.** Exact file paths with their modification status.
- **Plain English.** Short sentences, one idea each. Define new terms.
- **card-clash invariants.** Where relevant, state the impact on:
  - **Engine purity** — `packages/engine` still imports only `zod`; randomness
    only through the injected `Rng`; rule violations return a result, never throw.
  - **Hidden information** — every byte a client receives still goes through
    `projectFor`; no opponent cards, deck order or Super Trump location leak.
  - **Protocol** — socket event names (`domain:action`), the
    `{ error: { code, message } }` shape, and whether server and client still
    compile against the shared types in `engine/src/protocol/`.
  - **Match lifecycle** — the in-memory store, forfeit timing (~10s), rematch,
    and eviction. Exactly one server instance, because live matches are in memory.
  - **Persistence** — migrations, SQL kept in `matchRepository.ts`, and that a
    DB failure still never crashes the server or blocks gameplay.
  - **Deployment** — env vars in `config.ts`, `.env.example`, deploy secrets,
    the Docker image, and the CI and deploy workflows.

---

## Procedure

1. **Inspect or initialise the changelog.**
   - If `CHANGES.md` exists, read recent entries for numbering and section style.
   - If absent, create it with:

     ```markdown
     # Changelog

     Notable architectural, domain and engineering changes to card-clash.
     ```

2. **Place the entry.** Append to the current feature section, or open a new one
   (`## [YYYY-MM-DD] - <Title>`) and number from 1.

3. **Write the entry.**

   ````markdown
   ## <N>. <Brief Title>

   ### What Changed

   - Concrete bullets covering code, configuration and test modifications.
   - Include snippets where a signature or type is the point:
     ```ts
     export function applyCommand(
       state: MatchState,
       command: Command,
     ): CommandResult;
     ```

   ### Rationale

   - **Why this design:** How it fits the package boundaries and the patterns in
     `architecture.md`. Cite decisions by number (e.g. D25) and stories by id.
   - **Trade-offs:** What was given up, and what was rejected.
   - **Risk:** Hidden-information, protocol, match-lifecycle or deployment impact.

   ### Affected Files

   - `path/to/file.ts` (created | modified | deleted)
   - `path/to/file.test.ts` (created | modified | deleted)
   ````

4. **Review.** Check the markdown renders, paths are correct, and nothing is
   padding.
