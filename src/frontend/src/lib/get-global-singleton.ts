/**
 * Returns the singleton stored at `globalThis[key]`.
 * If not yet set, calls `factory()` to create it, stores it, and returns it.
 * Isolates the `Record<string, unknown>` type assertion to a single place.
 */
export function getGlobalSingleton<T>(key: string, factory: () => T): T {
  const g = globalThis as Record<string, unknown>;
  return (g[key] as T) ?? (g[key] = factory());
}
