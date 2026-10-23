# Uplink plans

Product-requirements docs for Uplink, written before any app code. Each doc is one decision area. Status: `planned` (not started), `draft` (written, not yet reviewed against the set), `done` (reviewed as part of the full set).

| # | Doc | Summary | Status | Updated |
|---|---|---|---|---|
| 01 | [Spaced repetition background](01-spaced-repetition-background.md) | Leitner, SM-2, Anki's variant, HLR, Ebisu, FSRS: how each works, evidence, and FSRS on one page. | draft | 2026-10-22 |
| 02 | [Is FSRS the right tool for Uplink?](02-is-fsrs-right.md) | Yes: FSRS-6 via `ts-fsrs` 5.x, default params, append-only review log as source of truth, no SM-2 phase. | draft | 2026-10-22 |
| 03 | [Genuine learning vs rote memorisation](03-genuine-learning.md) | Transfer needs cards that ask for use, not strings: eight card types, two-button grading, general tool with technical practice first. | draft | 2026-10-22 |
| 04 | [Core use case: practice → feedback → cards](04-practice-to-cards.md) | Notes → named mistakes (learner confirms) → typed cards per mistake → verify by running code → "to review"; plus follow-up sessions. Worked example. | draft | 2026-10-22 |
| 05 | [Card format](05-card-format.md) | One markdown file per card (`---` splits sides), ULID `id` in frontmatter, Anki cloze, `run`/`output` code fences, Mermaid; review state only on device. Eight examples. | draft | 2026-10-22 |
| 06 | [v1 mobile app (React Native)](06-v1-mobile-app.md) | Offline, single-user: GitHub/files/paste/share import, SQLite with insert-only review log, card body in one long-lived web view (spike-gated), Expo vs bare laid out for decision. | draft | 2026-10-22 |
| 07 | [Getting LLM-made cards into the app](07-llm-cards-into-the-app.md) | v1: paste, files, git, and an Agent Skill; stage 3: local stdio MCP; v2: the same tools hosted with OAuth (MCP 2026-07-28). Agents only propose into the to-review inbox. | draft | 2026-10-22 |
| 08 | Website and backend (v2) | Accounts, sync, sharing; typed API, services, Postgres, auth, conflicts. | planned | |
| 09 | Roadmap | Stages, milestones, demos, risks, open decisions. | planned | |

Order follows the dependency chain: scheduler background and choice first, then what the cards should teach, then the format, then the app, then distribution and the roadmap.
