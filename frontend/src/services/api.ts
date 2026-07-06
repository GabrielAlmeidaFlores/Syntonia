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
 *
 * Error handling: non-2xx responses are parsed for a structured error body
 * `{ code, error, message }`. The `code` is a machine-readable `ApiErrorCode`
 * that the frontend maps to a translated user-facing message via `getApiErrorMessage`.
 *
 * The error code is encoded in the thrown Error's `message` as
 * `"API_ERROR::<CODE>::<human message>"`. This avoids mutating Error instances
 * (which triggers `@typescript-eslint/no-unsafe-assignment` in strict mode).
 * The human message is only used for debugging; the UI always uses the
 * translated string from `t.errors[code]`.
 */

import { VITE_API_URL, VITE_MODE } from "@/lib/env";
import type { ApiErrorCode } from "@/types";

const API_ERROR_PREFIX = "API_ERROR::";

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    value === "UNAUTHENTICATED" ||
    value === "POST_NOT_FOUND" ||
    value === "POST_NOT_SAVED" ||
    value === "POST_NOT_LIKED" ||
    value === "LEGAL_DOCUMENT_NOT_FOUND" ||
    value === "VALIDATION_ERROR" ||
    value === "TERMS_VERSION_MISMATCH" ||
    value === "GENERATION_LIMIT_REACHED" ||
    value === "RATE_LIMIT_EXCEEDED" ||
    value === "AI_EXTRACTION_FAILED" ||
    value === "INTERNAL_ERROR" ||
    value === "UNKNOWN_ERROR"
  );
}

function parseApiError(
  err: unknown,
): { readonly errorCode: ApiErrorCode; readonly message: string } | null {
  if (!(err instanceof Error)) return null;
  const msg = err.message;
  if (!msg.startsWith(API_ERROR_PREFIX)) return null;
  const rest = msg.slice(API_ERROR_PREFIX.length);
  const separatorIndex = rest.indexOf("::");
  if (separatorIndex === -1) return null;
  const codeCandidate = rest.slice(0, separatorIndex);
  const humanMessage = rest.slice(separatorIndex + 2);
  if (!isApiErrorCode(codeCandidate)) return null;
  return { errorCode: codeCandidate, message: humanMessage };
}

function extractCode(body: unknown): ApiErrorCode {
  if (body !== null && typeof body === "object" && "code" in body) {
    const candidate = body.code;
    if (isApiErrorCode(candidate)) return candidate;
  }
  return "INTERNAL_ERROR";
}

function extractMessage(body: unknown, fallback: string): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return fallback;
}

function throwApiError(errorCode: ApiErrorCode, message: string): never {
  throw new Error(`${API_ERROR_PREFIX}${String(errorCode)}::${message}`);
}

/**
 * Returns a translated user-facing error message for a caught error.
 * Parses the `ApiErrorCode` encoded in the error message and maps it to the
 * corresponding translated string via `errors`. Falls back to `INTERNAL_ERROR`
 * for non-API errors or unrecognised codes.
 */
export function getApiErrorMessage(
  err: unknown,
  errors: Record<ApiErrorCode, string>,
): string {
  const parsed = parseApiError(err);
  if (parsed === null) return errors.INTERNAL_ERROR;

  switch (parsed.errorCode) {
    case "UNAUTHENTICATED":
      return errors.UNAUTHENTICATED;
    case "POST_NOT_FOUND":
      return errors.POST_NOT_FOUND;
    case "POST_NOT_SAVED":
      return errors.POST_NOT_SAVED;
    case "POST_NOT_LIKED":
      return errors.POST_NOT_LIKED;
    case "LEGAL_DOCUMENT_NOT_FOUND":
      return errors.LEGAL_DOCUMENT_NOT_FOUND;
    case "VALIDATION_ERROR":
      return errors.VALIDATION_ERROR;
    case "TERMS_VERSION_MISMATCH":
      return errors.TERMS_VERSION_MISMATCH;
    case "GENERATION_LIMIT_REACHED":
      return errors.GENERATION_LIMIT_REACHED;
    case "RATE_LIMIT_EXCEEDED":
      return errors.RATE_LIMIT_EXCEEDED;
    case "AI_EXTRACTION_FAILED":
      return errors.AI_EXTRACTION_FAILED;
    case "UNKNOWN_ERROR":
      return errors.UNKNOWN_ERROR;
    default:
      return errors.INTERNAL_ERROR;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (VITE_MODE === "development") return {};
  try {
    const { fetchAuthSession } = await import("@aws-amplify/auth");
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token === undefined || token === "") return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${VITE_API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const raw = await parseResponseBody(response);
    throwApiError(extractCode(raw), extractMessage(raw, response.statusText));
  }

  const responseBody = await parseResponseBody(response);
  return responseBody as T;
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
