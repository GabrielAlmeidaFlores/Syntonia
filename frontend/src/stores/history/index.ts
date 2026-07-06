import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HistoryState {
  /**
   * ISO timestamp of the most recently viewed post (max createdAt seen).
   * Persisted across sessions. On next load, GET /feed passes this as `?after=`
   * so the user only receives posts generated after this point.
   */
  readonly lastViewedCreatedAt: string | null;
  /**
   * Updates lastViewedCreatedAt only if the incoming createdAt is newer.
   * Called by the IntersectionObserver in FeedContainer when a post becomes visible.
   */
  readonly setLastViewedCreatedAt: (createdAt: string) => void;
  /** Resets history — called on logout so the next user starts from scratch. */
  readonly reset: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      lastViewedCreatedAt: null,
      setLastViewedCreatedAt: (createdAt) => {
        const current = get().lastViewedCreatedAt;
        if (current === null || createdAt > current) {
          set({ lastViewedCreatedAt: createdAt });
        }
      },
      reset: () => set({ lastViewedCreatedAt: null }),
    }),
    { name: "syntonia-history" },
  ),
);
