import { ArrowLeft } from 'lucide-react';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import { MOCK_POSTS } from '@/mocks/data';

/**
 * Deep-link single post page at /post/:id.
 * Loads the post from MOCK_POSTS by ID; in production calls GET /post/:id.
 */
export default function PostPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const post = MOCK_POSTS.find((p) => p.id === id);

  if (post === undefined) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface px-6">
        <p className="font-semibold text-white">Post not found</p>
        <Button
          variant="ghost"
          onClick={() => {
            navigate('/feed');
          }}
        >
          Back to feed
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <div className="sticky top-0 z-10 flex items-center border-b border-surface-border bg-surface/80 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            navigate(-1);
          }}
          className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      </div>

      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(to right, ${post.gradient[0]}, ${post.gradient[1]})` }}
      />

      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="accent">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="mb-2 text-2xl font-bold leading-tight text-white">{post.title}</h1>
        <p className="mb-2 text-sm text-gray-400">{post.summary}</p>
        <p className="mb-6 text-xs text-gray-600">{formatRelativeTime(post.createdAt)}</p>

        <div
          className="mb-6 h-0.5 w-16 rounded-full"
          style={{ background: `linear-gradient(to right, ${post.gradient[0]}, ${post.gradient[1]})` }}
        />

        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
