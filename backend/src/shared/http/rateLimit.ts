import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db } from '../db/index.js';
import { Tables } from '../core/tables.js';

/** Thrown when a rate limit window is exceeded. */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Fixed-window rate limiter backed by DynamoDB.
 *
 * Key format: `{type}#{userId}#{bucket}` where bucket = floor(now / windowSeconds).
 * Uses atomic ADD — no read-before-write race conditions.
 * TTL is set to windowEnd + 60s for automatic cleanup.
 */
export async function checkRateLimit(
  key: string,
  options: { readonly max: number; readonly windowSeconds: number },
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / options.windowSeconds);
  const windowKey = `${key}#${String(bucket)}`;
  const windowEnd = (bucket + 1) * options.windowSeconds;

  const result = await db.send(new UpdateCommand({
    TableName: Tables.RATE_LIMIT,
    Key: { key: windowKey },
    UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :expiry)',
    ExpressionAttributeNames: {
      '#count': 'count',
      '#ttl': 'ttl',
    },
    ExpressionAttributeValues: {
      ':one': 1,
      ':expiry': windowEnd + 60,
    },
    ReturnValues: 'ALL_NEW',
  }));

  const count = (result.Attributes?.['count'] as number | undefined) ?? 1;

  if (count > options.max) {
    throw new RateLimitError(
      `Rate limit exceeded: ${key} — ${String(count)}/${String(options.max)} requests in ${String(options.windowSeconds)}s window`,
    );
  }
}
