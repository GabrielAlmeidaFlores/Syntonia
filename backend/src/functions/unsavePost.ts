import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { markPostUnsaved, ConditionalCheckFailedException } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, notFound, serverError } from '../shared/http/response.js';

/** DELETE /post/{id}/save */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('unsavePost', ctx);

  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.['id'];

    log.info('Unsave post requested', { userId, postId });

    if (postId === undefined || postId === '') {
      log.warn('Missing postId in path parameters', { userId });
      return notFound(event, 'Post not found in saved list', 'POST_NOT_SAVED');
    }

    await markPostUnsaved(postId, userId);

    log.info('Post unsaved — TTL restored to 30 days', { userId, postId });
    return ok(event, {});
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof ConditionalCheckFailedException) {
      const postId = event.pathParameters?.['id'];
      log.warn('Post not in saved list or access denied during unsave', { postId });
      return notFound(event, 'Post not found in saved list', 'POST_NOT_SAVED');
    }
    log.error('unsavePost failed', err);
    return serverError(event, err);
  }
};
