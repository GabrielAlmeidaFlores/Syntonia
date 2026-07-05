import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { getLatestLegalDocument } from '../shared/db/index.js';
import { createLogger } from '../shared/core/logger.js';
import { ok, unauthorized, notFound, serverError } from '../shared/http/response.js';

/** GET /legal/{type}?lang={en|pt-BR} — returns the active Terms of Use or Privacy Policy. */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('getLegalDocument', ctx);
  const stop = log.timer();

  try {
    getUserId(event);
    const rawType = event.pathParameters?.['type'];
    const rawLang = event.queryStringParameters?.['lang'] ?? 'en';
    const lang: 'en' | 'pt-BR' = rawLang === 'pt-BR' ? 'pt-BR' : 'en';

    log.info('Legal document requested', { type: rawType, lang });

    if (rawType !== 'terms' && rawType !== 'privacy') {
      log.warn('Invalid document type requested', { rawType });
      return notFound(event, 'Document type must be "terms" or "privacy"', 'LEGAL_DOCUMENT_NOT_FOUND');
    }

    let doc = await getLatestLegalDocument(rawType, lang);

    if (doc === null && lang !== 'en') {
      log.warn('Requested language not found, falling back to en', { type: rawType, lang });
      doc = await getLatestLegalDocument(rawType, 'en');
    }

    if (doc === null) {
      log.warn('No active document found for type', { type: rawType, lang });
      return notFound(event, `No active ${rawType} document found`, 'LEGAL_DOCUMENT_NOT_FOUND');
    }

    stop('Legal document returned', { type: rawType, lang: doc.language, version: doc.version });

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
