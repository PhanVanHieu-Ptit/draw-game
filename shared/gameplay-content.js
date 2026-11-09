import { ENEMY_TYPES, RUNES } from "../src/core/Constants.js";
export const CONTENT_SCHEMA_VERSION = 1;
const text = (value = "") => ({ type: "string", default: value });
const number = (value, min = 0, max = 100000, integer = false) => ({
  type: "number",
  default: value,
  min,
  max,
  integer,
});
const choice = (options) => ({ type: "choice", options, default: options[0] });
const list = (item) => ({ type: "array", item });
const object = (fields) => ({ type: "object", fields });
const reference = (collection) => ({
  type: "reference",
  collection,
  default: "",
});
const gestures = list(choice(Object.keys(RUNES)));
const ability = object({
  kind: choice(["hide", "swirl", "meteors", "sprint", "flicker"]),
  cooldown: number(8, 0.1, 600),
  duration: number(2, 0.1, 600),
  warning: text(),
});
const enemyFields = {
  id: text("enemy"),
  name: text("New enemy"),
  category: choice(["regular", "elite", "support"]),
  archetype: choice(
    Object.keys(ENEMY_TYPES).filter((k) => !k.startsWith("BOSS")),
  ),
  health: number(1, 1, 10000, true),
  speed: number(50, 0.1, 2000),
  damage: number(1, 0, 10000),
  score: number(100, 0, 100000, true),
  gestures,
  spawnProbability: number(1, 0, 1),
  abilities: list(ability),
  statusEffects: list(
    object({
      kind: choice(["slow", "stun"]),
      duration: number(2, 0.1, 600),
      strength: number(1, 0, 100),
    }),
  ),
  visual: text(),
  audio: text(),
};
export const contentSchema = object({
  enemies: list(object(enemyFields)),
  bosses: list(
    object({
      ...enemyFields,
      id: text("boss"),
      name: text("New boss"),
      archetype: choice(
        Object.keys(ENEMY_TYPES).filter((k) => k.startsWith("BOSS")),
      ),
      phases: list(
        object({
          id: text("phase"),
          hpThreshold: number(1, 0, 1),
          transition: choice(["immediate", "after-ability", "after-summons"]),
          abilities: list(ability),
          gestures,
          gestureRule: choice(["ordered", "random", "repeat"]),
          summons: list(reference("enemies")),
          animation: text(),
          warning: text(),
        }),
      ),
      defeatCondition: choice(["zero-health", "all-phases-and-summons"]),
    }),
  ),
  waves: list(
    object({
      id: text("wave"),
      name: text("New wave"),
      start: number(0, 0, 36000),
      duration: number(30, 0.1, 3600),
      groups: list(
        object({
          enemyId: reference("enemies"),
          count: number(3, 1, 500, true),
          offset: number(0, 0, 3600),
          interval: number(1, 0.05, 600),
          direction: choice(["left", "right", "top", "bottom", "random"]),
        }),
      ),
      bossId: reference("bosses"),
      difficulty: object({
        speedMultiplier: number(1, 0.1, 10),
        healthMultiplier: number(1, 0.1, 100),
      }),
    }),
  ),
});
export function createContentValue(schema) {
  if (schema.type === "object")
    return Object.fromEntries(
      Object.entries(schema.fields).map(([key, value]) => [
        key,
        createContentValue(value),
      ]),
    );
  if (schema.type === "array") return [];
  return schema.default;
}
export const contentDefaults = createContentValue(contentSchema);
export function validateContent(value) {
  const errors = [];
  function walk(s, v, path) {
    const bad = (message) => errors.push(`${path}: ${message}`);
    if (s.type === "object") {
      if (!v || typeof v !== "object" || Array.isArray(v))
        return bad("required object");
      for (const k of Object.keys(v))
        if (!Object.hasOwn(s.fields, k)) bad(`unknown field ${k}`);
      for (const [k, child] of Object.entries(s.fields))
        walk(child, v[k], `${path}.${k}`);
    } else if (s.type === "array") {
      if (!Array.isArray(v) || v.length > 500)
        return bad("expected array with at most 500 entries");
      v.forEach((item, i) => walk(s.item, item, `${path}[${i}]`));
    } else if (s.type === "number") {
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < s.min ||
        v > s.max ||
        (s.integer && !Number.isInteger(v))
      )
        bad(
          `expected ${s.integer ? "integer" : "number"} in ${s.min}–${s.max}`,
        );
    } else if (typeof v !== "string" || v.length > 512)
      bad("expected string up to 512 characters");
    else if (s.type === "choice" && !s.options.includes(v))
      bad("unknown option");
    else if (
      s.type === "reference" &&
      v &&
      (!Array.isArray(value?.[s.collection]) ||
        !value[s.collection].some((item) => item?.id === v))
    )
      bad(`missing ${s.collection} reference ${v}`);
    else if ((path.endsWith(".id") || path.endsWith(".name")) && !v.trim())
      bad("required");
  }
  walk(contentSchema, value, "content");
  if (errors.length) return errors;
  for (const key of ["enemies", "bosses", "waves"]) {
    const ids = new Set();
    value[key].forEach((item) => {
      if (ids.has(item.id)) errors.push(`${key}: duplicate ID ${item.id}`);
      ids.add(item.id);
    });
  }
  value.bosses.forEach((b) => {
    if (!b.phases.length || b.phases[0].hpThreshold !== 1)
      errors.push(`${b.id}: first phase must start at 100% HP`);
    b.phases.forEach((p, i) => {
      if (i && p.hpThreshold >= b.phases[i - 1].hpThreshold)
        errors.push(`${b.id}: phase HP thresholds must strictly descend`);
    });
    if (new Set(b.phases.map((p) => p.id)).size !== b.phases.length)
      errors.push(`${b.id}: duplicate phase IDs`);
  });
  const waves = [...value.waves].sort((a, b) => a.start - b.start);
  waves.forEach((w, i) => {
    if (i && w.start < waves[i - 1].start + waves[i - 1].duration)
      errors.push(`${w.id}: overlaps ${waves[i - 1].id}`);
    if (!w.groups.length && !w.bossId)
      errors.push(`${w.id}: requires enemies or a boss`);
    w.groups.forEach((g) => {
      if (!g.enemyId || g.offset + (g.count - 1) * g.interval > w.duration)
        errors.push(`${w.id}: missing enemy or spawns exceed duration`);
    });
  });
  if (
    value.waves.reduce(
      (total, w) => total + w.groups.reduce((n, g) => n + g.count, 0),
      0,
    ) > 10000
  )
    errors.push("Content exceeds 10000 spawn events");
  return errors;
}
export function contentTimeline(content) {
  return content.waves
    .flatMap((w) => [
      ...w.groups.flatMap((g) =>
        Array.from({ length: g.count }, (_, i) => ({
          time: w.start + g.offset + i * g.interval,
          waveId: w.id,
          enemyId: g.enemyId,
          direction: g.direction,
        })),
      ),
      ...(w.bossId
        ? [
            {
              time: w.start,
              waveId: w.id,
              enemyId: w.bossId,
              direction: "right",
            },
          ]
        : []),
    ])
    .sort((a, b) => a.time - b.time);
}
