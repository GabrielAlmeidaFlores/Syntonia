import { delay, http, HttpResponse } from 'msw';

import { MOCK_USER } from '../data/user';

interface AuthCallbackBody {
  readonly code: string;
}

interface AuthCallbackResponse {
  readonly user: typeof MOCK_USER;
  readonly token: string;
}

/**
 * POST /auth/callback
 *
 * Simulates the Cognito OAuth redirect callback. In production, this exchange
 * happens server-side — Cognito returns an authorisation code which is exchanged
 * for tokens. Here we simply return the mock user and a fake JWT token.
 *
 * The 800ms delay mimics a real Cognito round-trip.
 */
export const authHandlers = [
  http.post<never, AuthCallbackBody, AuthCallbackResponse>('/auth/callback', async () => {
    await delay(800);

    return HttpResponse.json({
      user: MOCK_USER,
      token: 'mock-jwt-token-syntonia-dev',
    });
  }),
];
