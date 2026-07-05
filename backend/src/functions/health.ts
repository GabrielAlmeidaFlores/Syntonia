import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { STAGE } from '../shared/core/env.js';
import { createLogger } from '../shared/core/logger.js';
import { ok } from '../shared/http/response.js';

/**
 * GET /health
 *
 * @description
 * Public health check endpoint — no authentication required.
 * Used by external monitors (UptimeRobot, Pingdom, AWS Route 53 health checks)
 * and by CI/CD pipelines to verify the API is reachable after deployment.
 *
 * @auth None — this is the only endpoint without a Cognito authorizer.
 *
 * @queryParams None
 *
 * @response 200
 * ```json
 * {
 *   "status": "ok",
 *   "timestamp": "2026-07-05T14:00:00.000Z",
 *   "stage": "dev"
 * }
 * ```
 *
 * @errors None — this handler never returns an error response.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('health', ctx);
  log.info('Health check requested');

  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    stage: STAGE,
  };

  log.debug('Health check response', response);
  return ok(event, response);
};
