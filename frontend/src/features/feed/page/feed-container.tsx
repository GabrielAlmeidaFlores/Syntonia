import * as React from 'react';

import { PostCard } from './post-card';

import { EmptyFeedScreen } from '@/components/shared/empty-feed-screen';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { useSnapNavigation } from '@/hooks/use-snap-navigation';
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
 *
 * When `isPostExpanded` is true (a PostDetail is open), `overflowY` is set
 * directly via the DOM ref to lock the snap container — bypassing CSS cascade
 * so `snap-feed`'s `overflow-y: scroll` cannot override the lock.
 *
 * `useSnapNavigation` intercepts mouse wheel and keyboard events to provide
 * reliable card-to-card navigation on desktop.
 */
export function FeedContainer({
  posts,
  isLoading,
  onReload,
}: FeedContainerProps): React.JSX.Element {
  const setCurrentIndex = useFeedStore((s) => s.setCurrentIndex);
  const isPostExpanded = useFeedStore((s) => s.isPostExpanded);
  const setPostExpanded = useFeedStore((s) => s.setPostExpanded);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useSnapNavigation(containerRef);

  React.useEffect(() => {
    return () => {
      setPostExpanded(false);
    };
  }, [setPostExpanded]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;
    el.style.overflowY = isPostExpanded ? 'hidden' : '';
  }, [isPostExpanded]);

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
      <div className="snap-card h-full flex items-center justify-center">
        <EmptyFeedScreen onReload={onReload} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="snap-feed h-full outline-none"
    >
      {posts.map((post, idx) => (
        <PostCard key={post.id} post={post} index={idx} />
      ))}

      {isLoading && (
        <div className="snap-card h-full">
          <LoadingSkeleton />
        </div>
      )}
    </div>
  );
}
