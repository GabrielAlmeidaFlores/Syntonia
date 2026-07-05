import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_ORIGINS } from '../core/env.js';
import type { ApiErrorCode } from '../core/types/index.js';

/**
 * Builds CORS response headers based on the `CORS_ORIGINS` environment variable.
 *
 * - When `CORS_ORIGINS=*` (default): returns `Access-Control-Allow-Origin: *`.
 *   Note: credentials are NOT allowed with wildcard — browsers reject this combination.
 * - When `CORS_ORIGINS` is a comma-separated list: matches the request origin against
 *   the list and echoes it back with `Access-Control-Allow-Credentials: true`.
 */
function getCorsHeaders(event: APIGatewayProxyEvent): Record<string, string> {
  if (CORS_ORIGINS === '*') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };
  }

  const allowedList = CORS_ORIGINS.split(',').map((o) => o.trim());
  const requestOrigin = (event.headers['origin'] ?? event.headers['Origin']) ?? '';
  const matchedOrigin = allowedList.includes(requestOrigin)
    ? requestOrigin
    : (allowedList[0] ?? '');

  return {
    'Access-Control-Allow-Origin': matchedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };
}

function build(
  statusCode: number,
  body: unknown,
  event: APIGatewayProxyEvent,
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
    body: JSON.stringify(body),
  };
}

/** 200 — success response. Never include a `message` field in the body. */
export function ok(event: APIGatewayProxyEvent, body: unknown): APIGatewayProxyResult {
  return build(200, body, event);
}

/** 202 — accepted (async operations like feed request). */
export function accepted(event: APIGatewayProxyEvent, body: unknown): APIGatewayProxyResult {
  return build(202, body, event);
}

/** 401 — token absent, expired, or invalid. */
export function unauthorized(event: APIGatewayProxyEvent): APIGatewayProxyResult {
  return build(401, {
    code: 'UNAUTHENTICATED' satisfies ApiErrorCode,
    error: 'Unauthorized',
    message: 'Invalid or missing token',
  }, event);
}

/** 400 — input validation failed or business rule rejected. */
export function badRequest(
  event: APIGatewayProxyEvent,
  message: string,
  code: ApiErrorCode = 'VALIDATION_ERROR',
): APIGatewayProxyResult {
  return build(400, { code, error: 'Bad Request', message }, event);
}

/** 404 — resource not found or access denied. */
export function notFound(
  event: APIGatewayProxyEvent,
  message: string,
  code: ApiErrorCode = 'POST_NOT_FOUND',
): APIGatewayProxyResult {
  return build(404, { code, error: 'Not Found', message }, event);
}

/** 429 — rate limit or generation limit exceeded. */
export function tooManyRequests(
  event: APIGatewayProxyEvent,
  message: string,
  code: ApiErrorCode = 'RATE_LIMIT_EXCEEDED',
): APIGatewayProxyResult {
  return build(429, { code, error: 'Too Many Requests', message }, event);
}

/**
 * 500 — internal server error. Logs the error and returns a generic message.
 * Pass an explicit `code` when the failure has a known error type (e.g. AI_EXTRACTION_FAILED).
 */
export function serverError(
  event: APIGatewayProxyEvent,
  err: unknown,
  code: ApiErrorCode = 'INTERNAL_ERROR',
): APIGatewayProxyResult {
  console.error('[SERVER ERROR]', err);
  return build(500, {
    code,
    error: 'Internal Server Error',
    message: 'Internal error. Please try again.',
  }, event);
}
