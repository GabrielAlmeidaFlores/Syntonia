import { create } from 'zustand';

import type { Post } from '@/types';

interface FeedState {
  readonly posts: Post[];
  readonly currentIndex: number;
  readonly cursor: string | null;
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  /** True while any PostDetail panel is open — used to lock the snap container. */
  readonly isPostExpanded: boolean;
  readonly setPosts: (posts: Post[]) => void;
  readonly appendPosts: (posts: Post[]) => void;
  readonly setCurrentIndex: (index: number) => void;
  readonly setCursor: (cursor: string | null) => void;
  readonly setLoading: (loading: boolean) => void;
  readonly setPostExpanded: (expanded: boolean) => void;
  readonly reset: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  currentIndex: 0,
  cursor: null,
  hasMore: true,
  isLoading: false,
  isPostExpanded: false,

  setPosts: (posts) => set({ posts }),

  appendPosts: (newPosts) =>
    set((state) => ({
      posts: [...state.posts, ...newPosts],
    })),

  setCurrentIndex: (currentIndex) => set({ currentIndex }),

  setCursor: (cursor) => set({ cursor, hasMore: cursor !== null }),

  setLoading: (isLoading) => set({ isLoading }),

  setPostExpanded: (isPostExpanded) => set({ isPostExpanded }),

  reset: () =>
    set({
      posts: [],
      currentIndex: 0,
      cursor: null,
      hasMore: true,
      isLoading: false,
      isPostExpanded: false,
    }),
}));
