import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { getPostById } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, notFound, serverError } from '../shared/http/response.js';

/** GET /post/{id} */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('getPost', ctx);

  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.['id'];

    log.info('Post requested', { userId, postId });

    if (postId === undefined || postId === '') {
      log.warn('Missing postId in path parameters');
      return notFound(event, 'Post not found', 'POST_NOT_FOUND');
    }

    const post = await getPostById(postId);

    if (post === null) {
      log.warn('Post not found', { userId, postId });
      return notFound(event, 'Post not found', 'POST_NOT_FOUND');
    }

    if (post.userId !== userId) {
      log.warn('Post belongs to different user — access denied', { requesterId: userId, postId, ownerId: post.userId });
      return notFound(event, 'Post not found', 'POST_NOT_FOUND');
    }

    log.info('Post returned', { userId, postId, title: post.title });
    return ok(event, post);
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    log.error('getPost failed', err);
    return serverError(event, err);
  }
};
