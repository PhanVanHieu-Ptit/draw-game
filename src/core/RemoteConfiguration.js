import {
  defaults,
  validateConfig,
  freezeConfig,
  SCHEMA_VERSION,
  ENVIRONMENTS,
} from "../../shared/game-configuration.js";
export class RemoteConfiguration {
  constructor() {
    this.published = null;
  }
  async load(url, environment, fetcher = globalThis.fetch) {
    if (!url || !ENVIRONMENTS.includes(environment)) return false;
    try {
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(2500),
        credentials: "omit",
      });
      if (!response.ok) return false;
      const value = await response.json();
      if (
        value.schemaVersion !== SCHEMA_VERSION ||
        value.environment !== environment ||
        typeof value.id !== "string" ||
        validateConfig(value.values).length
      )
        return false;
      this.published = freezeConfig(structuredClone(value));
      return true;
    } catch {
      return false;
    }
  }
  pin() {
    return freezeConfig(
      structuredClone(
        this.published || {
          id: "local",
          schemaVersion: SCHEMA_VERSION,
          values: defaults,
        },
      ),
    );
  }
}
