export const NODE_TYPES = [
  "Dialogue",
  "Choice",
  "Condition",
  "Action",
  "Battle",
  "Reward",
  "Memory",
  "Ending",
];
export const EXPRESSIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "afraid",
  "determined",
];
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
export function localize(story, key, locale = "vi") {
  return (
    story.locales?.[locale]?.[key] || story.locales?.vi?.[key] || `[${key}]`
  );
}
export function resolveDocument(story, value, locale = "vi") {
  if (Array.isArray(value))
    return value.map((v) => resolveDocument(story, v, locale));
  if (!object(value)) return value;
  if (typeof value.key === "string") return localize(story, value.key, locale);
  const out = Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      resolveDocument(story, v, locale),
    ]),
  );
  for (const k of ["title", "text"])
    if (value[k]?.key)
      out[k === "title" ? "enTitle" : "enText"] = localize(
        story,
        value[k].key,
        "en",
      );
  return out;
}
export function validateStory(story) {
  const issues = [];
  const add = (code, message, nodeId, severity = "error") =>
    issues.push({ code, message, nodeId, severity });
  if (
    !object(story) ||
    story.schemaVersion !== 1 ||
    !Array.isArray(story.nodes) ||
    !Array.isArray(story.chapters) ||
    !object(story.entries) ||
    !Object.values(story.entries).every((id) => typeof id === "string") ||
    !object(story.locales?.vi) ||
    !object(story.locales?.en) ||
    !object(story.documents)
  ) {
    add("schema", "Invalid story schema.");
    return issues;
  }
  const nodes = new Map();
  for (const n of story.nodes) {
    if (
      !object(n) ||
      typeof n.id !== "string" ||
      !n.id ||
      !NODE_TYPES.includes(n.type) ||
      !Array.isArray(n.edges) ||
      !["who", "expression", "textKey", "battleId", "memoryId", "ending"].every(
        (k) => n[k] === undefined || typeof n[k] === "string",
      ) ||
      !n.edges.every(
        (e) =>
          object(e) &&
          typeof e.to === "string" &&
          (e.labelKey === undefined || typeof e.labelKey === "string"),
      )
    ) {
      add("node", "Invalid node structure.", n?.id);
      continue;
    }
    if (nodes.has(n.id)) add("duplicate", `Duplicate node ${n.id}.`, n.id);
    nodes.set(n.id, n);
  }
  const keys = new Set();
  function key(k, id) {
    if (
      typeof k !== "string" ||
      !k ||
      !Object.hasOwn(story.locales.vi, k) ||
      typeof story.locales.vi[k] !== "string" ||
      !story.locales.vi[k].trim()
    )
      add("localization", `Missing Vietnamese key: ${k}`, id);
    else {
      keys.add(k);
      if (
        typeof story.locales.en[k] !== "string" ||
        !story.locales.en[k].trim()
      )
        add("translation", `English translation pending: ${k}`, id, "warning");
    }
  }
  const chapters = story.chapters.filter((c) => object(c));
  if (chapters.length !== story.chapters.length)
    add("schema", "Invalid chapter structure.");
  const chapterIds = new Set(chapters.map((c) => c.id));
  for (const id of [1, 2, 3, 4, 5])
    if (!chapterIds.has(id)) add("chapter", `Required chapter ${id} missing.`);
  for (const c of chapters) key(c.titleKey);
  for (const n of nodes.values()) {
    if (!chapterIds.has(n.chapter))
      add("chapter", `Unknown chapter ${n.chapter}.`, n.id);
    if (n.textKey) key(n.textKey, n.id);
    if (
      ["Dialogue", "Choice", "Memory", "Ending"].includes(n.type) &&
      !n.textKey
    )
      add("text", "Text key required.", n.id);
    if (
      n.who &&
      ![
        "momo",
        "barnaby",
        "oliver",
        "luna",
        "nyx",
        "allies",
        "grimoire",
        "umbra",
        "boss",
        "freed",
      ].includes(n.who)
    )
      add("speaker", "Unknown speaker reference.", n.id);
    if (n.expression && !EXPRESSIONS.includes(n.expression))
      add("expression", "Unknown expression.", n.id);
    if (!Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y))
      add("position", "Finite canvas position required.", n.id);
    if (n.type === "Choice" && n.edges.length < 2)
      add("choice", "Choices require at least two branches.", n.id);
    if (
      n.type === "Condition" &&
      (n.edges.length !== 2 || !validCondition(n.condition))
    )
      add(
        "condition",
        "Condition requires a valid predicate and two branches (true, false).",
        n.id,
      );
    if (!["Choice", "Condition"].includes(n.type) && n.edges.length > 1)
      add("branches", "Only Choice and Condition nodes may branch.", n.id);
    if (["Action", "Reward"].includes(n.type) && !validEffect(n.effect))
      add(
        "effect",
        "Effect must set a flag or collect a promise, memory, or reward.",
        n.id,
      );
    if (
      n.type === "Battle" &&
      !(
        Array.isArray(story.documents.chapters) &&
        story.documents.chapters.some(
          (c) => c?.levelId === n.battleId && c.chapter === n.chapter,
        )
      )
    )
      add("battle", "Battle must reference the current chapter levelId.", n.id);
    if (
      n.type === "Memory" &&
      !(
        Array.isArray(story.documents.memories) &&
        story.documents.memories.some(
          (m) => m && String(m.level) === n.memoryId,
        )
      )
    )
      add("memory", "Memory reference required.", n.id);
    if (n.type === "Ending" && !story.endings?.[n.ending])
      add("ending", "Unknown ending.", n.id);
    for (const e of n.edges) {
      if (!object(e) || !nodes.has(e.to))
        add("reference", `Missing target ${e?.to}.`, n.id);
      if (n.type === "Choice") key(e?.labelKey, n.id);
    }
  }
  function document(v) {
    if (!object(v) && !Array.isArray(v)) return;
    if (v.key) key(v.key);
    else Object.values(v).forEach(document);
  }
  document(story.documents);
  if (
    !Array.isArray(story.documents.chapters) ||
    story.documents.chapters.length < 5 ||
    !Array.isArray(story.documents.memories) ||
    story.documents.memories.length < 5 ||
    !["INTRO", "VICTORY", "TRUE_ENDING"].every(
      (k) =>
        Array.isArray(story.documents.slides?.[k]) &&
        story.documents.slides[k].length,
    )
  )
    add(
      "documents",
      "Keep the five chapter documents, five memories, and existing intro and ending slides.",
    );
  for (const id of [1, 2, 3, 4, 5]) {
    const c = story.documents.chapters?.find?.((c) => c?.chapter === id);
    const m = story.documents.memories?.find?.((m) => m?.level === id);
    if (
      !c?.title?.key ||
      !c?.text?.key ||
      !c?.companion ||
      !c?.quotes?.intro?.key ||
      !c?.quotes?.boss?.key ||
      !m?.shard?.key ||
      !m?.pledge?.objective?.key ||
      !m?.pledge?.reveal?.key
    )
      add(
        "documents",
        `Chapter ${id} presentation or memory/pledge fields missing.`,
      );
  }
  for (const group of ["INTRO", "VICTORY", "TRUE_ENDING"])
    if (
      !story.documents.slides?.[group]?.every?.(
        (s) => s?.title?.key && s?.text?.key,
      )
    )
      add("documents", `Invalid ${group} slides.`);
  for (const locale of ["vi", "en"])
    for (const [k, v] of Object.entries(story.locales[locale]))
      if (typeof v !== "string")
        add("localization", `Translation ${locale}:${k} must be text.`);
  const roots = Object.values(story.entries);
  for (const id of roots)
    if (!nodes.has(id)) add("entry", `Missing entry ${id}.`);
  const reached = new Set();
  const pending = [...roots];
  while (pending.length) {
    const id = pending.pop();
    if (reached.has(id) || !nodes.has(id)) continue;
    reached.add(id);
    pending.push(...nodes.get(id).edges.map((e) => e?.to));
  }
  for (const id of nodes.keys())
    if (!reached.has(id)) add("unreachable", `Unreachable node ${id}.`, id);
  // Kahn's algorithm rejects all cycles, including self-loops, without recursive stack growth.
  const degree = new Map([...nodes.keys()].map((id) => [id, 0]));
  for (const n of nodes.values())
    for (const e of n.edges)
      if (degree.has(e?.to)) degree.set(e.to, degree.get(e.to) + 1);
  const queue = [...degree].filter(([, d]) => !d).map(([id]) => id);
  for (let i = 0; i < queue.length; i++)
    for (const e of nodes.get(queue[i]).edges)
      if (degree.has(e?.to)) {
        degree.set(e.to, degree.get(e.to) - 1);
        if (!degree.get(e.to)) queue.push(e.to);
      }
  if (queue.length !== nodes.size)
    add("cycle", "Cycles are invalid; story graphs must terminate.");
  for (const [kind, rule] of [
    ["normal", "storyVictory"],
    ["true", "allPledges"],
  ]) {
    const ending = story.endings?.[kind];
    if (
      !ending ||
      ending.rule !== rule ||
      nodes.get(ending.entry)?.ending !== kind
    )
      add("ending", `Required ${kind} ending or unlock rule missing.`);
  }
  return issues;
}
const validCondition = (c) =>
  object(c) &&
  ["flag", "promise", "memory", "reward"].includes(c.kind) &&
  typeof c.key === "string" &&
  !!c.key &&
  (c.equals === undefined ||
    ["string", "number", "boolean"].includes(typeof c.equals));
const validEffect = (e) =>
  object(e) &&
  validCondition(e) &&
  (e.kind !== "flag" ||
    ["string", "number", "boolean"].includes(typeof e.value));
export function sanitizeStoryState(value = {}) {
  value = object(value) ? value : {};
  const flags = Object.fromEntries(
    Object.entries(object(value.flags) ? value.flags : {}).filter(
      ([k, v]) =>
        k.length <= 160 &&
        ["string", "number", "boolean"].includes(typeof v) &&
        (typeof v !== "number" || Number.isFinite(v)),
    ),
  );
  return {
    flags,
    ...Object.fromEntries(
      ["promises", "memories", "rewards"].map((k) => [
        k,
        [
          ...new Set(
            Array.isArray(value[k])
              ? value[k].filter((v) => typeof v === "string" && v.length <= 160)
              : [],
          ),
        ],
      ]),
    ),
  };
}
export function createSession(story, nodeId, state = {}) {
  if (!story.nodes.some((n) => n.id === nodeId))
    throw new Error("Unknown preview node.");
  return { nodeId, state: sanitizeStoryState(state), history: [], done: false };
}
export function advance(story, session, branch = 0) {
  if (session.done) return session;
  const n = story.nodes.find((n) => n.id === session.nodeId);
  if (!n) throw new Error("Missing node.");
  const next = structuredClone(session);
  const s = next.state;
  if (n.type === "Choice" && (!Number.isInteger(branch) || !n.edges[branch]))
    throw new Error("Choose a valid branch.");
  if (n.type === "Condition") {
    const c = n.condition;
    if (!validCondition(c)) throw new Error("Invalid condition.");
    const value =
      c.kind === "flag"
        ? s.flags[c.key]
        : s[c.kind === "memory" ? "memories" : `${c.kind}s`].includes(c.key);
    branch = value === (c.equals ?? true) ? 0 : 1;
  }
  if (["Action", "Reward"].includes(n.type)) {
    const e = n.effect;
    if (!validEffect(e)) throw new Error("Invalid effect.");
    if (e.kind === "flag")
      Object.defineProperty(s.flags, e.key, {
        value: e.value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    else if (
      !s[e.kind === "memory" ? "memories" : `${e.kind}s`].includes(e.key)
    )
      s[e.kind === "memory" ? "memories" : `${e.kind}s`].push(e.key);
  }
  if (n.type === "Memory" && !s.memories.includes(n.memoryId))
    s.memories.push(n.memoryId);
  next.history.push(n.id);
  if (next.history.length > 1000) throw new Error("Traversal limit reached.");
  const target = n.edges[branch]?.to;
  if (target && next.history.includes(target))
    throw new Error("Cycle detected.");
  next.nodeId = target || n.id;
  next.done = !target;
  return next;
}
