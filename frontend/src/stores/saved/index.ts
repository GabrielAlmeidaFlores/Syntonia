import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { MOCK_SAVED_AT } from '@/mocks/data/saved';
import type { Post } from '@/types';

interface SavedState {
  /** Set of post IDs that the user has saved — persisted to localStorage. */
  readonly savedIds: ReadonlySet<string>;
  /** Ordered list of saved posts (newest saved first), populated after fetch. */
  readonly posts: Post[];
  readonly isLoading: boolean;
  readonly cursor: string | null;
  readonly hasMore: boolean;
  /** Adds a post ID to the saved set and prepends the post to the list. */
  readonly save: (post: Post, savedAt: string) => void;
  /** Removes a post ID from the saved set and the list. */
  readonly unsave: (postId: string) => void;
  /** Replaces the post list (initial load). */
  readonly setPosts: (posts: Post[]) => void;
  /** Appends more posts (pagination). */
  readonly appendPosts: (posts: Post[]) => void;
  readonly setCursor: (cursor: string | null) => void;
  readonly setLoading: (loading: boolean) => void;
  /** Returns true if the given post ID is currently saved. */
  readonly isSaved: (postId: string) => boolean;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedIds: new Set<string>(Object.keys(MOCK_SAVED_AT)),
      posts: [],
      isLoading: false,
      cursor: null,
      hasMore: true,

      save: (post, savedAt) =>
        set((state) => {
          const next = new Set(state.savedIds);
          next.add(post.id);
          return {
            savedIds: next,
            posts: [{ ...post, savedAt }, ...state.posts.filter((p) => p.id !== post.id)],
          };
        }),

      unsave: (postId) =>
        set((state) => {
          const next = new Set(state.savedIds);
          next.delete(postId);
          return {
            savedIds: next,
            posts: state.posts.filter((p) => p.id !== postId),
          };
        }),

      setPosts: (posts) => set({ posts }),

      appendPosts: (newPosts) =>
        set((state) => ({ posts: [...state.posts, ...newPosts] })),

      setCursor: (cursor) => set({ cursor, hasMore: cursor !== null }),

      setLoading: (isLoading) => set({ isLoading }),

      isSaved: (postId) => get().savedIds.has(postId),
    }),
    {
      name: 'syntonia-saved',
      partialize: (state) => ({ savedIds: [...state.savedIds] }),
      merge: (persisted, current) => {
        const raw = persisted as { savedIds?: string[] };
        const ids = Array.isArray(raw.savedIds) ? raw.savedIds : [];
        return { ...current, savedIds: new Set<string>(ids) };
      },
    },
  ),
);
