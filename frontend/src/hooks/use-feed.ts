import * as React from 'react';

import { FEED_PAGE_SIZE } from '@/lib/constants';
import { sleep } from '@/lib/utils';
import { MOCK_POSTS } from '@/mocks/data';
import { useFeedStore } from '@/stores/feed';
import type { Post } from '@/types';

/**
 * Paginates the mock post list, simulating GET /feed?limit=5&cursor=...
 *
 * In production this calls the real API Gateway endpoint.
 * The cursor is a numeric string representing the slice offset into MOCK_POSTS.
 */
export function useFeed(): {
  posts: Post[];
  isLoading: boolean;
  fetchMore: () => void;
} {
  const { posts, cursor, isLoading, hasMore, setPosts, appendPosts, setCursor, setLoading } =
    useFeedStore();

  const fetchMore = React.useCallback((): void => {
    if (isLoading || !hasMore) return;

    setLoading(true);

    const offset = cursor !== null ? Number(cursor) : 0;
    const slice = MOCK_POSTS.slice(offset, offset + FEED_PAGE_SIZE);

    void sleep(400).then(() => {
      if (posts.length === 0) {
        setPosts(slice);
      } else {
        appendPosts(slice);
      }

      const nextOffset = offset + slice.length;
      const nextCursor = nextOffset < MOCK_POSTS.length ? String(nextOffset) : null;
      setCursor(nextCursor);
      setLoading(false);
    });
  }, [isLoading, hasMore, cursor, posts.length, setPosts, appendPosts, setCursor, setLoading]);

  React.useEffect(() => {
    if (posts.length === 0) fetchMore();
  }, [fetchMore, posts.length]);

  return { posts, isLoading, fetchMore };
}
