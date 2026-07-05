import { v4 as uuidv4 } from 'uuid';
import type { SQSEvent, Context } from 'aws-lambda';
import { putPost, updateRequestStatus, getRecentPostsByTags } from '../shared/db/index.js';
import { generatePost, GeminiError } from '../shared/ai/gemini.js';
import { createLogger } from '../shared/core/logger.js';
import type { GenerationMessage, PostItem, Tag } from '../shared/core/types.js';

const MAX_RETRIES = 3;

/** SQS trigger — GenerationQueue. Processes one generation request per invocation. */
export const handler = async (event: SQSEvent, ctx: Context): Promise<void> => {
  const log = createLogger('workerInternal', ctx);

  for (const record of event.Records) {
    const message = JSON.parse(record.body) as GenerationMessage;
    const { requestId, userId, tags, description } = message;

    const reqLog = log.child({ requestId, userId, tags, hasDescription: description !== null });
    const stop = reqLog.timer();

    reqLog.info('Processing generation request', { sqsMessageId: record.messageId });

    await updateRequestStatus(requestId, 'PROCESSING', {
      processingAt: new Date().toISOString(),
    });
    reqLog.debug('Request status set to PROCESSING');

    const dedupeStop = reqLog.timer();
    const recentPosts = await getRecentPostsByTags(userId, tags as Tag[], 90);
    const likedCount = recentPosts.filter((p) => p.likedAt !== undefined).length;
    dedupeStop('Deduplication context fetched', { recentPostCount: recentPosts.length, likedCount });

    if (recentPosts.length > 0) {
      reqLog.debug('Deduplication context', { recentTitles: recentPosts.map((p) => p.title) });
    }

    let attempt = 0;

    while (attempt < MAX_RETRIES) {
      const attemptLog = reqLog.child({ attempt: attempt + 1, maxRetries: MAX_RETRIES });
      const attemptStop = attemptLog.timer();

      try {
        attemptLog.info('Calling Gemini to generate post');

        const postData = await generatePost({ tags: tags as Tag[], description, recentPosts });

        attemptStop('Gemini generation completed', { title: postData.title, tags: postData.tags });

        const post: PostItem = {
          id: uuidv4(),
          userId,
          title: postData.title,
          summary: postData.summary,
          content: postData.content,
          tags: postData.tags,
          gradient: postData.gradient,
          createdAt: new Date().toISOString(),
          status: 'READY',
          ttl: Math.floor(Date.now() / 1000) + 7_776_000,
        };

        await putPost(post);
        attemptLog.debug('Post saved to SintoniaFeed', { postId: post.id });

        await updateRequestStatus(requestId, 'COMPLETED', {
          completedAt: new Date().toISOString(),
          postId: post.id,
          ttl: Math.floor(Date.now() / 1000) + 2_592_000,
        });

        stop('Generation request completed successfully', {
          postId: post.id,
          title: post.title,
          generatedTags: post.tags,
        });

        break;
      } catch (err) {
        attempt++;
        const isGemini = err instanceof GeminiError;

        attemptLog.warn('Generation attempt failed', {
          isGeminiError: isGemini,
          error: err instanceof Error ? err.message : String(err),
          willRetry: attempt < MAX_RETRIES,
        });

        if (attempt >= MAX_RETRIES) {
          reqLog.error('All generation attempts exhausted — marking FAILED', err, {
            totalAttempts: attempt,
            tags,
          });

          await updateRequestStatus(requestId, 'FAILED', {
            failedAt: new Date().toISOString(),
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
            ttl: Math.floor(Date.now() / 1000) + 604_800,
          });

          throw err;
        }

        const backoffMs = 1000 * Math.pow(2, attempt);
        attemptLog.debug(`Backing off before retry`, { backoffMs });

        await new Promise<void>((resolve) => {
          setTimeout(resolve, backoffMs);
        });
      }
    }
  }
};
