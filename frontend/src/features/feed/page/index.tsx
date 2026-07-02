import * as React from 'react';

import { FeedContainer } from './feed-container';

import { useFeed } from '@/hooks/use-feed';
import { useJIT } from '@/hooks/use-jit';
import { useFeedStore } from '@/stores/feed';

/**
 * Main feed page at /feed.
 *
 * Orchestrates the snap-scroll feed: useFeed loads the initial post batch,
 * useJIT triggers background generation when the buffer runs low, and
 * FeedContainer renders the scrollable PostCard list.
 */
export default function FeedPage(): React.JSX.Element {
  const { posts, isLoading, fetchMore } = useFeed();
  const currentIndex = useFeedStore((s) => s.currentIndex);

  useJIT(currentIndex, posts.length);

  return (
    <div className="h-full overflow-hidden">
      <FeedContainer posts={posts} isLoading={isLoading} onReload={fetchMore} />
    </div>
  );
}
