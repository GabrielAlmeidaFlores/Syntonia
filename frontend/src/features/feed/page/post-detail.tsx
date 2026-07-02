import { ArrowLeft, Share2 } from 'lucide-react';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github-dark.css';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import type { Post } from '@/types';

interface PostDetailProps {
  readonly post: Post;
  readonly onClose: () => void;
}

/**
 * Full-screen post detail panel that slides in from the right.
 * Renders the post's Markdown content with syntax-highlighted code blocks.
 */
export function PostDetail({ post, onClose }: PostDetailProps): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-border bg-surface/80 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          aria-label="Go back to feed"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>

        <Button variant="ghost" size="sm" aria-label="Share post">
          <Share2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <article className="flex-1 px-5 py-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="accent">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="mb-2 text-2xl font-bold leading-tight text-white">{post.title}</h1>
        <p className="mb-4 text-sm text-gray-400">{post.summary}</p>
        <p className="mb-6 text-xs text-gray-600">{formatRelativeTime(post.createdAt)}</p>

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
