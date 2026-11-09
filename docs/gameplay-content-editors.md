# Gameplay content studio

Open Gameplay Management in Admin. Enemies, bosses and waves have schema-driven visual controls, including nested phase abilities, cooldowns, gesture rules, summons and spawn groups. Wave start and duration use seconds; group offsets are relative to their wave. Click a timeline block to seek, use the slider to scrub, or play the spawn schedule. The appearance preview calls the existing `Enemy` renderer. It does not simulate combat or execute custom phases, warnings, audio or external visual references.

Working edits have a bounded 50-step undo/redo history. Save draft persists the entire content document on the server. Unsaved edits trigger navigation/page-close warnings. JSON export includes schemaVersion and values; import validates the complete document before replacing working values. Imported documents must use schema version 1. Duplicate records get new IDs; references are preserved, and deleting referenced enemies or bosses produces validation errors.

Content uses the existing configuration permissions and lifecycle: Save draft → Validate → Mark reviewed → Publish. Publication and rollback require confirmation. Revision conflicts preserve working edits. Environments, revisions and history are isolated from game settings; content mutations share the existing atomic storage and audit transaction. The same single-server deployment limits described in configuration-management.md apply.

## Endpoints

- GET `/api/gameplay/environments/:environment`
- POST `/api/gameplay/environments/:environment/save` with revision and values
- POST `/api/gameplay/environments/:environment/{validate,review,publish}` with revision
- POST `/api/gameplay/environments/:environment/rollback` with revision and versionId
- GET `/api/game-content/:environment` returns only the latest published envelope

The shared schema, validation and spawn schedule live in `shared/gameplay-content.js`; TypeScript models live in `shared/gameplay-content.types.ts`. Rune and archetype options come from the existing game constants. Validation covers strict field types and bounds, missing references, duplicate IDs, phase threshold ordering, empty encounters, overlapping waves, groups extending past wave duration and a 10000-event document budget.

## Runtime integration boundary

Publishing creates an immutable content release. The existing game boot loader consumes game settings only; it does **not** yet consume gameplay content releases. A game-side adapter is still required to map authored health, damage, abilities, phases, status effects and wave schedules into the existing combat and wave systems. No combat implementation is duplicated in Admin. Asset references are stored metadata and are not loaded by the preview.

Run `npm --prefix admin test`, `npm --prefix admin run test:ui`, and `npm --prefix admin run build` to verify the editors and lifecycle.
