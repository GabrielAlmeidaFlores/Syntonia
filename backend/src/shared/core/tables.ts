import {
  FEED_TABLE,
  LEGAL_TABLE,
  RATE_LIMIT_TABLE,
  REQUESTS_TABLE,
  USERS_TABLE,
} from './env.js';

/**
 * DynamoDB table names resolved at module load from `src/shared/core/env.ts`.
 *
 * Always import and use `Tables.X` in handlers and shared modules.
 * Never access environment variables directly in handler files.
 */
export const Tables = {
  FEED:       FEED_TABLE,
  REQUESTS:   REQUESTS_TABLE,
  USERS:      USERS_TABLE,
  RATE_LIMIT: RATE_LIMIT_TABLE,
  LEGAL:      LEGAL_TABLE,
} as const;
