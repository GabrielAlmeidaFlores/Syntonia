import { AnimatePresence, motion, useMotionValue } from 'framer-motion';
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
 * Displays the post title, summary, and tags over a gradient background.
 * Dragging left more than 80px opens the full PostDetail panel.
 */
export function PostCard({ post, index }: PostCardProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const x = useMotionValue(0);

  const background = `linear-gradient(135deg, ${post.gradient[0]}, ${post.gradient[1]})`;

  return (
    <div
      data-index={index}
      className="snap-card relative flex-shrink-0 overflow-hidden"
      aria-label={`Post: ${post.title}`}
    >
      <motion.div
        style={{ x, background }}
        drag="x"
        dragConstraints={{ left: -320, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) setExpanded(true);
        }}
        className="absolute inset-0 flex flex-col justify-end"
      >
        <div className="absolute inset-0 card-overlay" />

        <div className="relative flex flex-col gap-3 p-6 pb-8">
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

          <p className="text-xs text-white/40 mt-1">← swipe to read</p>
        </div>
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute inset-0 overflow-y-auto bg-surface scrollbar-thin"
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
