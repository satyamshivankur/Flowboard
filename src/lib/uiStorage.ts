/**
 * Durable UI preferences — density, sidebar collapsed state, active view.
 *
 * Kept separate from `PersistenceAdapter`, which carries domain state. These
 * are presentation choices: losing them is a mild annoyance, not data loss, so
 * they are written directly and every failure path degrades silently.
 */

const PREFIX = "flowboard:ui:";

function storage(): Storage | null {
  try {
    // Private browsing can throw on the property read itself, not just on write.
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readPreference<T>(key: string, fallback: T): T {
  const raw = storage()?.getItem(PREFIX + key);

  if (raw === null || raw === undefined) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writePreference(key: string, value: unknown): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota or disabled storage. The preference stays in memory for the session.
  }
}
