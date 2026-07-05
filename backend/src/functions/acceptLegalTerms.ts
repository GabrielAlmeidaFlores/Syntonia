import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { getLatestLegalDocument, acceptUserTerms } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, badRequest, notFound, serverError } from '../shared/http/response.js';
import { validate, acceptLegalTermsSchema, ValidationError } from '../shared/http/validators.js';

/** POST /legal/accept */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('acceptLegalTerms', ctx);
  const stop = log.timer();

  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}') as unknown;
    const { termsVersion, privacyVersion } = validate(acceptLegalTermsSchema, body);

    log.info('Terms acceptance requested', { userId, termsVersion, privacyVersion });

    const [termsDoc, privacyDoc] = await Promise.all([
      getLatestLegalDocument('terms'),
      getLatestLegalDocument('privacy'),
    ]);

    log.debug('Active document versions fetched', {
      userId,
      activeTermsVersion: termsDoc?.version ?? null,
      activePrivacyVersion: privacyDoc?.version ?? null,
      submittedTermsVersion: termsVersion,
      submittedPrivacyVersion: privacyVersion,
    });

    if (termsDoc === null || privacyDoc === null) {
      log.warn('No active legal document found', { userId, termsDocMissing: termsDoc === null, privacyDocMissing: privacyDoc === null });
      return notFound(event, 'No active legal document found', 'LEGAL_DOCUMENT_NOT_FOUND');
    }

    if (termsVersion !== termsDoc.version || privacyVersion !== privacyDoc.version) {
      log.warn('Version mismatch — user submitted stale versions', {
        userId,
        submittedTerms: termsVersion,
        activeTerms: termsDoc.version,
        submittedPrivacy: privacyVersion,
        activePrivacy: privacyDoc.version,
      });
      return badRequest(event, 'Provided versions do not match current active versions. Please refresh and try again.', 'TERMS_VERSION_MISMATCH');
    }

    await acceptUserTerms(userId, termsVersion, privacyVersion);

    const acceptedAt = new Date().toISOString();
    stop('Terms acceptance recorded', { userId, termsVersion, privacyVersion, acceptedAt });

    return ok(event, { acceptedAt });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    if (err instanceof ValidationError) {
      log.warn('Validation failed', { error: err.message });
      return badRequest(event, err.message);
    }
    log.error('acceptLegalTerms failed', err);
    return serverError(event, err);
  }
};
