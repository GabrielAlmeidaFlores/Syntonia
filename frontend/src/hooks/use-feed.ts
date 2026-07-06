import * as React from "react";

import { FEED_PAGE_SIZE } from "@/lib/constants";
import { VITE_MODE } from "@/lib/env";
import { api } from "@/services/api";
import { useFeedStore } from "@/stores/feed";
import { useHistoryStore } from "@/stores/history";
import type { FeedResponse, Post } from "@/types";

/**
 * Fetches and paginates the authenticated user's post feed via GET /feed.
 *
 * On the first render, reads `lastViewedCreatedAt` from the history store and
 * captures it in a session ref. All GET /feed calls within this session pass
 * `?after=<sessionAfter>` so the backend only returns posts generated after
 * the user's last viewing session. This prevents already-seen posts from
 * reappearing on page reload.
 *
 * In development, MSW intercepts the request and returns a filtered slice of
 * MOCK_POSTS. In production, the request goes to the real API Gateway endpoint
 * which queries DynamoDB via the userId-createdAt-index GSI.
 *
 * The cursor is a base64-encoded DynamoDB LastEvaluatedKey in production — the
 * hook handles it opaquely.
 */
export function useFeed(): {
  posts: Post[];
  isLoading: boolean;
  fetchMore: () => void;
} {
  const {
    posts,
    cursor,
    isLoading,
    hasMore,
    setPosts,
    appendPosts,
    setCursor,
    setLoading,
  } = useFeedStore();

  const lastViewedCreatedAt = useHistoryStore((s) => s.lastViewedCreatedAt);
  const sessionAfterRef = React.useRef(lastViewedCreatedAt);

  const fetchMore = React.useCallback((): void => {
    if (isLoading || !hasMore) return;

    setLoading(true);

    const params = new URLSearchParams({ limit: String(FEED_PAGE_SIZE) });
    if (cursor !== null) params.append("cursor", cursor);
    if (VITE_MODE !== "development" && sessionAfterRef.current !== null) {
      params.append("after", sessionAfterRef.current);
    }

    void api
      .get<FeedResponse>(`/feed?${params.toString()}`)
      .then((data) => {
        if (posts.length === 0) {
          setPosts(data.posts);
        } else {
          appendPosts(data.posts);
        }
        setCursor(data.cursor);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    isLoading,
    hasMore,
    cursor,
    posts.length,
    setPosts,
    appendPosts,
    setCursor,
    setLoading,
  ]);

  React.useEffect(() => {
    if (posts.length === 0) fetchMore();
  }, [fetchMore, posts.length]);

  return { posts, isLoading, fetchMore };
}
