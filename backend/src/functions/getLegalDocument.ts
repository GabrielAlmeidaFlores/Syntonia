import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { getLatestLegalDocument } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, notFound, serverError } from '../shared/http/response.js';

/** GET /legal/{type} — returns the active Terms of Use or Privacy Policy. */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('getLegalDocument', ctx);
  const stop = log.timer();

  try {
    getUserId(event);
    const rawType = event.pathParameters?.['type'];

    log.info('Legal document requested', { type: rawType });

    if (rawType !== 'terms' && rawType !== 'privacy') {
      log.warn('Invalid document type requested', { rawType });
      return notFound(event, 'Document type must be "terms" or "privacy"', 'LEGAL_DOCUMENT_NOT_FOUND');
    }

    const doc = await getLatestLegalDocument(rawType);

    if (doc === null) {
      log.warn('No active document found for type', { type: rawType });
      return notFound(event, `No active ${rawType} document found`, 'LEGAL_DOCUMENT_NOT_FOUND');
    }

    stop('Legal document returned', { type: rawType, version: doc.version, updatedAt: doc.updatedAt });

    return ok(event, doc);
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Unauthenticated request');
      return unauthorized(event);
    }
    log.error('getLegalDocument failed', err);
    return serverError(event, err);
  }
};
