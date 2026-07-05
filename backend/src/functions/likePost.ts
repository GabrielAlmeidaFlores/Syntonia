import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { markPostLiked, ConditionalCheckFailedException } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, notFound, serverError } from '../shared/http/response.js';

/**
 * POST /post/{id}/like
 *
 * @description
 * Records that the authenticated user liked a post. Sets `likedAt` on the
 * DynamoDB item so `workerInternal` can use this as positive feedback when
 * generating future content — liked posts bias the AI towards similar style
 * and depth in subsequent generations.
 *
 * Liking a post does NOT affect its TTL (unlike saving). The post will still
 * be auto-deleted after 90 days unless the user also saves it.
 *
 * @auth Required — Cognito JWT via Authorization header.
 *
 * @pathParams
 * - `id` {string} — UUID of the post to like.
 *
 * @response 200
 * ```json
 * { "likedAt": "2026-07-05T14:00:00.000Z" }
 * ```
 *
 * @errors
 * - `401 UNAUTHENTICATED` — missing, expired, or invalid JWT.
 * - `404 POST_NOT_FOUND` — post does not exist or belongs to another user.
 * - `500 INTERNAL_ERROR` — DynamoDB failure.
 *
 * @sideEffects
 * - UpdateItem on SintoniaFeed: SET `likedAt` = current timestamp.
 * - ConditionExpression `userId = :uid` prevents cross-user access.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('likePost', ctx);

  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.['id'];

    log.info('Like post requested', { userId, postId });

    if (postId === undefined || postId === '') {
      log.warn('Missing postId in path parameters', { userId });
      return notFound(event, 'Post not found', 'POST_NOT_FOUND');
    }

    const likedAt = await markPostLiked(postId, userId);

    log.info('Post liked', { userId, postId, likedAt });
    return ok(event, { likedAt });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof ConditionalCheckFailedException) {
      const postId = event.pathParameters?.['id'];
      log.warn('Post not found or access denied during like', { postId });
      return notFound(event, 'Post not found', 'POST_NOT_FOUND');
    }
    log.error('likePost failed', err);
    return serverError(event, err);
  }
};
