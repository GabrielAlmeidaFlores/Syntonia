import { BookmarkX } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useSavedStore } from '@/stores/saved';
import { useToastStore } from '@/stores/toast';
import type { Post, UnsavePostResponse } from '@/types';

interface SavedPostCardProps {
  readonly post: Post;
}

/**
 * Compact grid card for a saved post.
 * Tapping the card body navigates to /post/:id.
 * The unsave button (bookmark-x icon) calls DELETE /post/:id/save immediately.
 */
export function SavedPostCard({ post }: SavedPostCardProps): React.JSX.Element {
  const navigate = useNavigate();
  const storeUnsave = useSavedStore((s) => s.unsave);
  const addToast = useToastStore((s) => s.addToast);
  const [unsaving, setUnsaving] = React.useState(false);
  const t = useTranslation();

  const background = `linear-gradient(135deg, ${post.gradient[0]}, ${post.gradient[1]})`;

  const handleUnsave = React.useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (unsaving) return;
      setUnsaving(true);
      void api
        .delete<UnsavePostResponse>(`/post/${post.id}/save`)
        .then(() => {
          storeUnsave(post.id);
          addToast({ type: 'success', message: t.saved.toastUnsaved });
        })
        .catch(() => {
          addToast({ type: 'error', message: t.saved.toastUnsaveError });
        })
        .finally(() => {
          setUnsaving(false);
        });
    },
    [unsaving, post.id, storeUnsave, addToast, t],
  );

  const handleNavigate = React.useCallback((): void => {
    navigate(`/post/${post.id}`);
  }, [navigate, post.id]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleNavigate();
      }}
      className="relative cursor-pointer overflow-hidden rounded-2xl"
      aria-label={t.saved.ariaReadCard(post.title)}
    >
      <div
        style={{ background }}
        className="relative flex aspect-[3/4] flex-col justify-end p-3"
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        <div className="relative flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                className={cn('border-0 bg-white/20 text-white backdrop-blur-sm text-[10px] px-1.5 py-0')}
              >
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-xs font-semibold leading-tight text-white line-clamp-3">
            {post.title}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleUnsave}
        disabled={unsaving}
        className={cn(
          'absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-opacity',
          unsaving ? 'opacity-40' : 'opacity-80 hover:opacity-100',
        )}
        aria-label={t.saved.ariaUnsave}
      >
        <BookmarkX className="h-3.5 w-3.5 text-white" aria-hidden />
      </button>
    </div>
  );
}
