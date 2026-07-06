import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { getLatestLegalDocument, getUser } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, serverError } from '../shared/http/response.js';

/** GET /legal/terms-status */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('getLegalTermsStatus', ctx);
  const stop = log.timer();

  try {
    const userId = getUserId(event);
    log.info('Terms status requested', { userId });

    const [termsDoc, privacyDoc, user] = await Promise.all([
      getLatestLegalDocument('terms'),
      getLatestLegalDocument('privacy'),
      getUser(userId),
    ]);

    log.debug('Documents and user fetched', {
      userId,
      termsVersion: termsDoc?.version ?? null,
      privacyVersion: privacyDoc?.version ?? null,
      userTermsAccepted: user?.termsAcceptedVersion ?? null,
      userPrivacyAccepted: user?.privacyAcceptedVersion ?? null,
    });

    const termsVersion = termsDoc?.version ?? '';
    const privacyVersion = privacyDoc?.version ?? '';

    const needsAcceptance =
      termsVersion !== '' &&
      privacyVersion !== '' &&
      (user?.termsAcceptedVersion !== termsVersion ||
        user?.privacyAcceptedVersion !== privacyVersion);

    stop('Terms status resolved', { userId, needsAcceptance, termsVersion, privacyVersion });

    return ok(event, { needsAcceptance, termsVersion, privacyVersion });
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    log.error('getLegalTermsStatus failed', err);
    return serverError(event, err);
  }
};
