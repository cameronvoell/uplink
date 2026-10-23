# 06 · v1 mobile app (React Native)

Status: done · Updated: 2026-10-22

## Summary

A single-user, offline phone app: decks in the doc 05 format arrive from a public GitHub repo, files, paste, or the share sheet; everything lives in on-device SQLite with an insert-only review log; FSRS schedules (doc 02).
Card bodies render in one long-lived web view (option B), so the app, website, and MCP previews share one renderer; a measured spike gates this before the review screen is built.
One decision is left for a person: Expo or bare React Native, both laid out below (lean: Expo).

## Problem

Docs 01–05 settle what a card is, how it is scheduled, and where cards come from. None of that is usable until a learner can open a phone, see what is due, and review it in a few minutes on a train, offline. The app must also make the agent-written workflow feel natural: an agent writes cards into a repo or a chat, and a minute later they are on the phone, waiting in a "to review" pile.

## Goals and non-goals

**Goals**
- Review due cards offline, with good code highlighting and diagrams, at the speed of tapping.
- Import decks a learner generated with their own LLM, with as little ceremony as possible.
- Implement docs 02–05 faithfully: review log, two-button default, mixed order, to-review inbox, item keys.
- Demo well in five minutes (doc 02's demo features).
- Keep the parser and scheduler wrapper in plain TypeScript packages shared with the CLI and, later, the website.

**Non-goals:** accounts, sync, sharing, or any backend (doc 08); an MCP server (doc 07); card authoring beyond small edits to local decks; tablet, web, and desktop builds; app-store release (a person decides when to publish); native rewrites (stage 5, doc 09).

## Users and moments

| Learner | Moment | What the app must do |
|---|---|---|
| Engineer preparing for interviews | Ten minutes on a commute, no signal | Today's due cards, mixed across decks; grade with one thumb |
| The same engineer, after practice | Their agent pushed five cards to their deck repo | Pull; "5 to review from today's session"; keep or delete each |
| Developer using a chat assistant on the phone | It printed cards on Python generators as markdown | Paste, preview, import into a deck |
| Spanish learner | A friend sent a `.md` deck in a chat app | Share the file to Uplink, import |
| Someone being shown the app | Five minutes | Interval labels on buttons, "why is this due?", a seeded deck with history |

## Screens

- **Home.** Three numbers: due now, to review, follow-ups due today (Should, from session summaries, doc 04). One big "Review" button. Decks below.
- **Review session.** Front; tap to reveal; back with the answer, the key-point checklist for key-point types (doc 05), and "why". Grade buttons show each grade's next interval from `preview` (doc 02). Overflow: why is this due (R, S, D), card detail, suspend, "this card is wrong" with a reason (doc 04), open source. Undo for the last grade.
- **To-review inbox.** New items not yet scheduled, grouped by `source` (one practice session's cards together, doc 04) or by import. Per card: keep, delete, edit (local decks) or open on GitHub (repo decks). "Keep all" per group; a per-deck "trust this deck" setting, default off (doc 03).
- **Deck.** Cards filtered by type and tag; sync status and last error; settings (retention, maximum interval, buttons, new cards a day); stats: reviews a day, retention achieved vs target, pass rate per card type (doc 03).
- **Card detail.** Rendered card, frontmatter, `source` and `mistake`, review history, "edited since last review", reset progress (doc 05).
- **Add deck.** The four import paths. **Settings:** day rollover, default buttons.

Editing: decks from files or paste get a plain markdown editor with live validation. For GitHub decks, "Edit" opens the file's edit page on GitHub, because the repo is the source of truth and v1 never pushes. Deleting a card from a GitHub deck hides it locally (status `retired_by_user`, which a later pull does not undo).

## Getting decks in

| Path | How | In Expo Go? | Cost | v1 |
|---|---|---|---|---|
| **GitHub repo** | Paste `owner/repo` (optionally folder and branch); pull on refresh (below) | Yes | ~1 session | Must |
| **Files** | Document picker: `.md` files, or a `.zip` of a deck folder unzipped in JavaScript | Yes | Small | Must |
| **Paste** | Text box; one card or a multi-card file (doc 05's `<!-- card -->`); preview; choose a deck | Yes | Small | Must |
| **Share sheet** | Share a `.md` file or text from another app | No: needs a development build and a config plugin such as `expo-share-intent` | Medium; iOS share extensions are fiddly | Should |

Paste matters more than it looks: an agent in a phone chat can print doc 05 cards, and copy-paste is the shortest path from chat to deck with no integration at all.

### GitHub sync

1. Resolve the branch to a commit SHA (one REST call), then read that commit's tree with `recursive=1` (a second call): paths and blob SHAs.
2. Diff blob SHAs with those stored; fetch only changed `.md` files from the raw file host at that commit.
3. Parse (doc 05), upsert cards, expand items. New keys go to the inbox; missing keys become `retired`.

- **Rate limits.** Unauthenticated REST calls are limited to 60 an hour per IP, so two calls per pull is ample for manual pulls. Raw-host fetches do not count against the REST limit but have their own limits, which GitHub does not publish in the REST docs (unverified).
- **Pinned to one commit**, so a half-pushed batch of cards is never read mixed.
- **Large repos.** A recursive tree response is capped at 100,000 entries or 7 MB and sets `truncated`; then the app walks subtrees one at a time. Deck repos will rarely hit this.
- **Read-only.** If a card has no `id`, the app keeps a path → id map and shows "run the checker" on the deck; `uplink check --fix` (doc 05) assigns IDs in the repo.
- **Private repos:** a fine-grained, read-only personal access token in secure storage (Should); OAuth device flow later.
- **Alternatives considered.** Cloning with `isomorphic-git` over an `fs` shim (`expo-fs`) gives real git semantics, but the shim fakes file modes and throws on symlinks, and it adds weight. Downloading the repo archive is one request but re-downloads everything. Tree-plus-changed-files is the cheapest approach that is incremental.

## Data model

All on-device, in SQLite. The review log is the source of truth for progress (doc 02); everything about content is a cache of the deck source. Columns in the [appendix](#appendix-schema).

| Table | One row per | Notes |
|---|---|---|
| `deck` | Imported deck | Source kind and URI, synced commit, settings |
| `card` | Card file section (doc 05) | ULID `id` from frontmatter, path, type, body, content hash, blob SHA (GitHub) |
| `item` | Reviewable item (`id`, `id#r`, `id#cN`) | Status: `to_review`, `active`, `suspended`, `retired`, `retired_by_user` |
| `review_event` | Grade or undo | Device-made ULID, insert-only |
| `item_state` | Item | Cache of `replay(log)`: due, stability, difficulty, state, reps, lapses |

- **`review_event` is insert-only.** Undo inserts a tombstone event (`undoes` = the cancelled event's id) and recomputes state; replay skips undone events (doc 02). Deleting the row would be simpler on one device but would come back on the next sync (doc 08), so v1 uses the sync-safe form and v2 needs no migration. A test replays the whole log and compares with `item_state`.
- **`scheduler` on each event** (e.g. `fsrs-6@ts-fsrs-5.x`) records which algorithm produced the state, for audits after upgrades.
- **Queue.** Due is the filter, not the order: all active items with `due <= now` across decks, plus up to N new items a day per deck (default 10), shuffled with a seed fixed for the day, so a resumed session keeps its order and decks are never re-sorted into blocks (doc 03). If more are due than a session holds, the most overdue are taken first, then shuffled.
- **Day boundary:** 04:00 local; timestamps in UTC (doc 02).
- **Size (estimate):** 10,000 cards and 100,000 review events come to tens of megabytes, mostly card bodies and ULID-keyed rows. Indexes on `item_state(due)` and `review_event(item_key)` are enough.

### Storage options

| Option | For | Against |
|---|---|---|
| **`expo-sqlite`** | First-party; included in Expo Go; usable in a bare app once `expo` is installed; Drizzle ORM support for typed queries and migrations | Not the fastest binding; SDK 58 removed its libSQL sync, which we did not plan to use |
| `op-sqlite` (JSI) | Fast; good for large batch imports | Development build only; one more native dependency |
| MMKV | Very fast key-value | Not relational; the queue and the log want SQL |
| JSON files | Simplest | No transactions; a crash mid-write corrupts |

Recommendation: `expo-sqlite`, with MMKV or AsyncStorage only for UI preferences. Revisit if importing a large deck is slow.

## Rendering cards

The hard part of v1. A card is markdown with code (Shiki-quality highlighting is the goal), cloze gaps, key-point checklists, and Mermaid diagrams, on a phone about 390 points wide.

| | A · Native markdown | B · One web view for the card body | C · Native text, web view only for diagrams |
|---|---|---|---|
| How | Native renderer (e.g. `react-native-markdown-display`) with custom rules; code via `react-native-shiki-engine` or `prism-react-renderer` | A React web component (`react-markdown`, Shiki's JavaScript engine, Mermaid) in a web view: an Expo DOM component (`'use dom'`) or `react-native-webview` | A, plus a web view per `mermaid` block |
| Fidelity | Good; every markdown feature is a custom rule | Highest: the same renderer as web markdown | Mixed |
| Code | Shiki via a native Oniguruma module (needs the New Architecture), or Prism tokens in `Text` spans | Shiki on the web side, no native module | As A |
| Mermaid | Needs a web view anyway (Mermaid needs a DOM) | Same web view | Web view per diagram |
| Speed | Fastest; native text and scrolling | Kept alive across cards; first paint after app start is slower (DOM components run plain JavaScript, slower to start than Hermes bytecode); later cards are a prop update | Fast except diagrams |
| Accessibility | Native Dynamic Type and selection | Web equivalents; following the system font size needs explicit work | Native except diagrams |
| Reuse | Mobile only | Website (doc 08), CLI preview, MCP Apps preview (doc 07), a later native app's web view | Partial |
| Risk | Many custom rules; two renderers once the website exists | Web view memory, gesture conflicts, height measuring (`matchContents`) | Both, smaller |

Unverified for option A: Hermes now supports the regex `d` flag and `\p{…}` (React Native 0.74.6+/0.75.1+), so Shiki's JavaScript engine may run without the native module. Not tested; the spike can check it if B fails.

### Recommendation: B, gated by a spike

Render the card body in **one long-lived web view** that receives the next card as a prop, so web-view start-up is paid once per session, not per card. Grade buttons, navigation, and the rest of the UI stay native. Reasons: Mermaid forces a web view regardless; Shiki runs on the web side with no native module; and one renderer, `packages/card-render`, serves the app, the website, the MCP Apps preview, and a later native app.

The spike (one session, before the review screen): render 50 real cards (long Java, a Mermaid sequence diagram, a cloze in code) on a mid-range Android phone and an iPhone; measure first paint after cold start, card-to-card time, memory, and scrolling. Pass: card-to-card under 100 ms, first card under 1 s after the app opens, no jank scrolling a 15-line code block. If B fails, fall back to C.

### Details for any option

- **Code:** monospace, ligatures off; horizontal scroll, never wrap (doc 05); line numbers off by default; light and dark themes following the system.
- **Cloze:** a box the width of the hint, or of the answer when there is no hint (doc 05), revealed in place.
- **Key points:** the checklist is tappable; every point ticked suggests Good, any missing suggests Again (doc 03). The learner still chooses.
- **Mermaid:** loaded only when a card has a diagram (it is a large bundle); the SVG is cached in SQLite by content hash, so later reviews skip layout. v1 renders doc 05's four diagram types.
- **Offline:** every renderer asset is bundled in the app. No CDN.

## Expo or bare React Native

Both are viable for v1. **Decision needed** (D5 in [doc 00](00-start-here.md#decisions-to-make)). The React Native docs recommend starting new apps with a framework and name Expo; bare React Native is still supported.

| | Expo (Continuous Native Generation) | Bare React Native (Community CLI) |
|---|---|---|
| Native projects | Generated by `expo prebuild` from `app.json` and config plugins; `android/` and `ios/` gitignored by default | Checked in, maintained by hand |
| Upgrades | Bump versions, regenerate; Expo calls this "much closer to upgrading a pure JavaScript application" | Native files by hand with the upgrade helper; a common pain point |
| v1 libraries | SQLite, file system, document picker, secure store, DOM components: all first-party | The same Expo modules install into bare apps, with extra setup |
| Native code when needed | Config plugins or local Expo modules; hand edits to generated files are lost on `prebuild --clean` | Edit any file directly |
| Builds | EAS Build (hosted) or local builds | Local Gradle and Xcode, or any CI |
| Device demos | Expo Go for features without custom native code; development builds otherwise | Debug build on a device |
| What it shows | Modern, pragmatic React Native practice | Comfort with Gradle, Xcode, and native modules; a direct path to a later Kotlin or Swift rewrite |
| Versions (2026-10-22) | SDK 58 (15 October; React Native 0.88). Expo Go for SDK 58 is due "within a few weeks", so `create-expo-app` still makes SDK 57 projects | React Native 0.88; check the latest patch at project start |

- Not a lock-in: `prebuild` output can be checked in at any time, turning the app into a bare app with Expo modules.
- The share sheet, the Shiki native engine (option A), and `op-sqlite` need a development build; Expo Go alone will not cover v1's Should list. A new SDK 58 project needs one until Expo Go for 58 ships.
- A later native rewrite reads the same SQLite schema and deck format either way; the choice affects build and upgrade cost, not the migration.
- **Lean: Expo**, because upgrades are cheaper and it can become a bare app later. The argument for bare is visible native build work.

## Project layout

```text
uplink/
├── packages/
│   ├── format/        doc 05 parser, schema, item expansion (app, CLI, web)
│   ├── scheduler/     the Scheduler interface over ts-fsrs (doc 02)
│   ├── card-render/   the web card renderer (option B; website, MCP Apps)
│   └── mcp-tools/     MCP tool handlers over DeckStore (stage 3, doc 07)
├── apps/
│   ├── mobile/        the React Native app
│   ├── cli/           uplink check (doc 05)
│   └── mcp/           @uplink/mcp stdio server (stage 3, doc 07)
└── decks/demo/        the seeded demo deck
```

## Testing

- `packages/format` and `packages/scheduler`: unit tests in Node, plus doc 02's golden vectors run on a device under Hermes.
- Replay: random review sequences, including undos; `replay(log)` equals `item_state`.
- Import: a fixture deck repo with edits, renames, duplicate IDs, and deleted cards, checked against doc 05's identity table.
- End-to-end: import a GitHub deck, review five cards, triage the inbox, on a simulator with a mobile UI test runner such as Maestro.

## Requirements

**Must**
- Import from a public GitHub repo, files (`.md`, `.zip`), and paste; validate with `packages/format`, errors per file.
- SQLite storage as above; insert-only review log with tombstone undo; replay test.
- Review screen: reveal, key-point checklist, Again/Good default, four buttons as a setting, interval labels, undo.
- Mixed due queue across decks, new-cards-a-day limit, 04:00 rollover.
- To-review inbox grouped by `source`; keep, delete, edit (local) or open on GitHub.
- Highlighting for Java, Python, and TypeScript; cloze in prose and code; doc 05's four Mermaid types; all offline.
- Deck settings; "why is this due?"; a seeded demo deck with history.
- The rendering spike, run and written up before the review screen.

**Should:** share-sheet import; private repos with a read-only token; stats; "this card is wrong", "edited since last review", reset progress; follow-ups on Home; a daily reminder notification.

**Later:** writing back to repos through the GitHub API; OAuth device flow; tablet layout and web build; audio.

## Open questions

- **Expo or bare React Native.** Decision needed (above).
- Rendering B or C: decided by the spike's numbers, not taste.
- Should the inbox block a deck's new cards until triaged? Proposal: no; "keep all" is one tap and the inbox count shows on Home.
- New cards a day: 10 is Anki-like, but agent-written cards arrive in bursts of 5–30. Proposal: cards with a `source` from the last 48 hours bypass the limit.
- GitHub sync errors without nagging: a badge on the deck, details on its screen.

## Sources

Re-checked 2026-10-22 unless noted.

- Expo changelog, SDK 58 (15 October 2026; React Native 0.88; Expo Go "within a few weeks"; libSQL removed from `expo-sqlite`). https://expo.dev/changelog/sdk-58.md
- Expo docs, DOM components (`@expo/dom-webview` from SDK 56, serializable props, `matchContents`, slower start than Hermes bytecode, Expo Go). https://docs.expo.dev/guides/dom-components/
- Expo docs, Continuous Native Generation. https://docs.expo.dev/workflow/continuous-native-generation/
- Expo docs, `expo-sqlite` (Expo Go, Drizzle, bare apps). https://docs.expo.dev/versions/latest/sdk/sqlite/
- React Native blog, "Use a framework to build React Native apps" (2024; not re-checked). https://reactnative.dev/blog/2024/06/25/use-a-framework-to-build-react-native-apps
- `react-native-shiki-engine` 0.4.0 (MIT; requires the New Architecture). https://github.com/skiniks/react-native-shiki-engine
- Bluesky social-app issue 5895: Shiki on React Native, Hermes `d` flag and `\p{…}`, the native engine. https://github.com/bluesky-social/social-app/issues/5895
- `prism-react-renderer` (not re-checked). https://github.com/FormidableLabs/prism-react-renderer
- `react-native-markdown-display` (not re-checked). https://github.com/RonRadtke/react-native-markdown-display
- `expo-share-intent` (needs a development build; SDK 58 from v9). https://github.com/achorein/expo-share-intent
- `expo-fs` (file modes faked, symlinks throw; via search summary of the npm page). https://www.npmjs.com/package/expo-fs
- GitHub REST API: Git trees (100,000 entries / 7 MB, `truncated`) and rate limits (60 an hour unauthenticated). https://docs.github.com/en/rest/git/trees ; https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api

## Appendix: schema

Not executed; column types are SQLite affinities.

```text
deck          id TEXT PK · name · source_kind (github|files|paste) · source_uri
              · synced_commit · settings JSON (retention, max interval,
              buttons, new per day)
card          id TEXT PK (ULID from frontmatter) · deck_id FK · path · type
              · frontmatter JSON · body_md · content_hash · blob_sha (github)
item          key TEXT PK (id | id#r | id#cN) · card_id FK · status
              · seen_content_hash
review_event  id TEXT PK (ULID made on device) · item_key FK · reviewed_at
              (UTC) · grade INTEGER · duration_ms INTEGER · scheduler
              · undoes (event id or NULL)
item_state    item_key PK · due · stability REAL · difficulty REAL
              · state INTEGER · reps INTEGER · lapses INTEGER
```
