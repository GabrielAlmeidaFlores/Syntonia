import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github-dark.css";

import { Spinner } from "@/components/shared/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { formatRelativeTime } from "@/lib/utils";
import { api } from "@/services/api";
import type { Post } from "@/types";

/**
 * Deep-link single post page at /post/:id.
 *
 * Calls GET /post/:id — MSW intercepts and returns the full post object
 * (including Markdown content) from MOCK_POSTS. In production the request
 * goes to the real API Gateway → Lambda → DynamoDB GetItem.
 */
export default function PostPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useTranslation();

  const [post, setPost] = React.useState<Post | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (id === undefined) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    void api
      .get<Post>(`/post/${id}`)
      .then((data) => {
        setPost(data);
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-surface">
        <Spinner size="lg" />
      </div>
    );
  }

  if (notFound || post === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-surface px-6">
        <p className="font-semibold text-content-primary">{t.post.notFound}</p>
        <Button
          variant="ghost"
          onClick={() => {
            navigate("/feed");
          }}
        >
          {t.post.backToFeed}
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      className="flex min-h-dvh flex-col bg-surface"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <div className="sticky top-0 z-10 flex items-center border-b border-surface-border bg-surface/80 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            navigate(-1);
          }}
          className="flex items-center gap-1.5 text-sm text-content-muted transition-colors hover:text-content-primary"
          aria-label={t.post.ariaBack}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t.post.back}
        </button>
      </div>

      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(to right, ${post.gradient[0]}, ${post.gradient[1]})`,
        }}
      />

      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
        <div className="mb-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="accent">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="mb-2 text-2xl font-bold leading-tight text-content-primary">
          {post.title}
        </h1>
        <p className="mb-2 text-sm text-content-muted">{post.summary}</p>
        <p className="mb-6 text-xs text-content-subtle">
          {formatRelativeTime(post.createdAt)}
        </p>

        <div
          className="mb-6 h-0.5 w-16 rounded-full"
          style={{
            background: `linear-gradient(to right, ${post.gradient[0]}, ${post.gradient[1]})`,
          }}
        />

        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {post.content}
          </ReactMarkdown>
        </div>
      </article>
    </motion.div>
  );
}
