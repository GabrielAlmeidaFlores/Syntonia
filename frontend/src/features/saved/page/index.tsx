import { Bookmark } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import { SavedPostCard } from './saved-post-card';

import { Skeleton } from '@/components/ui/skeleton';
import { useSavedPosts } from '@/hooks/use-saved-posts';
import { useTranslation } from '@/hooks/use-translation';
import { useSavedStore } from '@/stores/saved';

/**
 * Grid view of the user's saved posts.
 * Fetches GET /posts/saved on mount via useSavedPosts.
 * Each card has an inline unsave button that calls DELETE /post/:id/save.
 * Tapping a card navigates to the full /saved/feed view starting from that post.
 */
export default function SavedGridPage(): React.JSX.Element {
  const navigate = useNavigate();
  const posts = useSavedStore((s) => s.posts);
  const { isLoading } = useSavedPosts();
  const t = useTranslation();

  const handleViewFeed = React.useCallback(
    (postId: string): void => {
      navigate(`/saved/feed?start=${postId}`);
    },
    [navigate],
  );

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto px-4 py-5">
        <h1 className="mb-4 text-lg font-bold text-content-primary">{t.saved.title}</h1>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <Bookmark className="h-10 w-10 text-content-subtle" aria-hidden />
        <p className="text-base font-semibold text-content-primary">{t.saved.emptyHeading}</p>
        <p className="text-sm text-content-muted">{t.saved.emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-5">
      <h1 className="mb-4 text-lg font-bold text-content-primary">{t.saved.titleWithCount(posts.length)}</h1>

      <div className="grid grid-cols-2 gap-3 pb-4">
        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => {
              handleViewFeed(post.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleViewFeed(post.id);
            }}
            role="presentation"
          >
            <SavedPostCard post={post} />
          </div>
        ))}
      </div>
    </div>
  );
}
