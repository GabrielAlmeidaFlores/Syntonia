import * as React from 'react';

import { JIT_GENERATION_DELAY_MS, TRIGGER_THRESHOLD } from '@/lib/constants';
import { sleep } from '@/lib/utils';
import { MOCK_POSTS } from '@/mocks/data';
import { useFeedStore } from '@/stores/feed';
import { useUserStore } from '@/stores/user';

/**
 * Just-in-Time (JIT) generation hook.
 *
 * Triggers background post generation when fewer than TRIGGER_THRESHOLD posts
 * remain in the buffer. Simulates POST /feed/request → SQS → Gemini → DynamoDB
 * by appending shuffled mock posts after a short delay.
 */
export function useJIT(currentIndex: number, totalPosts: number): void {
  const isGenerating = React.useRef(false);
  const { activeTags } = useUserStore();
  const appendPosts = useFeedStore((s) => s.appendPosts);
  const setLoading = useFeedStore((s) => s.setLoading);

  React.useEffect(() => {
    const postsRemaining = totalPosts - currentIndex;

    if (postsRemaining > TRIGGER_THRESHOLD || isGenerating.current || totalPosts === 0) return;

    isGenerating.current = true;
    setLoading(true);

    void sleep(JIT_GENERATION_DELAY_MS).then(() => {
      const relevant = MOCK_POSTS.filter((p) =>
        p.tags.some((t) => activeTags.includes(t)),
      );

      const pool = relevant.length > 0 ? relevant : MOCK_POSTS;
      const newPosts = [...pool]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((p) => ({
          ...p,
          id: `${p.id}-jit-${Date.now().toString()}`,
          createdAt: new Date().toISOString(),
        }));

      appendPosts(newPosts);
      setLoading(false);

      setTimeout(() => {
        isGenerating.current = false;
      }, 10_000);
    });
  }, [currentIndex, totalPosts, activeTags, appendPosts, setLoading]);
}
