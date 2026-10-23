# Uplink plans

**New here? Read [00 · Start here](00-start-here.md) first:** the pitch, the decisions to make, and a 20-minute reading path.

Product-requirements docs for Uplink, written before any app code. Each doc is one decision area. Status: `planned` (not started), `draft` (written, not yet reviewed against the set), `done` (reviewed as part of the full set). Review: `reviewed` means a fresh-eyes pass is done (claims re-checked against sources, snippets traced by hand, length tightened); `pending` means that pass has not happened yet.

| # | Doc | Summary | Status | Review | Updated |
|---|---|---|---|---|---|
| 00 | [Start here](00-start-here.md) | Pitch, the seven decisions with recommendations, a 20-minute reading path, and what is left open on purpose. | done | reviewed | 2026-10-22 |
| 01 | [Spaced repetition background](01-spaced-repetition-background.md) | Leitner, SM-2, Anki's variant, HLR, Ebisu, FSRS: how each works, evidence, and FSRS on one page. | done | reviewed | 2026-10-22 |
| 02 | [Is FSRS the right tool for Uplink?](02-is-fsrs-right.md) | Yes: FSRS-6 via `ts-fsrs` 5.x, default params, append-only review log as source of truth, no SM-2 phase. | done | reviewed | 2026-10-22 |
| 03 | [Genuine learning vs rote memorisation](03-genuine-learning.md) | Transfer needs cards that ask for use, not strings: eight card types, two-button grading, general tool with technical practice first. | done | reviewed | 2026-10-22 |
| 04 | [Core use case: practice → feedback → cards](04-practice-to-cards.md) | Notes → named mistakes (learner confirms) → typed cards per mistake → verify by running code → "to review"; plus follow-up sessions. Worked example. | done | reviewed | 2026-10-22 |
| 05 | [Card format](05-card-format.md) | One markdown file per card (`---` splits sides), ULID `id` in frontmatter, Anki cloze, `run`/`output` code fences, Mermaid; review state only on device. Eight examples (appendix). | done | reviewed | 2026-10-22 |
| 06 | [v1 mobile app (React Native)](06-v1-mobile-app.md) | Offline, single-user: GitHub/files/paste/share import, SQLite with insert-only review log, card body in one long-lived web view (spike-gated), Expo vs bare laid out (lean: Expo). | done | reviewed | 2026-10-22 |
| 07 | [Getting LLM-made cards into the app](07-llm-cards-into-the-app.md) | v1: paste, files, git, and an Agent Skill; stage 3: local stdio MCP; v2: the same tools hosted with OAuth (MCP 2026-07-28). Agents only propose into the to-review inbox. | done | pending | 2026-10-22 |
| 08 | [Website and backend (v2)](08-website-and-backend.md) | One TypeScript service sharing the app's packages, REST + OpenAPI (argued over GraphQL), Postgres, custom sync (union-merged review log, LWW fields), AuthKit vs Better Auth, publish/follow/fork. | done | pending | 2026-10-22 |
| 09 | [Roadmap](09-roadmap.md) | Five stages, ~78 one-hour sessions; stages 1–3 (~37) need no server. Spike first per stage, a demo to finish each, risks, and seven open decisions with the milestone each blocks. | done | pending | 2026-10-22 |

Order follows the dependency chain: scheduler background and choice first, then what the cards should teach, then the format, then the app, then distribution and the roadmap.

**Set review (2026-10-22).** All nine reviewed together and marked `done`. Fixes: undo is a tombstone event from v1 (docs 02, 06, 08), so the review log merges without migration; review events carry device-made ULIDs (02, 06); doc 04's generating tools became the `cards_from_notes` MCP prompt and its "where it runs" stages match doc 07; the examples in docs 03 and 04 follow doc 05's format; the grading default is settled in doc 03 and referenced from 01 and 02; the renderer's MCP Apps reuse and the stage 3 packages are in doc 06. Open decisions are collected in [doc 09](09-roadmap.md#open-decisions).
