import * as React from 'react';

import { FEED_PAGE_SIZE } from '@/lib/constants';
import { api } from '@/services/api';
import { useFeedStore } from '@/stores/feed';
import type { FeedResponse, Post } from '@/types';

/**
 * Fetches and paginates the authenticated user's post feed via GET /feed.
 *
 * In development, MSW intercepts the request and returns a slice of MOCK_POSTS.
 * In production, the request goes to the real API Gateway endpoint which queries
 * DynamoDB via the userId-createdAt-index GSI.
 *
 * The cursor is a base-10 numeric string (offset into the result set) in the mock
 * and a base64-encoded DynamoDB LastEvaluatedKey in production — the hook handles
 * both transparently since it just passes the cursor back opaquely.
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

    const params = new URLSearchParams({ limit: String(FEED_PAGE_SIZE) });
    if (cursor !== null) params.append('cursor', cursor);

    void api.get<FeedResponse>(`/feed?${params.toString()}`).then((data) => {
      if (posts.length === 0) {
        setPosts(data.posts);
      } else {
        appendPosts(data.posts);
      }
      setCursor(data.cursor);
      setLoading(false);
    });
  }, [isLoading, hasMore, cursor, posts.length, setPosts, appendPosts, setCursor, setLoading]);

  React.useEffect(() => {
    if (posts.length === 0) fetchMore();
  }, [fetchMore, posts.length]);

  return { posts, isLoading, fetchMore };
}
