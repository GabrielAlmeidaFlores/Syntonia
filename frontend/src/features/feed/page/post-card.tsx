import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import * as React from 'react';

import { PostDetail } from './post-detail';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Post } from '@/types';

interface PostCardProps {
  readonly post: Post;
  readonly index: number;
}

/**
 * Full-screen snap-scroll post card.
 *
 * Opens PostDetail via:
 *   - Left-swipe on desktop (mouse drag) or mobile (touch).
 *     Uses native addEventListener with passive:false on pointermove so we can
 *     call preventDefault() when the gesture is clearly horizontal, blocking the
 *     snap-scroll from consuming the event.
 *   - Tapping the "Read" button.
 */
export function PostCard({ post, index }: PostCardProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const bgRef = React.useRef<HTMLDivElement>(null);

  const background = `linear-gradient(135deg, ${post.gradient[0]}, ${post.gradient[1]})`;

  React.useEffect(() => {
    const el = bgRef.current;
    if (el === null) return;

    let startX = 0;
    let startY = 0;
    let active = false;
    let horizontal = false;

    const onDown = (e: PointerEvent): void => {
      startX = e.clientX;
      startY = e.clientY;
      active = true;
      horizontal = false;
    };

    const onMove = (e: PointerEvent): void => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        horizontal = Math.abs(dx) > Math.abs(dy);
      }

      if (horizontal) {
        e.preventDefault();
      }
    };

    const onUp = (e: PointerEvent): void => {
      if (!active) return;
      active = false;
      const dx = e.clientX - startX;
      if (horizontal && dx < -50) {
        setExpanded(true);
      }
      horizontal = false;
    };

    const onCancel = (): void => {
      active = false;
      horizontal = false;
    };

    el.addEventListener('pointerdown', onDown, { passive: true });
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp, { passive: true });
    el.addEventListener('pointercancel', onCancel, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  return (
    <div
      data-index={index}
      className={cn(
        'relative flex-shrink-0 overflow-hidden',
        expanded ? 'snap-none h-dvh' : 'snap-card',
      )}
      aria-label={`Post: ${post.title}`}
    >
      <div
        ref={bgRef}
        style={{ background }}
        className="absolute inset-0 flex flex-col justify-end"
      >
        <div className="absolute inset-0 card-overlay" />

        <div className="relative flex flex-col gap-3 p-6 pb-24">
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge
                key={tag}
                className={cn('border-0 bg-white/20 text-white backdrop-blur-sm text-xs')}
              >
                {tag}
              </Badge>
            ))}
          </div>

          <h2 className="text-2xl font-bold text-white leading-tight text-balance">
            {post.title}
          </h2>

          <p className="text-sm text-white/80 line-clamp-2">{post.summary}</p>

          <button
            type="button"
            onClick={() => {
              setExpanded(true);
            }}
            className="mt-2 flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 active:bg-white/30"
            aria-label="Read full post"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            Read
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute inset-0 z-10 overflow-y-auto overscroll-y-contain bg-surface scrollbar-thin"
          >
            <PostDetail
              post={post}
              onClose={() => {
                setExpanded(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
