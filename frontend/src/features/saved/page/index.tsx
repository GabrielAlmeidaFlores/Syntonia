import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, RotateCcw } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { SavedPostCard } from "./saved-post-card";

import { Skeleton } from "@/components/ui/skeleton";
import { PostDetail } from "@/features/feed/page/post-detail";
import { useSavedPosts } from "@/hooks/use-saved-posts";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { useSavedStore } from "@/stores/saved";
import type { Post } from "@/types";

/** Stagger variants for the saved grid. */
const gridContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const gridItemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

interface ExpandedOverlayProps {
  readonly post: Post;
  readonly onClose: () => void;
}

/**
 * Full-screen overlay rendered via React Portal directly in document.body.
 *
 * Gesture is tracked at the document level with pointermove passive:false so
 * we can call preventDefault() when horizontal intent is detected, preventing
 * the browser from converting the gesture to a scroll (which fires pointercancel
 * instead of pointerup, making the gesture undetectable).
 *
 * Right-to-left swipe (dx < -50, clearly more horizontal than vertical) closes.
 */
function ExpandedOverlay({
  post,
  onClose,
}: ExpandedOverlayProps): React.JSX.Element {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay === null) return;

    let startX = 0;
    let startY = 0;
    let active = false;
    let directionLocked = false;
    let horizontal = false;

    const onDown = (e: PointerEvent): void => {
      startX = e.clientX;
      startY = e.clientY;
      directionLocked = false;
      horizontal = false;
      active = overlay.contains(e.target as Node);
    };

    const onMove = (e: PointerEvent): void => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!directionLocked && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        directionLocked = true;
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
      if (horizontal && dx > 50) {
        onClose();
      }
      horizontal = false;
      directionLocked = false;
    };

    const onCancel = (): void => {
      active = false;
      horizontal = false;
      directionLocked = false;
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointercancel", onCancel, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, [onClose]);

  return createPortal(
    <motion.div
      ref={overlayRef}
      className="fixed inset-0 bg-surface"
      style={{ zIndex: 9999 }}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 280 }}
    >
      <div className="h-full overflow-y-auto overscroll-y-contain scrollbar-thin">
        <PostDetail post={post} onClose={onClose} />
      </div>
    </motion.div>,
    document.body,
  );
}

interface PageHeaderProps {
  readonly title: string;
  readonly onReload: () => void;
  readonly isLoading: boolean;
  readonly reloadLabel: string;
}

/** Page header shared across all saved-grid states (loading / empty / populated). */
function PageHeader({
  title,
  onReload,
  isLoading,
  reloadLabel,
}: PageHeaderProps): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-4">
      <h1 className="text-lg font-bold text-content-primary">{title}</h1>
      <button
        type="button"
        onClick={onReload}
        disabled={isLoading}
        aria-label={reloadLabel}
        className="rounded-lg p-1.5 text-content-subtle transition-colors hover:text-content-primary disabled:opacity-40"
      >
        <RotateCcw
          className={cn("h-4 w-4", isLoading && "animate-spin")}
          aria-hidden
        />
      </button>
    </div>
  );
}

/**
 * Grid view of the user's saved posts.
 * Clicking a card expands it with a slide-from-right animation.
 * Cards animate in with a stagger effect on load.
 * A Reload button in the header lets the user manually refresh from the backend.
 */
export default function SavedGridPage(): React.JSX.Element {
  const posts = useSavedStore((s) => s.posts);
  const { isLoading, refresh } = useSavedPosts();
  const t = useTranslation();

  const [expandedPost, setExpandedPost] = React.useState<Post | null>(null);

  const handleExpand = React.useCallback((post: Post): void => {
    setExpandedPost(post);
  }, []);

  const handleClose = React.useCallback((): void => {
    setExpandedPost(null);
  }, []);

  const title = isLoading || posts.length === 0
    ? t.saved.title
    : t.saved.titleWithCount(posts.length);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <PageHeader
          title={title}
          onReload={refresh}
          isLoading={isLoading}
          reloadLabel={t.common.reload}
        />
        <div className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={String(i)} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader
          title={title}
          onReload={refresh}
          isLoading={isLoading}
          reloadLabel={t.common.reload}
        />
        <motion.div
          className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <Bookmark className="h-10 w-10 text-content-subtle" aria-hidden />
          <p className="text-base font-semibold text-content-primary">
            {t.saved.emptyHeading}
          </p>
          <p className="text-sm text-content-muted">
            {t.saved.emptyDescription}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-y-auto">
        <PageHeader
          title={title}
          onReload={refresh}
          isLoading={isLoading}
          reloadLabel={t.common.reload}
        />

        <motion.div
          className="grid grid-cols-2 gap-3 px-4 pb-4"
          variants={gridContainerVariants}
          initial="hidden"
          animate="visible"
          layout
        >
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                layout
                variants={gridItemVariants}
                whileTap={{ scale: 0.95 }}
                exit={{
                  opacity: 0,
                  scale: 0.82,
                  transition: { duration: 0.18, ease: "easeIn" },
                }}
                transition={{
                  layout: { type: "spring", damping: 26, stiffness: 300 },
                  scale: { duration: 0.12 },
                }}
                role="presentation"
              >
                <SavedPostCard
                  post={post}
                  onCardClick={() => {
                    handleExpand(post);
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {expandedPost !== null && (
          <ExpandedOverlay post={expandedPost} onClose={handleClose} />
        )}
      </AnimatePresence>
    </>
  );
}
