import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { getSavedByUser } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, serverError } from '../shared/http/response.js';

/** GET /posts/saved?limit=12&cursor=... */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('getSavedPosts', ctx);
  const stop = log.timer();

  try {
    const userId = getUserId(event);
    const limit = Math.min(Number(event.queryStringParameters?.['limit'] ?? 12), 50);
    const cursor = event.queryStringParameters?.['cursor'] ?? null;

    log.info('Saved posts requested', { userId, limit, hasCursor: cursor !== null });

    const { items, cursor: nextCursor } = await getSavedByUser(userId, limit, cursor);

    stop('Saved posts query completed', { userId, limit, count: items.length, hasMore: nextCursor !== null });

    return ok(event, { posts: items, cursor: nextCursor, hasMore: nextCursor !== null });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    log.error('getSavedPosts failed', err);
    return serverError(event, err);
  }
};
