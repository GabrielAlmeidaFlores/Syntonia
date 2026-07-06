import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { getFeedByUser } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, serverError } from '../shared/http/response.js';

/**
 * GET /feed
 *
 * @description
 * Returns the next batch of AI-generated posts for the authenticated user,
 * ordered by `createdAt` descending (most recent first).
 * Uses the `userId-createdAt-index` GSI on SintoniaFeed.
 *
 * Called by `useFeed` on the frontend on mount and after JIT generation
 * completes. The cursor is opaque — the frontend passes it back unchanged.
 *
 * @auth Required — Cognito JWT via Authorization header.
 *
 * @queryParams
 * - `limit` {number} [1–10, default 5] — number of posts to return per page.
 * - `cursor` {string} [optional] — base64-encoded DynamoDB LastEvaluatedKey
 *   from the previous response. Absent on the first call.
 *
 * @response 200
 * ```json
 * {
 *   "posts": [
 *     {
 *       "id": "uuid",
 *       "userId": "cognito-sub",
 *       "title": "AWS Lambda Cold Start Optimization",
 *       "summary": "How to eliminate cold starts...",
 *       "content": "## ...",
 *       "tags": ["AWS", "Serverless"],
 *       "gradient": ["#FF6B35", "#F7931E"],
 *       "createdAt": "2026-07-05T14:00:00.000Z",
 *       "status": "READY"
 *     }
 *   ],
 *   "cursor": "eyJpZCI6InV1aWQifQ==",
 *   "hasMore": true
 * }
 * ```
 * When there are no more pages, `cursor` is `null` and `hasMore` is `false`.
 *
 * @errors
 * - `401 UNAUTHENTICATED` — missing, expired, or invalid JWT.
 * - `500 INTERNAL_ERROR` — DynamoDB failure.
 *
 * @sideEffects None — read-only.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('getFeed', ctx);
  const stop = log.timer();

  try {
    const userId = getUserId(event);
    const limit = Math.min(Number(event.queryStringParameters?.['limit'] ?? 5), 10);
    const cursor = event.queryStringParameters?.['cursor'] ?? null;
    const after = event.queryStringParameters?.['after'] ?? undefined;

    log.info('Feed requested', { userId, limit, hasCursor: cursor !== null, hasAfter: after !== undefined });

    const { items, cursor: nextCursor } = await getFeedByUser(userId, limit, cursor, after);

    stop('Feed query completed', { userId, limit, count: items.length, hasMore: nextCursor !== null });

    return ok(event, { posts: items, cursor: nextCursor, hasMore: nextCursor !== null });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request', { error: err.message });
      return unauthorized(event);
    }
    log.error('getFeed failed', err);
    return serverError(event, err);
  }
};
