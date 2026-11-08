// Shared wire contract. Every field is required; unknown fields are rejected.
export const SCHEMA_VERSION = 1;
export const ENVIRONMENTS = ["development", "staging", "production"];
export const fields = {
  global: { maxWaves: [1, 1000, 10, true] },
  difficulty: {
    normalSpeed: [0.1, 3, 1],
    hardcoreSpeed: [0.1, 3, 1],
    infernoSpeed: [0.1, 3, 1],
  },
  gestures: { minScore: [0.1, 1, 0.65] },
  combat: { runeDamage: [1, 10, 1, true], playerDamage: [1, 5, 1, true] },
  combo: { decaySeconds: [1, 30, 2.4], scoreMultiplier: [0.1, 10, 1] },
  spells: { cooldownSeconds: [0, 60, 0] },
  modes: { endlessEnabled: true, practiceEnabled: true },
  visuals: { screenShake: true, quality: ["auto", "high", "medium", "low"] },
  accessibility: { colorBlind: false, altInput: false, missHints: true },
  flags: {
    perfectCast: false,
    chainReaction: false,
    elementalInteraction: false,
  },
};
export const defaults = Object.fromEntries(
  Object.entries(fields).map(([group, entries]) => [
    group,
    Object.fromEntries(
      Object.entries(entries).map(([key, spec]) => [
        key,
        Array.isArray(spec)
          ? typeof spec[0] === "number"
            ? spec[2]
            : spec[0]
          : spec,
      ]),
    ),
  ]),
);
export function validateConfig(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value))
    return ["Configuration must be an object"];
  for (const group of Object.keys(value))
    if (!Object.hasOwn(fields, group)) errors.push(`${group}: unknown group`);
  for (const [group, entries] of Object.entries(fields)) {
    const data = value[group];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      errors.push(`${group}: required object`);
      continue;
    }
    for (const key of Object.keys(data))
      if (!Object.hasOwn(entries, key))
        errors.push(`${group}.${key}: unknown field`);
    for (const [key, spec] of Object.entries(entries)) {
      const v = data[key];
      const valid =
        typeof spec === "boolean"
          ? typeof v === "boolean"
          : typeof spec[0] === "string"
            ? spec.includes(v)
            : typeof v === "number" &&
              Number.isFinite(v) &&
              v >= spec[0] &&
              v <= spec[1] &&
              (!spec[3] || Number.isInteger(v));
      if (!valid) errors.push(`${group}.${key}: invalid or missing value`);
    }
  }
  return errors;
}
export function freezeConfig(value) {
  for (const child of Object.values(value))
    if (child && typeof child === "object") freezeConfig(child);
  return Object.freeze(value);
}
export function previewConfig(value) {
  const errors = validateConfig(value);
  return {
    errors,
    sampleScore: errors.length
      ? null
      : Math.round(100 * value.combo.scoreMultiplier),
    samplePlayerDamage: errors.length ? null : value.combat.playerDamage,
    description: "Deterministic rules preview; does not start a ranked run.",
  };
}
