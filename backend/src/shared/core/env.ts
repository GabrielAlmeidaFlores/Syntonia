/**
 * Single source of truth for all environment variables.
 *
 * Every `process.env` access MUST go through this file — never read
 * `process.env` directly in handlers or shared modules.
 *
 * In production, values are injected by `serverless.yml` at deploy time
 * (table names are computed from the stage, secrets come from SSM).
 * In local development, values come from `.env.local` loaded by serverless-offline.
 *
 * Adding a new variable:
 *   1. Add it here with a safe fallback for local dev.
 *   2. Add it to `serverless.yml` under `provider.environment`.
 *   3. Add it to `.env.example` with a placeholder.
 */

/** AWS region where the backend is deployed. Defaults to São Paulo (sa-east-1). */
export const AWS_REGION = process.env['AWS_REGION'] ?? 'sa-east-1';

/** Current deployment stage: 'dev' or 'prod'. */
export const STAGE = process.env['STAGE'] ?? 'dev';

/**
 * Minimum log level for the structured logger.
 * Set to 'DEBUG' in .env.local for verbose output during local development.
 * Production should use 'INFO' (default).
 */
export const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'INFO';

/** SintoniaFeed DynamoDB table name. */
export const FEED_TABLE = process.env['FEED_TABLE'] ?? 'SintoniaFeed-dev';

/** SintoniaRequests DynamoDB table name. */
export const REQUESTS_TABLE = process.env['REQUESTS_TABLE'] ?? 'SintoniaRequests-dev';

/** SintoniaUsers DynamoDB table name. */
export const USERS_TABLE = process.env['USERS_TABLE'] ?? 'SintoniaUsers-dev';

/** SintoniaRateLimit DynamoDB table name. */
export const RATE_LIMIT_TABLE = process.env['RATE_LIMIT_TABLE'] ?? 'SintoniaRateLimit-dev';

/** SintoniaLegal DynamoDB table name. */
export const LEGAL_TABLE = process.env['LEGAL_TABLE'] ?? 'SintoniaLegal-dev';

/**
 * SQS GenerationQueue URL.
 * Set by serverless.yml via `!Ref GenerationQueue` at deploy time.
 * Empty string in local dev — calls to `sendGenerationRequest` will throw
 * if this is not configured (expected behaviour without a real queue).
 */
export const GENERATION_QUEUE_URL = process.env['GENERATION_QUEUE_URL'] ?? '';

/**
 * Gemini API key for AI content generation.
 * In production: read from SSM Parameter Store `/syntonia/{stage}/gemini-api-key`.
 * In local dev: set in `.env.local`. Empty string disables AI calls gracefully.
 */
export const GEMINI_API_KEY = process.env['GEMINI_API_KEY'] ?? '';

/**
 * CORS allowed origins.
 *
 * Use `'*'` (default) to allow any origin — useful during development and when
 * the API is consumed by multiple clients.
 *
 * To restrict, set a comma-separated list of allowed origins:
 *   CORS_ORIGINS=https://syntonia.app,https://dev.syntonia.app
 *
 * Note: when `'*'` is used, `Access-Control-Allow-Credentials` is NOT sent
 * because browsers reject credentials with wildcard origins.
 */
export const CORS_ORIGINS = process.env['CORS_ORIGINS'] ?? '*';
