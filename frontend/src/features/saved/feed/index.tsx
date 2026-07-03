import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PostCard } from '@/features/feed/page/post-card';
import { useSnapNavigation } from '@/hooks/use-snap-navigation';
import { useTranslation } from '@/hooks/use-translation';
import { useFeedStore } from '@/stores/feed';
import { useSavedStore } from '@/stores/saved';

/**
 * Snap-scroll feed view of the user's saved posts.
 * Navigated to from SavedGridPage — the optional ?start=post-id param
 * scrolls the list to begin at a specific post.
 *
 * Reuses the same PostCard component as the main feed, so the bookmark
 * toggle in PostDetail works identically here.
 *
 * When `isPostExpanded` is true (a PostDetail is open), `overflowY` is set
 * directly via the DOM ref to lock the snap container — bypassing CSS cascade
 * so `snap-feed`'s `overflow-y: scroll` cannot override the lock.
 */
export default function SavedFeedPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const posts = useSavedStore((s) => s.posts);
  const isPostExpanded = useFeedStore((s) => s.isPostExpanded);
  const setPostExpanded = useFeedStore((s) => s.setPostExpanded);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const t = useTranslation();

  useSnapNavigation(containerRef);

  const startId = searchParams.get('start');

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
    if (startId === null || containerRef.current === null) return;
    const index = posts.findIndex((p) => p.id === startId);
    if (index <= 0) return;
    const cards = containerRef.current.querySelectorAll('[data-index]');
    const target = cards[index];
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }, [startId, posts]);

  if (posts.length === 0) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface px-6">
        <p className="text-sm text-content-muted">{t.saved.noSavedPosts}</p>
        <button
          type="button"
          onClick={() => {
            navigate('/saved');
          }}
          className="text-sm text-accent-light underline"
          aria-label={t.saved.ariaBack}
        >
          {t.saved.backButton}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="relative h-dvh bg-surface"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
    >
      <button
        type="button"
        onClick={() => {
          navigate('/saved');
        }}
        className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60"
        aria-label={t.saved.ariaBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {t.saved.backButton}
      </button>

      <div ref={containerRef} tabIndex={0} className="snap-feed h-dvh outline-none">
        {posts.map((post, i) => (
          <PostCard key={post.id} post={post} index={i} detailVariant="expand" />
        ))}
      </div>
    </motion.div>
  );
}
