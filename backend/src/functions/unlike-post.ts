import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { markPostUnliked, ConditionalCheckFailedException } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, notFound, serverError } from '../shared/http/response.js';

/**
 * DELETE /post/{id}/like
 *
 * @description
 * Removes the like from a post. Clears the `likedAt` attribute on the
 * DynamoDB item so future AI generations no longer treat this post as
 * positive feedback.
 *
 * @auth Required — Cognito JWT via Authorization header.
 *
 * @pathParams
 * - `id` {string} — UUID of the post to unlike.
 *
 * @response 200
 * ```json
 * {}
 * ```
 *
 * @errors
 * - `401 UNAUTHENTICATED` — missing, expired, or invalid JWT.
 * - `404 POST_NOT_LIKED` — post was not liked by this user, or does not exist,
 *   or belongs to another user.
 * - `500 INTERNAL_ERROR` — DynamoDB failure.
 *
 * @sideEffects
 * - UpdateItem on SintoniaFeed: REMOVE `likedAt`.
 * - ConditionExpression `userId = :uid` prevents cross-user access.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('unlikePost', ctx);

  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.['id'];

    log.info('Unlike post requested', { userId, postId });

    if (postId === undefined || postId === '') {
      log.warn('Missing postId in path parameters', { userId });
      return notFound(event, 'Post was not liked', 'POST_NOT_LIKED');
    }

    await markPostUnliked(postId, userId);

    log.info('Post unliked', { userId, postId });
    return ok(event, {});
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof ConditionalCheckFailedException) {
      const postId = event.pathParameters?.['id'];
      log.warn('Post not found or access denied during unlike', { postId });
      return notFound(event, 'Post was not liked', 'POST_NOT_LIKED');
    }
    log.error('unlikePost failed', err);
    return serverError(event, err);
  }
};
