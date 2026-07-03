import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Tag } from "@/types";

interface UserState {
  readonly description: string;
  /** All tags extracted by AI — never changes after extraction. */
  readonly extractedTags: Tag[];
  /** Subset of extractedTags the user has enabled — drives feed generation. */
  readonly activeTags: Tag[];
  readonly setDescription: (description: string) => void;
  readonly setTags: (tags: Tag[]) => void;
  /** Toggles a single tag on/off. Always keeps at least 1 active tag. */
  readonly toggleTag: (tag: Tag) => void;
  /** Replaces description and extracted tags atomically after AI extraction. All tags start active. */
  readonly setProfile: (description: string, tags: Tag[]) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      description: "",
      extractedTags: [],
      activeTags: [],
      setDescription: (description) => set({ description }),
      setTags: (activeTags) => set({ activeTags }),
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
    }),
    { name: "syntonia-user-prefs" },
  ),
);
