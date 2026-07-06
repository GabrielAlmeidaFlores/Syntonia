import * as React from "react";

import { useTranslation } from "@/hooks/use-translation";
import {
  FEED_PAGE_SIZE,
  JIT_GENERATION_DELAY_MS,
  TRIGGER_THRESHOLD,
} from "@/lib/constants";
import { VITE_MODE } from "@/lib/env";
import { api, getApiErrorMessage } from "@/services/api";
import { useFeedStore } from "@/stores/feed";
import { useToastStore } from "@/stores/toast";
import { useUserStore } from "@/stores/user";
import type { FeedResponse, GenerationResponse } from "@/types";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_ATTEMPTS = 18;

/**
 * Polls GET /feed every POLL_INTERVAL_MS until new posts arrive in DynamoDB
 * or MAX_POLL_ATTEMPTS is exhausted (90 seconds total).
 * Updates the feed store directly when posts are detected.
 */
async function pollUntilPostsArrive(prevCount: number): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, POLL_INTERVAL_MS);
    });

    try {
      const snapshot = useFeedStore.getState();
      if (snapshot.posts.length > prevCount) return;

      const data = await api.get<FeedResponse>(
        `/feed?limit=${String(FEED_PAGE_SIZE)}`,
      );

      if (data.posts.length > 0) {
        const { setPosts, appendPosts, setCursor } = useFeedStore.getState();
        if (prevCount === 0) {
          setPosts(data.posts);
        } else {
          const existingIds = new Set(
            useFeedStore.getState().posts.map((p) => p.id),
          );
          const fresh = data.posts.filter((p) => !existingIds.has(p.id));
          if (fresh.length > 0) appendPosts(fresh);
        }
        setCursor(data.cursor);
        return;
      }
    } catch {
      void 0;
    }
  }
}

/**
 * Just-in-Time (JIT) generation hook.
 *
 * Watches `currentIndex` and triggers background post generation when fewer
 * than TRIGGER_THRESHOLD posts remain in the buffer — including when the
 * buffer is completely empty (first load for a new user).
 *
 * In development, uses a fixed simulated delay (MSW intercepts the request).
 * In production, polls GET /feed after POST /feed/request until new posts
 * arrive from the Gemini worker, updating the feed store automatically.
 */
export function useJIT(currentIndex: number, totalPosts: number): void {
  const isGenerating = React.useRef(false);
  const activeTags = useUserStore((s) => s.activeTags);
  const setLoading = useFeedStore((s) => s.setLoading);
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  React.useEffect(() => {
    const postsRemaining = totalPosts - currentIndex;

    if (
      postsRemaining > TRIGGER_THRESHOLD ||
      isGenerating.current ||
      activeTags.length === 0
    )
      return;

    isGenerating.current = true;
    setLoading(true);

    const generate = async (): Promise<void> => {
      try {
        await api.post<GenerationResponse>("/feed/request", {
          tags: activeTags,
          quantity: 3,
        });

        if (VITE_MODE === "development") {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, JIT_GENERATION_DELAY_MS);
          });
        } else {
          await pollUntilPostsArrive(totalPosts);
        }
      } catch (err) {
        addToast({ type: "error", message: getApiErrorMessage(err, t.errors) });
      } finally {
        setLoading(false);
        setTimeout(() => {
          isGenerating.current = false;
        }, 10_000);
      }
    };

    void generate();
  }, [currentIndex, totalPosts, activeTags, setLoading, addToast, t.errors]);
}
