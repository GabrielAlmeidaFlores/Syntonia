import { v4 as uuidv4 } from 'uuid';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { countPendingRequests, getUser, saveRequest } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { sendGenerationRequest } from '../shared/queue/sqs.js';
import { checkRateLimit, RateLimitError } from '../shared/http/rateLimit.js';
import { accepted, badRequest, unauthorized, tooManyRequests, serverError } from '../shared/http/response.js';
import { validate, feedRequestSchema, ValidationError } from '../shared/http/validators.js';
import type { RequestItem } from '../shared/core/types.js';

const MAX_PENDING_PER_USER = 5;
const AI_RATE_LIMIT = { max: 10, windowSeconds: 3600 };
const API_RATE_LIMIT = { max: 100, windowSeconds: 900 };

/** POST /feed/request — queues JIT content generation. */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('requestPost', ctx);
  const stop = log.timer();

  try {
    const userId = getUserId(event);

    log.debug('Checking API rate limit', { userId, max: API_RATE_LIMIT.max, windowSeconds: API_RATE_LIMIT.windowSeconds });
    await checkRateLimit(`API_REQUEST#${userId}`, API_RATE_LIMIT);

    log.debug('Checking AI generation rate limit', { userId, max: AI_RATE_LIMIT.max, windowSeconds: AI_RATE_LIMIT.windowSeconds });
    await checkRateLimit(`AI_GENERATION#${userId}`, AI_RATE_LIMIT);

    const body = JSON.parse(event.body ?? '{}') as unknown;
    const parsed = validate(feedRequestSchema, body);
    const tags = parsed.tags;
    const quantity = parsed.quantity ?? 3;

    log.info('Generation requested', { userId, tags, quantity });

    const pendingCount = await countPendingRequests(userId);
    log.debug('Pending request count checked', { userId, pendingCount, max: MAX_PENDING_PER_USER });

    if (pendingCount >= MAX_PENDING_PER_USER) {
      log.warn('Generation limit reached', { userId, pendingCount, max: MAX_PENDING_PER_USER });
      return tooManyRequests(
        event,
        `Please wait: you have ${String(pendingCount)} generations in progress.`,
        'GENERATION_LIMIT_REACHED',
      );
    }

    const user = await getUser(userId);
    const description = user?.description ?? null;
    log.debug('User description fetched for prompt enrichment', { userId, hasDescription: description !== null });

    const requests = await Promise.all(
      Array.from({ length: quantity }, async () => {
        const requestId = uuidv4();

        log.debug('Sending SQS message', { userId, requestId, tags });
        const sqsMessageId = await sendGenerationRequest({ requestId, userId, tags, description });
        log.debug('SQS message sent', { userId, requestId, sqsMessageId });

        const request: RequestItem = {
          id: requestId,
          userId,
          tags,
          sqsMessageId,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 259_200,
        };

        await saveRequest(request);
        return request;
      }),
    );

    const requestIds = requests.map((r) => r.id);
    stop('Generation requests queued', { userId, quantity, requestIds, tags });

    return accepted(event, { requestIds, status: 'PENDING' });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof RateLimitError) {
      log.warn('Rate limit exceeded', { error: err.message });
      return tooManyRequests(event, err.message);
    }
    if (err instanceof ValidationError) {
      log.warn('Validation failed', { error: err.message });
      return badRequest(event, err.message);
    }
    log.error('requestPost failed', err);
    return serverError(event, err);
  }
};
