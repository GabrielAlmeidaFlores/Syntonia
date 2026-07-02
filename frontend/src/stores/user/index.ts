import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Tag } from '@/types';

interface UserState {
  readonly description: string;
  readonly activeTags: Tag[];
  readonly setDescription: (description: string) => void;
  readonly setTags: (tags: Tag[]) => void;
  /** Toggles a single tag on/off. Always keeps at least 1 active tag. */
  readonly toggleTag: (tag: Tag) => void;
  /** Replaces description and tags atomically after AI extraction. */
  readonly setProfile: (description: string, tags: Tag[]) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      description: '',
      activeTags: [],
      setDescription: (description) => set({ description }),
      setTags: (activeTags) => set({ activeTags }),
      toggleTag: (tag) => {
        const current = get().activeTags;
        const isActive = current.includes(tag);
        if (isActive && current.length <= 1) return;
        set({
          activeTags: isActive ? current.filter((t) => t !== tag) : [...current, tag],
        });
      },
      setProfile: (description, activeTags) => set({ description, activeTags }),
    }),
    { name: 'syntonia-user-prefs' },
  ),
);
