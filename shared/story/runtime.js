import seed from "./seed.json" with { type: "json" };
import {
  validateStory,
  localize,
  resolveDocument,
  createSession,
  advance,
} from "./engine.js";
let active = structuredClone(seed);
let currentLocale = "vi";
export function setStoryLocale(locale) {
  if (!["vi", "en"].includes(locale)) return false;
  currentLocale = locale;
  return installStory(active);
}
export const storyContent = {
  chapters: resolveDocument(active, active.documents.chapters),
  slides: resolveDocument(active, active.documents.slides),
  memories: resolveDocument(active, active.documents.memories),
};
export function getStory() {
  return structuredClone(active);
}
export function installStory(story) {
  if (validateStory(story).some((i) => i.severity === "error")) return false;
  active = structuredClone(story);
  storyContent.chapters.splice(
    0,
    storyContent.chapters.length,
    ...resolveDocument(active, active.documents.chapters, currentLocale),
  );
  storyContent.memories.splice(
    0,
    storyContent.memories.length,
    ...resolveDocument(active, active.documents.memories, currentLocale),
  );
  Object.assign(
    storyContent.slides,
    resolveDocument(active, active.documents.slides, currentLocale),
  );
  return true;
}
export async function loadPublishedStory(url, fetcher = globalThis.fetch) {
  if (!url) return false;
  try {
    const response = await fetcher(url, {
      credentials: "omit",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return false;
    const release = await response.json();
    return release.status === "published" && installStory(release.story);
  } catch {
    return false;
  }
}
export function storyLines(entry, options = {}) {
  const {
    locale = currentLocale,
    replay = false,
    state = {},
    choose,
    battle,
    interactive = false,
    onState,
  } = options;
  const id = active.entries[entry];
  if (!id) return [];
  const pinned = active;
  function walk(session) {
    const lines = [];
    while (!session.done) {
      const node = pinned.nodes.find((n) => n.id === session.nodeId);
      const line = {
        who: node.who || "momo",
        text: node.textKey ? localize(pinned, node.textKey, locale) : "",
        expression: node.expression,
      };
      if (node.type === "Choice" && typeof choose !== "function") {
        if (interactive)
          lines.push({
            ...line,
            choices: node.edges.map((edge, index) => ({
              text: localize(pinned, edge.labelKey, locale),
              resume: () => walk(advance(pinned, session, index)),
            })),
          });
        break;
      }
      if (
        node.type === "Battle" &&
        (typeof battle !== "function" || !battle(node.battleId))
      ) {
        if (interactive)
          lines.push({
            ...line,
            battleId: node.battleId,
            resume: () => walk(advance(pinned, session)),
          });
        break;
      }
      if (node.textKey && !(replay && node.once)) lines.push(line);
      session = advance(
        pinned,
        session,
        node.type === "Choice" ? choose(node, session.state) : 0,
      );
      Object.assign(state, structuredClone(session.state));
      if (["Action", "Reward", "Memory"].includes(node.type))
        onState?.(structuredClone(session.state));
    }
    return lines;
  }
  return walk(createSession(pinned, id, state));
}

export function endingAvailable(
  kind,
  { storyVictory = false, pledges = 0 } = {},
) {
  const rule = active.endings[kind]?.rule;
  return (
    storyVictory &&
    (rule === "storyVictory" || (rule === "allPledges" && pledges >= 5))
  );
}
