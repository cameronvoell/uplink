# 00 · Start here

Status: done · Updated: 2026-10-28

## Pitch

Uplink is a spaced-repetition app for technical concepts, and any agent can write its cards.
Cards are markdown files in a git repo, with real code highlighting and Mermaid diagrams. FSRS schedules them, and you review on your phone, offline.
Name something you want to learn, your agent writes the cards, and Uplink loads them at the right pace: "I know kung fu."

## Decisions to make

D1, D2, D3 and D5 were decided on 2026-10-28; the Recommendation column records each decision. These block early work. Full list with the milestone each blocks: [doc 09, Open decisions](09-roadmap.md#open-decisions).

| # | Decision | Options | Recommendation | Argued in | Blocks |
|---|---|---|---|---|---|
| D1 | Positioning | A: general learning tool, technical practice first · B: interview-prep tool | **Decided: A.** Technical topics first; the core stays domain-free so language learning fits later. Cards may test understanding or recall. Pitch: "learn anything technical" | [03 §Positioning](03-genuine-learning.md#positioning-general-tool-technical-first) | 1.5, 1.6 |
| D2 | Card ID | ULID · shorter random ID | **Decided: ULID.** Decks will be shared, forked and merged. Writers, agents included, may omit `id`; `uplink check --fix` assigns the final one | [05 §Identity and edits](05-card-format.md#identity-and-edits) | 1.1 |
| D3 | Scheduler | `ts-fsrs` 5.x (MIT) · our own FSRS-6 core, tested against it | **Decided: `ts-fsrs`**, behind our own `Scheduler` interface. `review()` returns state only, and Hard on a new card is whatever `ts-fsrs` gives (6m). The own FSRS-6 core is kept on a separate branch for cross-checks | [02 §Recommendation](02-is-fsrs-right.md#recommendation) | 1.4 |
| D4 | Grade buttons | Two (Again/Good) · four | **Two by default, four as a setting.** FSRS accepts either | [03 §Grading](03-genuine-learning.md#grading-two-buttons-by-default) | 1.4 |
| D5 | Expo or bare React Native | Expo with Continuous Native Generation · bare CLI | **Decided: Expo with CNG**, Android and iOS. Every build must work both locally (Gradle, Xcode) and on EAS. No native module outside Expo is needed | [06 §Expo or bare](06-v1-mobile-app.md#expo-or-bare-react-native) | 2.1 |
| D6 | Card rendering | B: one long-lived web view · C: native text, web view only for diagrams | **B, if the spike's numbers pass.** One renderer serves the app, the website, and MCP previews | [06 §Rendering cards](06-v1-mobile-app.md#rendering-cards) | 2.0 spike |
| D7 | Auth provider (v2) | WorkOS AuthKit · Better Auth | **AuthKit**, so we don't run our own OAuth server | [08 §Accounts and auth](08-website-and-backend.md#accounts-and-auth) | 4.0 |

D1–D3 are made, so stage 1 code can go ahead. D4 can be confirmed during 1.4.

## 20-minute reading path

| Min | Read | Why |
|---|---|---|
| 3 | [09](09-roadmap.md): Summary, The stages (the diagram and stage 1's table), Totals | The shape of the whole plan and what stage 1 builds |
| 3 | [02](02-is-fsrs-right.md): Summary, Recommendation | The scheduler choice and why there is no SM-2 phase |
| 4 | [03](03-genuine-learning.md): Card types, Positioning | What the cards teach; decision D1 |
| 4 | [05](05-card-format.md): A card, Frontmatter, examples 1 and 2 | What a card file looks like |
| 3 | [06](06-v1-mobile-app.md): Rendering recommendation, Expo or bare | Decisions D5 and D6 |
| 3 | [07](07-llm-cards-into-the-app.md): Options, Recommendation | How agent-made cards get into the app |

Skip on a first pass: doc 01, which is background, and doc 08, which is v2 and comes after stage 3.

## Left open on purpose

- **Dates.** Milestones are sized in one-hour sessions, not put on a calendar ([09](09-roadmap.md#non-goals)).
- **Public launch.** Publishing to app stores, hosting the v2 service, and listing in an assistant's directory are each decided by a person when the stage is done.
- **Stage 4 vs stage 5 order.** Sync comes first in the plan. Swap them if the native-migration story matters more ([09 §Open questions](09-roadmap.md#open-questions)).
- **FSRS-7, parameter fitting, LLM grading, audio.** All under "Later". The append-only review log means adding any of them later needs no data migration ([02](02-is-fsrs-right.md#fsrs-7)).
- **Whether local MCP earns its place beside the Agent Skill.** Stage 3's exit check answers this with measurements ([09](09-roadmap.md#stage-3--local-mcp-server-doc-07)).
