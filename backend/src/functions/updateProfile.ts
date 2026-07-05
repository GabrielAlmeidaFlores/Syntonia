import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { updateUserProfile } from '../shared/db/index.js';
import { extractTagsFromDescription, GeminiError } from '../shared/ai/gemini.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, badRequest, serverError } from '../shared/http/response.js';
import { validate, updateProfileSchema, ValidationError } from '../shared/http/validators.js';

/** PUT /user/profile — saves description and synchronously extracts tags with Gemini (≤ 29s). */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('updateProfile', ctx);

  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}') as unknown;
    const { description } = validate(updateProfileSchema, body);

    log.info('Profile update requested', { userId, descriptionLength: description.length });

    const geminiStop = log.timer();
    const activeTags = await extractTagsFromDescription(description);
    geminiStop('Gemini tag extraction completed', { userId, tagCount: activeTags.length, tags: activeTags });

    await updateUserProfile(userId, description, activeTags);

    log.info('Profile updated', { userId, tagCount: activeTags.length, tags: activeTags });

    return ok(event, {
      description,
      activeTags,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof ValidationError) {
      log.warn('Validation failed', { error: err.message });
      return badRequest(event, err.message);
    }
    if (err instanceof GeminiError) {
      log.error('Gemini tag extraction failed', err, { model: 'gemini-1.5-flash/pro' });
      return serverError(event, err, 'AI_EXTRACTION_FAILED');
    }
    log.error('updateProfile failed', err);
    return serverError(event, err);
  }
};
