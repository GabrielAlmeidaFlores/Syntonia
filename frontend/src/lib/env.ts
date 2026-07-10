/**
 * Single source of truth for all environment variables.
 *
 * Every VITE_* variable must be declared and exported here.
 * No other file in the project should access `import.meta.env` directly.
 *
 * In development: values come from `.env.local`.
 * In production:  values come from Amplify Console environment variables.
 *
 * Adding a new variable:
 *   1. Add it to `.env.example` with a placeholder value.
 *   2. Export it here with a sensible default or throw if required.
 *   3. Set it in Amplify Console for production and staging branches.
 */

const raw = import.meta.env as Record<string, string | undefined>;

/**
 * Base URL of the API Gateway REST endpoint.
 * Example: `https://xxx.execute-api.sa-east-1.amazonaws.com/prod`
 */
export const VITE_API_URL: string = raw["VITE_API_URL"] ?? "";

/**
 * AWS Cognito User Pool ID.
 */
export const VITE_COGNITO_USER_POOL_ID: string =
  raw["VITE_COGNITO_USER_POOL_ID"] ?? "";

/**
 * AWS Cognito App Client ID.
 */
export const VITE_COGNITO_CLIENT_ID: string =
  raw["VITE_COGNITO_CLIENT_ID"] ?? "";

/**
 * AWS region where the backend is deployed.
 * Defaults to sa-east-1 (São Paulo) matching the ARCHITECTURE.md spec.
 */
export const VITE_AWS_REGION: string = raw["VITE_AWS_REGION"] ?? "sa-east-1";
