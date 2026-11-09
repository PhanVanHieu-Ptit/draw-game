# Story and dialogue CMS

Open **Content Management** (`/content`) in the existing admin. The Content Editor and Super Admin roles can edit and publish. Other roles retain their existing permissions. No production content is published by installation.

## Model and migration

`shared/story/seed.json` is the deterministic migration of the five chapters, every in-run beat and companion reaction, chapter presentation, intro and both ending slide sequences, memory shards and pledge descriptions. `node scripts/migrate-story.mjs` regenerates it from the unchanged source exports. It does not translate or rewrite content. Existing English translations are retained; absent translations remain pending and fall back to Vietnamese. Scene quotes share localization keys with their chapter review quotes.

A story contains `schemaVersion`, `chapters`, `nodes`, named `entries`, `locales.vi`, `locales.en`, presentation `documents`, and `endings`. Localization keys hold text; graph topology and state transitions are shared across languages. Document text is represented by `{ "key": "..." }` references. IDs are stable across draft revisions and published snapshots.

Nodes contain `id`, `chapter`, `type`, `position: {x,y}`, ordered `edges: [{to,labelKey?}]`, and type-specific fields:

| Type      | Fields / behavior                                                                         |
| --------- | ----------------------------------------------------------------------------------------- |
| Dialogue  | `textKey`, `who`, optional `expression`, `once`                                           |
| Choice    | `textKey`; two or more edges with localized `labelKey`                                    |
| Condition | `condition: {kind,key,equals?}`; edge 0 true, edge 1 false                                |
| Action    | `effect: {kind,key,value?}`                                                               |
| Battle    | `battleId` is the current chapter's existing `levelId`; waits for that battle to complete |
| Reward    | `effect`, same collection mechanism as Action                                             |
| Memory    | `textKey`, `memoryId` references a memory's level as a string                             |
| Ending    | `textKey`, `ending: "normal"                                                              | "true"` |

Predicate/effect kinds are `flag`, `promise`, `memory`, `reward`. Flags compare a primitive value; collections test membership (default `equals: true`). Effects set a flag or collect a unique ID. Rewards represent story collection records, rather than arbitrary currency grants. Expressions are neutral, happy, sad, angry, surprised, afraid, determined. The live dialogue UI shows an expression indicator alongside the character role.

Named entries preserve the game's event triggers: `chapter.<number>.<beat>`, `reaction.<speaker>.<event>.<variant>`, `memory.<number>`, and `ending.<kind>`. Disconnected event roots are intentional; reachability starts from every registered entry. New independent content needs an entry. Missing references, orphan nodes, malformed branches, invalid speakers/expressions, and all cycles block publication. Missing English translations are warnings. The original five chapters, memories, ending documents and ending unlock rules are required.

## Editor and preview

Select a chapter, drag nodes, select a node to inspect its speaker/expression/text key, or connect/disconnect targets. Choice edges expose label keys; Condition edge order is true then false. Use advanced node JSON for effects, predicates, battle and memory references. Use the localization tab to edit text. The documents/entries tab edits chapter presentation, memory/pledge descriptions and event roots. New chapters may be authored as content, but adding playable combat stages also requires the existing gameplay configuration workflow.

Preview starts at any selected node with an isolated state. Set initial flags/collections in the documents tab, select Vietnamese or English, and step through choices and predicates. Battles are explicitly simulated. It uses the same `createSession`/`advance` engine as the runtime and never changes player progress or publishes content. Published snapshots can be previewed and copied to a new draft.

## Persistence and delivery

- `GET /api/content/story`: authenticated draft, revision, immutable published snapshots, validation issues.
- `POST /api/content/story/draft`: `{ revision, story }`; structurally valid drafts may contain graph errors.
- `POST /api/content/story/publish`: `{ revision }`; publishes the saved draft only after validation.
- `GET /api/story-content/published`: public latest published snapshot; 404 until first publish. No drafts are exposed.

Writes use existing serialized atomic JSON storage and audit logging. Revision conflicts return 409. Publishing stores a cloned snapshot and increments the revision; copying an old snapshot back to draft leaves published history intact. The deployment should route the public content URL through the same origin (or provide CORS at its gateway).

Set `VITE_STORY_CONTENT_URL=/api/story-content/published` in the **game's** build environment to opt into published content. Set `VITE_STORY_LOCALE=en` for English dialogue and presentation; Vietnamese is default. Without a configured URL, or when loading fails validation/network checks, the bundled migrated content remains available, including offline exports. Loading occurs before game start. Runtime sessions pin their graph so an installed update cannot change an active traversal.

`StoryScenes` resolves graph beats into the existing `StoryDirector`. Interactive choices pause gameplay, then resume the selected path. Battle nodes wait for the current chapter's level completion. Flags and custom story collections persist through `ProgressStore`; existing earned memory/pledge IDs are available as `"1"` through `"5"`. Custom story promises do not replace the existing five gameplay pledge checks or grant their achievements. The normal ending still requires Story victory; the true ending still requires all five original pledges. Boss Rush, Daily and Endless ending behavior is unchanged. Chapter/ending presentation and the memory journal read the managed localization documents.

The canvas uses React, native pointer events and SVG edges. This is sufficient for the current small event-driven graphs and avoids adding a graph library to the existing React/Ant Design stack.

## Verification

`npm test --prefix admin` covers migration equivalence, validation, branching and collection state, live choice playback, authorization, revision conflicts, invalid publication, immutable releases and audit persistence. `npm run test:ui --prefix admin` covers node inspection, preview traversal, editing, saves and read-only controls. Existing story/lore regression tests remain applicable: `node test-story-lore.js`. Both admin and game build with their existing build scripts.
