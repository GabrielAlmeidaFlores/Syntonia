import * as React from 'react';

import { PostCard } from './post-card';

import { EmptyFeedScreen } from '@/components/shared/empty-feed-screen';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { useFeedStore } from '@/stores/feed';
import type { Post } from '@/types';

interface FeedContainerProps {
  readonly posts: Post[];
  readonly isLoading: boolean;
  readonly onReload: () => void;
}

/**
 * Snap-scroll feed container.
 *
 * Uses IntersectionObserver to track the current visible card and update
 * `currentIndex` in the feed store, which drives the JIT generation trigger.
 */
export function FeedContainer({
  posts,
  isLoading,
  onReload,
}: FeedContainerProps): React.JSX.Element {
  const setCurrentIndex = useFeedStore((s) => s.setCurrentIndex);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'));
            setCurrentIndex(idx);
          }
        }
      },
      { threshold: 0.7 },
    );

    const cards = containerRef.current?.querySelectorAll('[data-index]') ?? [];
    for (const card of cards) observer.observe(card);

    return () => {
      observer.disconnect();
    };
  }, [posts.length, setCurrentIndex]);

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="snap-card flex items-center justify-center">
        <EmptyFeedScreen onReload={onReload} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="snap-feed h-full">
      {posts.map((post, idx) => (
        <PostCard key={post.id} post={post} index={idx} />
      ))}

      {isLoading && (
        <div className="snap-card">
          <LoadingSkeleton />
        </div>
      )}
    </div>
  );
}
