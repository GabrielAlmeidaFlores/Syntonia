/**
 * AWS Amplify configuration for Cognito authentication.
 * Called once at application bootstrap in `main.tsx` before the React tree renders.
 * No-op when Cognito env vars are absent (local dev with MSW mocks).
 */

import { Amplify } from "aws-amplify";

import {
  VITE_AWS_REGION,
  VITE_COGNITO_CLIENT_ID,
  VITE_COGNITO_USER_POOL_ID,
} from "@/lib/env";

/** Configures Amplify Auth with the Cognito User Pool from environment variables. */
export function configureAmplify(): void {
  if (VITE_COGNITO_USER_POOL_ID === "" || VITE_COGNITO_CLIENT_ID === "") return;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: VITE_COGNITO_CLIENT_ID,
        region: VITE_AWS_REGION,
      },
    },
  });
}
