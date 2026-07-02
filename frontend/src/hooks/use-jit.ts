import * as React from 'react';

import { JIT_GENERATION_DELAY_MS, TRIGGER_THRESHOLD } from '@/lib/constants';
import { api } from '@/services/api';
import { useFeedStore } from '@/stores/feed';
import { useUserStore } from '@/stores/user';
import type { GenerationResponse } from '@/types';

/**
 * Just-in-Time (JIT) generation hook.
 *
 * Watches `currentIndex` and triggers background post generation when fewer
 * than TRIGGER_THRESHOLD posts remain in the buffer.
 *
 * Sends POST /feed/request to the mock backend. MSW intercepts and returns 202
 * ACCEPTED immediately. After the simulated generation delay (JIT_GENERATION_DELAY_MS),
 * the hook resets the generating flag — the next scroll event will trigger
 * fetchMore via useFeed to pull the newly "available" posts.
 *
 * In production, POST /feed/request enqueues a real SQS message which triggers
 * workerInternal → Gemini → DynamoDB. The subsequent fetchMore call will then
 * retrieve the genuinely generated posts.
 */
export function useJIT(currentIndex: number, totalPosts: number): void {
  const isGenerating = React.useRef(false);
  const { activeTags } = useUserStore();
  const setLoading = useFeedStore((s) => s.setLoading);

  React.useEffect(() => {
    const postsRemaining = totalPosts - currentIndex;

    if (postsRemaining > TRIGGER_THRESHOLD || isGenerating.current || totalPosts === 0) return;

    isGenerating.current = true;
    setLoading(true);

    const generate = async (): Promise<void> => {
      await api.post<GenerationResponse>('/feed/request', { tags: activeTags, quantity: 3 });

      await new Promise<void>((resolve) => {
        setTimeout(resolve, JIT_GENERATION_DELAY_MS);
      });

      setLoading(false);

      setTimeout(() => {
        isGenerating.current = false;
      }, 10_000);
    };

    void generate();
  }, [currentIndex, totalPosts, activeTags, setLoading]);
}
