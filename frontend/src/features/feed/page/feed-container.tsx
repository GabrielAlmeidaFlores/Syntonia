import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

import { PostCard } from "./post-card";

import { EmptyFeedScreen } from "@/components/shared/empty-feed-screen";
import { FeedInitialLoading } from "@/components/shared/feed-initial-loading";
import { useSnapNavigation } from "@/hooks/use-snap-navigation";
import { useFeedStore } from "@/stores/feed";
import type { Post } from "@/types";

/** Minimum ms the initial loading screen stays visible so the animation plays fully. */
const MIN_LOADING_MS = 1400;

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
 * Loading states:
 *   - First load: shows FeedInitialLoading for at least MIN_LOADING_MS.
 *     `showLoading` starts as true and only turns false when BOTH conditions
 *     are met: posts have arrived AND the minimum time has elapsed.
 *   - JIT load (posts > 0 + isLoading): shows FeedInitialLoading as the last
 *     snap card so the user sees the same polished screen while waiting.
 *
 * AnimatePresence wraps the loading screen for a smooth fade-out when the
 * first batch of posts arrives.
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

  const mountTimeRef = React.useRef(Date.now());
  const [showLoading, setShowLoading] = React.useState(true);

  React.useEffect(() => {
    if (posts.length === 0) return;
    const elapsed = Date.now() - mountTimeRef.current;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
    const timer = setTimeout(() => {
      setShowLoading(false);
    }, remaining);
    return () => {
      clearTimeout(timer);
    };
  }, [posts.length]);

  useSnapNavigation(containerRef);

  React.useEffect(() => {
    return () => {
      setPostExpanded(false);
    };
  }, [setPostExpanded]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;
    el.style.overflowY = isPostExpanded ? "hidden" : "";
  }, [isPostExpanded]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            setCurrentIndex(idx);
          }
        }
      },
      { threshold: 0.7 },
    );

    const cards = containerRef.current?.querySelectorAll("[data-index]") ?? [];
    for (const card of cards) observer.observe(card);

    return () => {
      observer.disconnect();
    };
  }, [posts.length, setCurrentIndex]);

  if (posts.length === 0 && !isLoading && !showLoading) {
    return (
      <div className="snap-card h-full flex items-center justify-center">
        <EmptyFeedScreen onReload={onReload} />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <AnimatePresence>
        {showLoading && posts.length === 0 && (
          <motion.div
            key="initial-loading"
            className="absolute inset-0 z-10"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <FeedInitialLoading />
          </motion.div>
        )}
      </AnimatePresence>

      {(!showLoading || posts.length > 0) && (
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
              <FeedInitialLoading />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
