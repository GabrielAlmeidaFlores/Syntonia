/**
 * Central HTTP client for all API calls.
 *
 * In development, MSW (Mock Service Worker) intercepts every fetch request made
 * here and returns mock responses — no real network call leaves the browser.
 * In production, requests go to the real API Gateway endpoint defined in
 * VITE_API_URL (see `src/lib/env.ts`).
 *
 * When the real backend is ready, simply set VITE_API_URL in Amplify Console
 * and remove the MSW initialisation from main.tsx. No changes needed here.
 */

import { VITE_API_URL } from "@/lib/env";

interface ErrorBody {
  readonly message?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${VITE_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = (await response
      .json()
      .catch(() => ({ message: response.statusText }))) as ErrorBody;
    throw new Error(err.message ?? "Unknown error");
  }

  return response.json() as Promise<T>;
}

export const api = {
  /** Sends a GET request to `path` and returns the parsed JSON response. */
  get: async <T>(path: string): Promise<T> => request<T>("GET", path),

  /** Sends a POST request to `path` with `body` and returns the parsed JSON response. */
  post: async <T>(path: string, body: unknown): Promise<T> =>
    request<T>("POST", path, body),

  /** Sends a PUT request to `path` with `body` and returns the parsed JSON response. */
  put: async <T>(path: string, body: unknown): Promise<T> =>
    request<T>("PUT", path, body),

  /** Sends a DELETE request to `path` and returns the parsed JSON response. */
  delete: async <T>(path: string): Promise<T> => request<T>("DELETE", path),
};
