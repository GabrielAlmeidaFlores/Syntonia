import { MOCK_POSTS } from './posts';

import type { Post } from '@/types';

/**
 * IDs of posts that are pre-saved in the mock.
 * Maps post-id → savedAt ISO string (newest first).
 */
export const MOCK_SAVED_AT: Record<string, string> = {
  'post-003': '2026-07-02T14:00:00Z',
  'post-007': '2026-07-02T13:30:00Z',
  'post-013': '2026-07-02T12:45:00Z',
  'post-001': '2026-07-02T11:00:00Z',
  'post-010': '2026-07-02T09:15:00Z',
};

/**
 * Returns posts that are currently saved, sorted by savedAt descending.
 * The `savedAt` field is injected from the provided savedAtMap so it matches the API shape.
 */
export function getMockSavedPosts(
  savedIds: ReadonlySet<string>,
  savedAtMap: ReadonlyMap<string, string>,
): Post[] {
  const fallback = new Date().toISOString();
  return MOCK_POSTS.filter((p) => savedIds.has(p.id))
    .map((p) => ({ ...p, savedAt: savedAtMap.get(p.id) ?? fallback }))
    .sort((a, b) => {
      const aTime = new Date(a.savedAt).getTime();
      const bTime = new Date(b.savedAt).getTime();
      return bTime - aTime;
    });
}
