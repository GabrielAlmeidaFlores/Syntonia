import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Tag } from "@/types";

interface UserState {
  readonly description: string;
  /** All tags extracted by AI — never changes until a new description is submitted. */
  readonly extractedTags: Tag[];
  /** Subset of extractedTags the user has enabled — drives feed generation. */
  readonly activeTags: Tag[];
  readonly setDescription: (description: string) => void;
  readonly setTags: (tags: Tag[]) => void;
  /** Toggles a single tag on/off. Always keeps at least 1 active tag. */
  readonly toggleTag: (tag: Tag) => void;
  /**
   * Full reset — called only when the user submits a NEW description.
   * Replaces both extractedTags and activeTags with the AI-generated set.
   * All tags start active after extraction.
   */
  readonly setProfile: (description: string, tags: Tag[]) => void;
  /**
   * Soft sync from server on session restore or login.
   * Updates description and activeTags WITHOUT resetting extractedTags.
   * Merges any activeTags not already in extractedTags into extractedTags,
   * ensuring activeTags ⊆ extractedTags at all times.
   * Deactivated tags (in extractedTags but not in activeTags) are preserved.
   */
  readonly syncFromServer: (description: string, activeTags: Tag[]) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      description: "",
      extractedTags: [],
      activeTags: [],
      setDescription: (description) => set({ description }),
      setTags: (activeTags) => {
        if (activeTags.length === 0) return;
        set({ activeTags });
      },
      toggleTag: (tag) => {
        const current = get().activeTags;
        const isActive = current.includes(tag);
        if (isActive && current.length <= 1) return;
        set({
          activeTags: isActive
            ? current.filter((t) => t !== tag)
            : [...current, tag],
        });
      },
      setProfile: (description, tags) =>
        set({ description, extractedTags: tags, activeTags: tags }),
      syncFromServer: (description, newActiveTags) =>
        set((state) => {
          const tags = newActiveTags.length > 0 ? newActiveTags : state.activeTags;
          const merged = [
            ...new Set([...state.extractedTags, ...tags]),
          ];
          return {
            description,
            activeTags: tags,
            extractedTags: merged,
          };
        }),
    }),
    { name: "syntonia-user-prefs" },
  ),
);

