import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LikedState {
  /**
   * Set of post IDs the user has liked — persisted to localStorage.
   * Represents the local optimistic state; the backend stores `likedAt`
   * as the authoritative record used by the AI for deduplication.
   */
  readonly likedIds: ReadonlySet<string>;
  /** Marks a post as liked in the local store. */
  readonly like: (postId: string) => void;
  /** Removes the like from a post in the local store. */
  readonly unlike: (postId: string) => void;
  /** Returns true if the given post ID is currently liked. */
  readonly isLiked: (postId: string) => boolean;
}

export const useLikedStore = create<LikedState>()(
  persist(
    (set, get) => ({
      likedIds: new Set<string>(),

      like: (postId) =>
        set((state) => {
          const next = new Set(state.likedIds);
          next.add(postId);
          return { likedIds: next };
        }),

      unlike: (postId) =>
        set((state) => {
          const next = new Set(state.likedIds);
          next.delete(postId);
          return { likedIds: next };
        }),

      isLiked: (postId) => get().likedIds.has(postId),
    }),
    {
      name: "syntonia-liked",
      partialize: (state) => ({ likedIds: [...state.likedIds] }),
      merge: (persisted, current) => {
        const raw = persisted as { likedIds?: string[] };
        const ids = Array.isArray(raw.likedIds) ? raw.likedIds : [];
        return { ...current, likedIds: new Set<string>(ids) };
      },
    },
  ),
);
