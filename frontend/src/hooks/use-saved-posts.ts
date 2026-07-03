import * as React from "react";

import { api } from "@/services/api";
import { useSavedStore } from "@/stores/saved";
import type { SavedPostsResponse } from "@/types";

/**
 * Loads the user's saved posts from GET /posts/saved on mount and exposes
 * the loading state. Save and unsave actions are handled locally in each
 * component (PostDetail, SavedPostCard) via the API and useSavedStore directly.
 */
export function useSavedPosts(): { readonly isLoading: boolean } {
  const setLoading = useSavedStore((s) => s.setLoading);
  const setPosts = useSavedStore((s) => s.setPosts);
  const setCursor = useSavedStore((s) => s.setCursor);
  const isLoading = useSavedStore((s) => s.isLoading);

  React.useEffect(() => {
    setLoading(true);
    void api
      .get<SavedPostsResponse>("/posts/saved")
      .then((res) => {
        setPosts(res.posts);
        setCursor(res.cursor);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setLoading, setPosts, setCursor]);

  return { isLoading };
}
