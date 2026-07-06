import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Tag } from "@/types";

interface UserState {
  readonly description: string;
  /** All tags associated with the current description — reset on every new description submission. */
  readonly extractedTags: Tag[];
  /** Subset of extractedTags the user has enabled — drives feed generation. */
  readonly activeTags: Tag[];
  readonly setDescription: (description: string) => void;
  /** Updates activeTags only. Rejects empty arrays (min 1 tag enforced). */
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
   * Replaces local state with what the server has.
   * Called on session restore and login. Does NOT merge with local state —
   * extractedTags is set to exactly the server's activeTags. This guarantees
   * that when the description changes, old tags from previous descriptions
   * never re-appear as deactivated chips in the TagManager.
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
      syncFromServer: (description, newActiveTags) => {
        const tags = newActiveTags.length > 0 ? newActiveTags : get().activeTags;
        set({ description, activeTags: tags, extractedTags: tags });
      },
    }),
    { name: "syntonia-user-prefs" },
  ),
);
