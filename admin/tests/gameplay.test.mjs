import test from "node:test";
import assert from "node:assert/strict";
import {
  contentDefaults,
  contentSchema,
  createContentValue,
  validateContent,
  contentTimeline,
} from "../../shared/gameplay-content.js";
import { configurationRoute } from "../server/configuration.mjs";
function fixture() {
  const v = structuredClone(contentDefaults);
  const enemy = createContentValue(contentSchema.fields.enemies.item);
  enemy.id = "ghost";
  v.enemies.push(enemy);
  const wave = createContentValue(contentSchema.fields.waves.item);
  const group = createContentValue(
    contentSchema.fields.waves.item.fields.groups.item,
  );
  group.enemyId = "ghost";
  wave.groups.push(group);
  v.waves.push(wave);
  return v;
}
test("strict content validation, references, phases, timeline conflicts and deterministic schedule", () => {
  const v = fixture();
  assert.deepEqual(validateContent(v), []);
  assert.deepEqual(
    contentTimeline(v).map((e) => e.time),
    [0, 1, 2],
  );
  v.enemies[0].health = NaN;
  assert.match(validateContent(v).join(), /health/);
  v.enemies[0].health = 1;
  v.waves[0].groups[0].enemyId = "missing";
  assert.match(validateContent(v).join(), /reference/);
  v.waves[0].groups[0].enemyId = "ghost";
  v.waves.push(structuredClone(v.waves[0]));
  assert.match(validateContent(v).join(), /duplicate ID/);
  assert.match(validateContent(v).join(), /overlaps/);
  assert.doesNotThrow(() =>
    validateContent({
      enemies: {},
      bosses: [],
      waves: [{ groups: [{ enemyId: "x" }] }],
    }),
  );
  const b = createContentValue(contentSchema.fields.bosses.item);
  v.bosses.push(b);
  assert.match(validateContent(v).join(), /first phase/);
});
test("content uses isolated revisioned lifecycle and delivers only published values", async () => {
  let store = { audit: [] };
  let response;
  const current = { email: "designer@example.test" };
  const route = async (action, input = {}, publicRead = false) => {
    response = undefined;
    await configurationRoute({
      content: true,
      path: publicRead
        ? "/api/game-content/development"
        : `/api/gameplay/environments/development${action ? "/" + action : ""}`,
      method: action ? "POST" : "GET",
      body: async () => input,
      send: (status, value) => {
        response = { status, value };
      },
      store: () => store,
      mutate: async (fn) => fn(store),
      current: publicRead ? null : current,
      now: () => 0,
      permits: () => true,
    });
    return response.value;
  };
  await assert.rejects(() => route("", {}, true), /No published/);
  let state = await route("save", { revision: 0, values: fixture() });
  assert.equal(state.draft.status, "draft");
  await assert.rejects(
    () => route("save", { revision: 0, values: fixture() }),
    /changed/,
  );
  await assert.rejects(
    () => route("publish", { revision: 1 }),
    /Expected reviewed/,
  );
  state = await route("validate", { revision: 1 });
  state = await route("review", { revision: 2 });
  state = await route("publish", { revision: 3 });
  assert.equal(state.revision, 4);
  assert.equal(store.environments, undefined);
  assert.equal((await route("", {}, true)).values.enemies[0].id, "ghost");
  state = await route("rollback", {
    revision: 4,
    versionId: state.versions[0].id,
  });
  assert.equal(state.versions.length, 2);
  assert.equal(store.audit.at(-1).action, "gameplay.rollback");
});
