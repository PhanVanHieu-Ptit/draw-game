import { writeFile } from "node:fs/promises";
import {
  STORY_CHAPTERS,
  STORY_SLIDES,
  LEVEL_CONFIGS,
} from "../src/core/Constants.js";
import { STORY_SCENES, BARKS } from "../src/core/StoryScenes.js";
import { MEMORY_SHARDS } from "../src/core/Lore.js";
// Deterministic extraction only. No translations are synthesized.
const story = {
  schemaVersion: 1,
  chapters: [],
  nodes: [],
  entries: {},
  documents: {},
  locales: { vi: {}, en: {} },
  endings: { normal: { rule: "storyVictory" }, true: { rule: "allPledges" } },
};
const text = (key, vi, en) => {
  story.locales.vi[key] = vi;
  if (en !== undefined) story.locales.en[key] = en;
  return key;
};
function document(value, path) {
  if (Array.isArray(value))
    return value.map((v, i) => document(v, `${path}.${i}`));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === "enText" || k === "enTitle") continue;
    if (
      typeof v === "string" &&
      ![
        "levelId",
        "illustration",
        "color",
        "icon",
        "bossIcon",
        "letter",
      ].includes(k)
    )
      out[k] = {
        key: text(
          `${path}.${k}`,
          v,
          value[k === "text" ? "enText" : k === "title" ? "enTitle" : "__none"],
        ),
      };
    else out[k] = document(v, `${path}.${k}`);
  }
  return out;
}
story.documents.chapters = document(STORY_CHAPTERS, "chapters");
story.documents.slides = document(STORY_SLIDES, "slides");
story.documents.memories = document(MEMORY_SHARDS, "memories");
function chain(entry, lines, chapter, type = "Dialogue") {
  const ids = lines.map((_, i) => `${entry}.${i}`);
  if (ids.length) story.entries[entry] = ids[0];
  lines.forEach((line, i) =>
    story.nodes.push({
      id: ids[i],
      chapter,
      type,
      textKey: line.quote
        ? `chapters.${chapter - 1}.quotes.${{ storyIntroQuote: "intro", bossSpawnQuote: "boss", bossDefeatQuote: "defeat" }[line.quote]}`
        : text(`${ids[i]}.text`, line.text),
      who: line.who,
      once: !!line.once,
      position: {
        x: i * 250 + 30,
        y: 40 + Object.keys(story.entries).length * 110,
      },
      edges: ids[i + 1] ? [{ to: ids[i + 1] }] : [],
    }),
  );
}
for (const chapter of STORY_CHAPTERS) {
  story.chapters.push({
    id: chapter.chapter,
    titleKey: `chapters.${chapter.chapter - 1}.title`,
  });
  for (const [beat, lines] of Object.entries(STORY_SCENES[chapter.chapter]))
    chain(`chapter.${chapter.chapter}.${beat}`, lines, chapter.chapter);
}
for (const [who, events] of Object.entries(BARKS))
  for (const [event, lines] of Object.entries(events)) {
    lines.forEach((line, i) =>
      chain(`reaction.${who}.${event}.${i}`, [{ who, text: line }], 1),
    );
  }
for (const memory of MEMORY_SHARDS) {
  const id = `memory.${memory.level}`;
  story.entries[id] = id;
  story.nodes.push({
    id,
    chapter: memory.level,
    type: "Memory",
    textKey: `memories.${memory.level - 1}.shard`,
    memoryId: String(memory.level),
    position: { x: 30, y: 1200 },
    edges: [],
  });
}
for (const [kind, group] of [
  ["normal", "VICTORY"],
  ["true", "TRUE_ENDING"],
]) {
  const ids = STORY_SLIDES[group].map((_, i) => `ending.${kind}.${i}`);
  story.entries[`ending.${kind}`] = ids[0];
  story.endings[kind].entry = ids[0];
  ids.forEach((id, i) =>
    story.nodes.push({
      id,
      chapter: 5,
      type: "Ending",
      ending: kind,
      textKey: `slides.${group}.${i}.text`,
      position: { x: 30 + i * 250, y: 1400 },
      edges: ids[i + 1] ? [{ to: ids[i + 1] }] : [],
    }),
  );
}
await writeFile(
  new URL("../shared/story/seed.json", import.meta.url),
  JSON.stringify(story, null, 2) + "\n",
);
