import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import seed from "../../shared/story/seed.json" with { type: "json" };
import {
  validateStory,
  resolveDocument,
  localize,
  createSession,
  advance,
} from "../../shared/story/engine.js";
import {
  getStory,
  installStory,
  storyLines,
  loadPublishedStory,
} from "../../shared/story/runtime.js";
import {
  STORY_CHAPTERS,
  STORY_SLIDES,
  LEVEL_CONFIGS,
} from "../../src/core/Constants.js";
import { STORY_SCENES, BARKS, buildScene } from "../../src/core/StoryScenes.js";
import { MEMORY_SHARDS } from "../../src/core/Lore.js";
import { StoryDirector } from "../../src/core/StoryDirector.js";
import { createAdminServer } from "../server/app.mjs";
const clone = () => structuredClone(seed);
function preserves(original, copy) {
  if (Array.isArray(original)) {
    assert.equal(original.length, copy.length);
    original.forEach((v, i) => preserves(v, copy[i]));
  } else if (original && typeof original === "object")
    for (const [k, v] of Object.entries(original)) preserves(v, copy[k]);
  else assert.equal(copy, original);
}
test("migration preserves all source content, ordering, English translations, scene replay and reactions", () => {
  assert.deepEqual(
    validateStory(seed).filter((i) => i.severity === "error"),
    [],
  );
  preserves(STORY_CHAPTERS, resolveDocument(seed, seed.documents.chapters));
  preserves(STORY_SLIDES, resolveDocument(seed, seed.documents.slides));
  preserves(MEMORY_SHARDS, resolveDocument(seed, seed.documents.memories));
  for (const [level, beats] of Object.entries(STORY_SCENES))
    for (const [beat, lines] of Object.entries(beats))
      for (const replay of [false, true])
        assert.deepEqual(
          storyLines(`chapter.${level}.${beat}`, { replay }).map((l) => l.text),
          lines
            .filter((l) => !replay || !l.once)
            .map((l) =>
              l.quote ? LEVEL_CONFIGS[Number(level) - 1][l.quote] : l.text,
            ),
        );
  for (const [who, events] of Object.entries(BARKS))
    for (const [event, lines] of Object.entries(events))
      lines.forEach((text, i) =>
        assert.equal(storyLines(`reaction.${who}.${event}.${i}`)[0].text, text),
      );
  assert.equal(
    localize(seed, "chapter.1.intro.1.text", "en"),
    seed.locales.vi["chapter.1.intro.1.text"],
  );
});
test("validation detects missing targets, unreachable nodes, cycles, malformed branches, expressions and ending rules", () => {
  const s = clone();
  s.nodes[0].edges = [{ to: "missing" }];
  s.nodes[1].edges = [{ to: s.nodes[1].id }];
  s.nodes[2].expression = "bogus";
  s.nodes[2].textKey = "missing";
  s.endings.true.rule = "always";
  const codes = new Set(validateStory(s).map((i) => i.code));
  for (const code of [
    "reference",
    "unreachable",
    "cycle",
    "expression",
    "localization",
    "ending",
  ])
    assert(codes.has(code), code);
  assert.equal(installStory(s), false);
  assert.equal(validateStory(null)[0].code, "schema");
  const invalid = clone();
  invalid.nodes.push(null);
  assert(validateStory(invalid).some((i) => i.code === "node"));
});
function branchStory() {
  const s = clone(),
    position = { x: 0, y: 0 };
  s.entries.test = "test.choice";
  s.locales.vi.yes = "Yes";
  s.locales.vi.no = "No";
  s.nodes.push(
    {
      id: "test.choice",
      chapter: 1,
      type: "Choice",
      textKey: "yes",
      position,
      edges: [
        { to: "test.action", labelKey: "yes" },
        { to: "test.end", labelKey: "no" },
      ],
    },
    {
      id: "test.action",
      chapter: 1,
      type: "Action",
      effect: { kind: "promise", key: "test" },
      position,
      edges: [{ to: "test.condition" }],
    },
    {
      id: "test.condition",
      chapter: 1,
      type: "Condition",
      condition: { kind: "promise", key: "test" },
      position,
      edges: [{ to: "test.memory" }, { to: "test.end" }],
    },
    {
      id: "test.memory",
      chapter: 1,
      type: "Memory",
      memoryId: "1",
      textKey: "yes",
      position,
      edges: [{ to: "test.reward" }],
    },
    {
      id: "test.reward",
      chapter: 1,
      type: "Reward",
      effect: { kind: "reward", key: "gift" },
      position,
      edges: [{ to: "test.end" }],
    },
    {
      id: "test.end",
      chapter: 1,
      type: "Dialogue",
      textKey: "no",
      position,
      edges: [],
    },
  );
  return s;
}
test("preview branches, predicates, promises, memories, rewards and isolated state use the same engine", () => {
  const s = branchStory();
  assert.deepEqual(
    validateStory(s).filter((i) => i.severity === "error"),
    [],
  );
  let p = createSession(s, "test.choice");
  const initial = structuredClone(p);
  for (let i = 0; i < 6; i++) p = advance(s, p);
  assert(p.done);
  assert.deepEqual(p.state.promises, ["test"]);
  assert.deepEqual(p.state.memories, ["1"]);
  assert.deepEqual(p.state.rewards, ["gift"]);
  assert.deepEqual(initial.state.promises, []);
  let other = advance(s, initial, 1);
  assert.equal(other.nodeId, "test.end");
  other = advance(s, other);
  assert(other.done);
  assert.deepEqual(other.state.promises, []);
  assert.throws(() => advance(s, initial, 9), /branch/);
});
test("interactive game dialogue pauses at a choice and resumes the selected path", () => {
  const s = branchStory();
  s.entries["original.intro"] = s.entries["chapter.1.intro"];
  s.entries["chapter.1.intro"] = "test.choice";
  assert(installStory(s));
  try {
    const state = {},
      lines = buildScene(1, "intro", { interactive: true, state });
    let current;
    const director = new StoryDirector((line) => {
      current = line;
    });
    director.play(lines);
    assert.equal(current.choices.length, 2);
    director.update(999);
    assert.equal(current.choices.length, 2);
    director.resumeGraph(current.choices[0].resume());
    assert.equal(current.text, "Yes");
    assert.deepEqual(state.promises, ["test"]);
  } finally {
    installStory(seed);
  }
});
test("published loader rejects drafts and invalid releases, retaining last good content", async () => {
  const before = getStory();
  assert.equal(
    await loadPublishedStory("test", async () => ({
      ok: true,
      json: async () => ({ status: "draft", story: seed }),
    })),
    false,
  );
  assert.equal(
    await loadPublishedStory("test", async () => {
      throw Error("offline");
    }),
    false,
  );
  assert.deepEqual(getStory(), before);
});
async function fixture(t, role = "Content Editor") {
  const dataDir = await mkdtemp(join(tmpdir(), "story-cms-"));
  const credentials = {
    email: "editor@example.com",
    password: "story-editor-password-long",
  };
  const server = createAdminServer({ ...credentials, dataDir, role });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "x-admin-request": "1" },
    body: JSON.stringify(credentials),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  return {
    call: (path, body, auth = true) =>
      fetch(base + path, {
        method: body ? "POST" : "GET",
        headers: { "x-admin-request": "1", ...(auth ? { cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    dataDir,
  };
}
test("API persists drafts, rejects conflicts/invalid publish, publishes immutable releases and audits", async (t) => {
  const { call, dataDir } = await fixture(t);
  assert.equal((await call("/api/content/story", null, false)).status, 401);
  assert.equal(
    (await call("/api/story-content/published", null, false)).status,
    404,
  );
  const initial = await (await call("/api/content/story")).json();
  assert.equal(initial.draft.chapters.length, 5);
  let s = clone();
  s.nodes[0].edges = [{ to: "missing" }];
  assert.equal(
    (await call("/api/content/story/draft", { revision: 0, story: s })).status,
    200,
  );
  assert.equal(
    (await call("/api/content/story/publish", { revision: 1 })).status,
    422,
  );
  assert.equal(
    (await call("/api/content/story/draft", { revision: 0, story: seed }))
      .status,
    409,
  );
  assert.equal(
    (await call("/api/content/story/draft", { revision: 1, story: seed }))
      .status,
    200,
  );
  assert.equal(
    (await call("/api/content/story/publish", { revision: 2 })).status,
    200,
  );
  const release = await (
    await call("/api/story-content/published", null, false)
  ).json();
  assert.equal(release.status, "published");
  assert.deepEqual(release.story, seed);
  s = clone();
  s.locales.vi["chapters.0.title"] = "Edited title";
  assert.equal(
    (await call("/api/content/story/draft", { revision: 3, story: s })).status,
    200,
  );
  assert.deepEqual(
    (await (await call("/api/story-content/published", null, false)).json())
      .story,
    seed,
  );
  const { readFile } = await import("node:fs/promises");
  const saved = JSON.parse(await readFile(join(dataDir, "store.json"), "utf8"));
  assert.equal(saved.story.revision, 4);
  assert(saved.audit.some((a) => a.action === "story.publish"));
});
test("API denies story writes and reads to unsupported roles", async (t) => {
  const { call } = await fixture(t, "Analyst");
  assert.equal((await call("/api/content/story")).status, 403);
  assert.equal(
    (await call("/api/content/story/draft", { revision: 0, story: seed }))
      .status,
    403,
  );
});

test("custom graph collections survive progress reload without changing original pledge unlocks", async () => {
  const { ProgressStore } = await import("../../src/core/ProgressStore.js");
  const storage = {
    values: new Map(),
    getItem(k) {
      return this.values.get(k) || null;
    },
    setItem(k, v) {
      this.values.set(k, v);
    },
  };
  const p = new ProgressStore(storage);
  p.data.storyState = {
    flags: { met: true },
    promises: ["custom-promise"],
    memories: ["1"],
    rewards: ["gift"],
  };
  p.save();
  const restored = new ProgressStore(storage);
  assert.deepEqual(restored.data.storyState, p.data.storyState);
  assert.equal(restored.pledgeCount(), 0);
  assert.equal(restored.hasShard(1), false);
});
