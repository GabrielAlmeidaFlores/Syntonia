import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { markPostSaved, ConditionalCheckFailedException } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, notFound, serverError } from '../shared/http/response.js';

/** POST /post/{id}/save */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('savePost', ctx);

  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.['id'];

    log.info('Save post requested', { userId, postId });

    if (postId === undefined || postId === '') {
      log.warn('Missing postId in path parameters', { userId });
      return notFound(event, 'Post not found', 'POST_NOT_FOUND');
    }

    const savedAt = await markPostSaved(postId, userId);

    log.info('Post saved', { userId, postId, savedAt });
    return ok(event, { savedAt });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof ConditionalCheckFailedException) {
      const postId = event.pathParameters?.['id'];
      log.warn('Post not found or access denied during save', { userId: event.requestContext.authorizer?.['claims']?.['sub'], postId });
      return notFound(event, 'Post not found', 'POST_NOT_FOUND');
    }
    log.error('savePost failed', err);
    return serverError(event, err);
  }
};
