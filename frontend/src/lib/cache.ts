/**
 * In-memory TTL cache for API responses.
 *
 * Stores entries as `{ data, cachedAt }` keyed by a string.
 * All entries are cleared on logout (see useAuthStore) and when the browser
 * tab is closed — this cache does not persist across hard refreshes.
 *
 * TTL constants:
 *   SAVED_POSTS_TTL_MS  — 5 minutes  (saved posts list)
 *   POST_DETAIL_TTL_MS  — 30 minutes (individual post content)
 *   PREFERENCES_TTL_MS  — 10 minutes (user preferences)
 */

export const SAVED_POSTS_TTL_MS = 5 * 60 * 1000;
export const POST_DETAIL_TTL_MS = 30 * 60 * 1000;
export const PREFERENCES_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  readonly data: unknown;
  readonly cachedAt: number;
}

const store = new Map<string, CacheEntry>();

/**
 * Stores data under the given key with the current timestamp.
 * Subsequent calls to `get` or `isFresh` will use this timestamp for TTL checks.
 */
function set(key: string, data: unknown): void {
  store.set(key, { data, cachedAt: Date.now() });
}

/**
 * Returns the cached data if the entry exists and is within `ttlMs`.
 * Returns `null` if the entry is absent or expired (expired entries are deleted).
 * The caller is responsible for casting the result to the expected type.
 */
function get(key: string, ttlMs: number): unknown {
  const entry = store.get(key);
  if (entry === undefined) return null;
  if (Date.now() - entry.cachedAt > ttlMs) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Returns true if an entry exists and is within `ttlMs`.
 * Does not return the stored data — use for timestamp-only guards.
 */
function isFresh(key: string, ttlMs: number): boolean {
  const entry = store.get(key);
  if (entry === undefined) return false;
  if (Date.now() - entry.cachedAt > ttlMs) {
    store.delete(key);
    return false;
  }
  return true;
}

/**
 * Records a timestamp for `key` without storing any data.
 * Use when the actual data lives in a Zustand store (e.g. saved posts, preferences)
 * and the cache is only needed as a "should I re-fetch?" guard.
 */
function touch(key: string): void {
  store.set(key, { data: null, cachedAt: Date.now() });
}

/** Removes a single cache entry, forcing a re-fetch on the next access. */
function invalidate(key: string): void {
  store.delete(key);
}

/** Removes all cache entries whose key starts with `prefix`. */
function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Clears the entire cache. Called on logout to prevent cross-user data leaks. */
function invalidateAll(): void {
  store.clear();
}

export const appCache = {
  set,
  get,
  isFresh,
  touch,
  invalidate,
  invalidatePrefix,
  invalidateAll,
};
