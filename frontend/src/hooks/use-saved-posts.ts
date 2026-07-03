import * as React from 'react';

import { api } from '@/services/api';
import { useSavedStore } from '@/stores/saved';
import type { SavedPostsResponse, SavePostResponse, UnsavePostResponse } from '@/types';

/**
 * Loads the first page of saved posts from GET /posts/saved on mount,
 * and exposes save/unsave actions that call the real API (MSW in dev).
 *
 * The store is the single source of truth for the saved IDs — the
 * `isSaved` selector is cheap and reactive across the whole app.
 */
export function useSavedPosts(): {
  readonly isLoading: boolean;
  readonly save: (postId: string) => Promise<void>;
  readonly unsave: (postId: string) => Promise<void>;
} {
  const setLoading = useSavedStore((s) => s.setLoading);
  const setPosts = useSavedStore((s) => s.setPosts);
  const setCursor = useSavedStore((s) => s.setCursor);
  const storeSave = useSavedStore((s) => s.save);
  const storeUnsave = useSavedStore((s) => s.unsave);
  const isLoading = useSavedStore((s) => s.isLoading);

  React.useEffect(() => {
    setLoading(true);
    void api
      .get<SavedPostsResponse>('/posts/saved')
      .then((res) => {
        setPosts(res.posts);
        setCursor(res.cursor);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setLoading, setPosts, setCursor]);

  const save = React.useCallback(
    async (postId: string): Promise<void> => {
      const res = await api.post<SavePostResponse>(`/post/${postId}/save`, {});
      const { useFeedStore } = await import('@/stores/feed');
      const post = useFeedStore.getState().posts.find((p) => p.id === postId);
      if (post !== undefined) {
        storeSave(post, res.savedAt);
      }
    },
    [storeSave],
  );

  const unsave = React.useCallback(
    async (postId: string): Promise<void> => {
      await api.delete<UnsavePostResponse>(`/post/${postId}/save`);
      storeUnsave(postId);
    },
    [storeUnsave],
  );

  return { isLoading, save, unsave };
}
