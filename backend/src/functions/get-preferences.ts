import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId, getUserEmail } from '../shared/http/auth.js';
import { getUser, saveUser } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, serverError } from '../shared/http/response.js';
import { DEFAULT_TAGS } from '../shared/core/default-tags.js';
import type { UserRecord } from '../shared/core/types/index.js';

/**
 * GET /user/preferences
 *
 * @description
 * Returns the authenticated user's full profile: description, active tags,
 * and persisted UI preferences (theme and language).
 *
 * Called by the frontend:
 *   - On every authenticated session start (via `ProfilePage` mount) to sync
 *     description, activeTags, theme and language from the server.
 *   - This is the single source of truth for the user's personalisation state.
 *
 * @auth Required — Cognito JWT via Authorization header.
 *
 * @queryParams None
 *
 * @response 200
 * ```json
 * {
 *   "userId": "cognito-sub",
 *   "description": "Backend developer focused on AWS...",
 *   "activeTags": ["AWS", "TypeScript", "serverless"],
 *   "theme": "dark",
 *   "language": "en"
 * }
 * ```
 * `description` is `null` if the user has not yet completed onboarding.
 * `theme` defaults to `"dark"` if not yet stored.
 * `language` defaults to `"en"` if not yet stored.
 *
 * @sideEffects
 * **Upsert fallback:** if the user record is missing in DynamoDB (meaning
 * `onUserSignup` failed silently at signup time), this handler recreates it
 * with `DEFAULT_TAGS` so the app never gets stuck in a broken state.
 * The frontend will detect `description: null` and redirect to /onboarding.
 * The upsert is logged as WARN so it can be monitored in CloudWatch.
 *
 * @errors
 * - `401 UNAUTHENTICATED` — missing, expired, or invalid JWT.
 * - `500 INTERNAL_ERROR` — DynamoDB failure.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('getPreferences', ctx);
  const stop = log.timer();

  try {
    const userId = getUserId(event);
    log.info('Preferences requested', { userId });

    let user = await getUser(userId);

    if (user === null) {
      log.warn('User profile missing — recreating with defaults (onUserSignup may have failed)', { userId });
      user = {
        userId,
        email: getUserEmail(event),
        activeTags: DEFAULT_TAGS,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      } satisfies UserRecord;
      await saveUser(user);
      log.info('User profile upserted with defaults', { userId, defaultTags: DEFAULT_TAGS });
    }

    const response = {
      userId: user.userId,
      description: user.description ?? null,
      activeTags: user.activeTags,
      theme: user.theme ?? 'dark',
      language: user.language ?? 'en',
    };

    stop('Preferences returned', {
      userId,
      hasDescription: user.description !== undefined,
      activeTagCount: user.activeTags.length,
      theme: response.theme,
      language: response.language,
    });

    return ok(event, response);
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    log.error('getPreferences failed', err);
    return serverError(event, err);
  }
};
