import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { updateUserPreferences } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, badRequest, serverError } from '../shared/http/response.js';
import { validate, updatePreferencesSchema, ValidationError } from '../shared/http/validators.js';

/** PUT /user/preferences */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('updatePreferences', ctx);

  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}') as unknown;
    const patch = validate(updatePreferencesSchema, body);

    const updatedFields = {
      ...(patch.activeTags !== undefined && { activeTagCount: patch.activeTags.length }),
      ...(patch.theme !== undefined && { theme: patch.theme }),
      ...(patch.language !== undefined && { language: patch.language }),
    };

    log.info('Updating preferences', { userId, ...updatedFields });

    await updateUserPreferences(userId, {
      ...(patch.activeTags !== undefined && { activeTags: patch.activeTags }),
      ...(patch.theme !== undefined && { theme: patch.theme }),
      ...(patch.language !== undefined && { language: patch.language }),
    });

    log.info('Preferences updated', { userId, ...updatedFields });
    return ok(event, {});
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof ValidationError) {
      log.warn('Validation failed', { error: err.message });
      return badRequest(event, err.message);
    }
    log.error('updatePreferences failed', err);
    return serverError(event, err);
  }
};
