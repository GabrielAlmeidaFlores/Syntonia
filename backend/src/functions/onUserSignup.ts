import type { PostConfirmationTriggerEvent, Context } from 'aws-lambda';
import { saveUser } from '../shared/db/index.js';
import { DEFAULT_TAGS, DEFAULT_DESCRIPTION } from '../shared/core/default-tags.js';
import { createLogger } from '../shared/core/logger.js';
import type { UserRecord } from '../shared/core/types/index.js';

/**
 * Cognito Post-Confirmation Trigger
 *
 * @description
 * Invoked automatically by Amazon Cognito immediately after a user confirms
 * their email address. Creates the initial user profile in SintoniaUsers with
 * default tags so the user can be redirected to /onboarding on first login.
 *
 * This is NOT an HTTP endpoint — it is a Lambda trigger with no API Gateway
 * in front of it. Cognito invokes it directly using the role permission defined
 * in the `CognitoLambdaPermission` CloudFormation resource.
 *
 * @trigger Cognito PostConfirmation — fires after `confirmSignUp` succeeds.
 *
 * @input `event.request.userAttributes`
 * - `sub` — Cognito user ID (used as `userId` throughout the system)
 * - `email` — user's email address
 *
 * @sideEffects
 * - PutItem into `SintoniaUsers-{stage}` with:
 *   - `userId` = Cognito sub
 *   - `email`
 *   - `activeTags` = DEFAULT_TAGS (['AWS', 'TypeScript', 'React'])
 *   - `createdAt` / `lastActiveAt` = current ISO timestamp
 *   - `theme` and `language` are NOT set at signup — `getPreferences` returns defaults
 *
 * @returns The original `event` object intact.
 *
 * @criticalBehaviour
 * This handler MUST return the event and MUST NOT throw. Any unhandled exception
 * causes Cognito to mark the signup as failed and the user cannot complete registration.
 * All errors are caught, logged as WARN/ERROR, and silently swallowed.
 *
 * @fallback
 * If this Lambda fails silently (e.g. DynamoDB throttle at signup time), the
 * `getPreferences` handler has an upsert fallback that recreates the profile
 * with `DEFAULT_TAGS` on the user's first authenticated request.
 */
export const handler = async (
  event: PostConfirmationTriggerEvent,
  ctx: Context,
): Promise<PostConfirmationTriggerEvent> => {
  const log = createLogger('onUserSignup', ctx);

  const userId = event.request.userAttributes['sub'];
  const email = event.request.userAttributes['email'] ?? '';

  log.info('New user signup triggered', { userId, email, triggerSource: event.triggerSource });

  if (userId === undefined || userId === '') {
    log.error('Missing sub in userAttributes — cannot create profile', undefined, { event });
    return event;
  }

  try {
    const user: UserRecord = {
      userId,
      email,
      description: DEFAULT_DESCRIPTION,
      activeTags: DEFAULT_TAGS,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    await saveUser(user);
    log.info('User profile created', { userId, email, defaultTags: DEFAULT_TAGS });
  } catch (err) {
    log.error('Failed to create user profile — getPreferences upsert will recover on first login', err, { userId, email });
  }

  return event;
};
