import { ArrowLeft, Bookmark, BookmarkCheck, Share2 } from 'lucide-react';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github-dark.css';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { formatRelativeTime } from '@/lib/utils';
import { api } from '@/services/api';
import { useSavedStore } from '@/stores/saved';
import { useToastStore } from '@/stores/toast';
import type { Post, SavePostResponse, UnsavePostResponse } from '@/types';

interface PostDetailProps {
  readonly post: Post;
  readonly onClose: () => void;
}

/**
 * Full-screen post detail panel that slides in from the right.
 * Renders the post's Markdown content with syntax-highlighted code blocks.
 * Includes a save/unsave bookmark toggle that calls POST|DELETE /post/:id/save.
 */
export function PostDetail({ post, onClose }: PostDetailProps): React.JSX.Element {
  const isSaved = useSavedStore((s) => s.isSaved(post.id));
  const storeSave = useSavedStore((s) => s.save);
  const storeUnsave = useSavedStore((s) => s.unsave);
  const addToast = useToastStore((s) => s.addToast);
  const [toggling, setToggling] = React.useState(false);
  const t = useTranslation();

  const handleToggleSave = React.useCallback((): void => {
    if (toggling) return;
    setToggling(true);
    if (isSaved) {
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
          setToggling(false);
        });
    } else {
      void api
        .post<SavePostResponse>(`/post/${post.id}/save`, {})
        .then((res) => {
          storeSave(post, res.savedAt);
          addToast({ type: 'success', message: t.saved.toastSaved });
        })
        .catch(() => {
          addToast({ type: 'error', message: t.saved.toastSaveError });
        })
        .finally(() => {
          setToggling(false);
        });
    }
  }, [toggling, isSaved, post, storeSave, storeUnsave, addToast, t]);

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-surface/80 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-content-muted hover:text-content-primary transition-colors"
          aria-label={t.postDetail.ariaBack}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t.postDetail.back}
        </button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSave}
            disabled={toggling}
            aria-label={isSaved ? t.postDetail.ariaUnsave : t.postDetail.ariaSave}
            aria-pressed={isSaved}
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4 text-accent-light" aria-hidden />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden />
            )}
          </Button>

          <Button variant="ghost" size="sm" aria-label={t.postDetail.ariaShare}>
            <Share2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <article className="flex-1 px-5 py-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="accent">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="mb-2 text-2xl font-bold leading-tight text-content-primary">{post.title}</h1>
        <p className="mb-4 text-sm text-content-muted">{post.summary}</p>
        <p className="mb-6 text-xs text-content-subtle">{formatRelativeTime(post.createdAt)}</p>

        <div
          className="mb-6 h-0.5 w-16 rounded-full"
          style={{
            background: `linear-gradient(to right, ${post.gradient[0]}, ${post.gradient[1]})`,
          }}
        />

        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {post.content ?? post.summary}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}

