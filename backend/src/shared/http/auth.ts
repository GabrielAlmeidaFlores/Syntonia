import type { APIGatewayProxyEvent } from 'aws-lambda';

/** Thrown when the JWT is absent or contains no `sub` claim. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Extracts the authenticated user ID (Cognito `sub`) from the API Gateway
 * event context. The JWT has already been validated by the Cognito Authorizer
 * before this Lambda runs — this function only reads the claims.
 *
 * Throws `AuthError` if the sub claim is absent.
 */
export function getUserId(event: APIGatewayProxyEvent): string {
  const sub = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  if (sub === undefined || sub === '') {
    throw new AuthError('Invalid or missing token');
  }
  return sub;
}

/**
 * Extracts the authenticated user's email from the JWT claims.
 * Returns an empty string if the email claim is absent (non-throwing).
 */
export function getUserEmail(event: APIGatewayProxyEvent): string {
  const email = event.requestContext.authorizer?.['claims']?.['email'] as string | undefined;
  return email ?? '';
}
