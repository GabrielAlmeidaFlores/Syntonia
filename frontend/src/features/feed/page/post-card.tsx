import { AnimatePresence, motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import * as React from "react";

import { PostDetail } from "./post-detail";

import { Badge } from "@/components/ui/badge";
import { useHorizontalSwipe } from "@/hooks/use-horizontal-swipe";
import { useTranslation } from "@/hooks/use-translation";
import { useFeedStore } from "@/stores/feed";
import type { Post } from "@/types";

interface PostCardProps {
  readonly post: Post;
  readonly index: number;
  /** Controls how PostDetail animates in/out.
   *  - 'slide' (default): slides in from the right — used in the main feed.
   *  - 'expand': scales up from the center with a fade — used in the saved feed. */
  readonly detailVariant?: "slide" | "expand";
}

/**
 * Full-screen snap-scroll post card.
 *
 * Navigation:
 *   - Swipe LEFT on the gradient card → opens PostDetail.
 *   - Tap "Read" button → opens PostDetail.
 *   - Swipe RIGHT inside PostDetail → closes PostDetail.
 *   - Tap "Back" button inside PostDetail → closes PostDetail.
 *
 * Swipe detection is handled by `useHorizontalSwipe`, which uses
 * `setPointerCapture` + `preventDefault` on confirmed horizontal gestures
 * so vertical snap-scroll is never interrupted.
 *
 * While PostDetail is open, `isPostExpanded` is set in useFeedStore so the
 * snap container locks its own scroll.
 */
export function PostCard({
  post,
  index,
  detailVariant = "slide",
}: PostCardProps): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const bgRef = React.useRef<HTMLDivElement>(null);
  const detailRef = React.useRef<HTMLDivElement>(null);
  const setPostExpanded = useFeedStore((s) => s.setPostExpanded);
  const t = useTranslation();

  const open = React.useCallback((): void => {
    setExpanded(true);
    setPostExpanded(true);
  }, [setPostExpanded]);

  const close = React.useCallback((): void => {
    setExpanded(false);
    setPostExpanded(false);
  }, [setPostExpanded]);

  const background = `linear-gradient(135deg, ${post.gradient[0]}, ${post.gradient[1]})`;

  useHorizontalSwipe(bgRef, { direction: "left", onSwipe: open });
  useHorizontalSwipe(detailRef, {
    direction: "right",
    enabled: expanded,
    onSwipe: close,
  });

  return (
    <div
      data-index={index}
      className="snap-card relative h-full flex-shrink-0 overflow-hidden"
      aria-label={t.feed.ariaPost(post.title)}
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
                className="border-0 bg-white/20 text-white backdrop-blur-sm text-xs"
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
            onClick={open}
            className="mt-2 flex items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-white/20 active:bg-white/30"
            aria-label={t.feed.ariaReadFull}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            {t.feed.readButton}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded &&
          (detailVariant === "expand" ? (
            <motion.div
              ref={detailRef}
              initial={{
                opacity: 0,
                scale: 0.18,
                borderRadius: "24px",
              }}
              animate={{
                opacity: 1,
                scale: 1,
                borderRadius: "0px",
              }}
              exit={{
                opacity: 0,
                scale: 0.18,
                borderRadius: "24px",
              }}
              transition={{
                type: "spring",
                damping: 22,
                stiffness: 190,
                opacity: { duration: 0.18, ease: "easeOut" },
                borderRadius: { duration: 0.3 },
              }}
              style={{ originX: 0.5, originY: 0.5 }}
              className="absolute inset-0 z-10 overflow-y-auto overscroll-y-contain bg-surface scrollbar-thin"
            >
              <PostDetail post={post} onClose={close} />
            </motion.div>
          ) : (
            <motion.div
              ref={detailRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="absolute inset-0 z-10 overflow-y-auto overscroll-y-contain bg-surface scrollbar-thin"
            >
              <PostDetail post={post} onClose={close} />
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
