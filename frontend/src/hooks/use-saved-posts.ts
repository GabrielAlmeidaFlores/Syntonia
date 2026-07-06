import * as React from "react";

import { appCache, SAVED_POSTS_TTL_MS } from "@/lib/cache";
import { api } from "@/services/api";
import { useSavedStore } from "@/stores/saved";
import type { SavedPostsResponse } from "@/types";

/**
 * Loads the user's saved posts from GET /posts/saved with in-memory caching.
 *
 * On mount, checks whether a fresh cache entry exists (within SAVED_POSTS_TTL_MS).
 * If the entry is fresh the Zustand store already has the correct data and no
 * network request is made. If the entry is absent or stale, a fresh fetch is
 * triggered and the cache timestamp is updated.
 *
 * `refresh()` explicitly invalidates the cache and issues a new request — call it
 * when the user taps the Reload button.
 */
export function useSavedPosts(): {
  readonly isLoading: boolean;
  readonly refresh: () => void;
} {
  const setLoading = useSavedStore((s) => s.setLoading);
  const setPosts = useSavedStore((s) => s.setPosts);
  const setCursor = useSavedStore((s) => s.setCursor);
  const isLoading = useSavedStore((s) => s.isLoading);

  const fetchSaved = React.useCallback(
    (force: boolean): void => {
      if (!force && appCache.isFresh("saved-posts", SAVED_POSTS_TTL_MS)) return;

      setLoading(true);
      void api
        .get<SavedPostsResponse>("/posts/saved")
        .then((res) => {
          setPosts(res.posts);
          setCursor(res.cursor);
          appCache.touch("saved-posts");
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [setLoading, setPosts, setCursor],
  );

  React.useEffect(() => {
    fetchSaved(false);
  }, [fetchSaved]);

  const refresh = React.useCallback((): void => {
    appCache.invalidate("saved-posts");
    fetchSaved(true);
  }, [fetchSaved]);

  return { isLoading, refresh };
}
