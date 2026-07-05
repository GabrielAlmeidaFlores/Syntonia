import { delay, http, HttpResponse } from "msw";

import {
  getMockLegalDocument,
  mockAcceptTerms,
  mockTermsStatus,
} from "../data/legal";

import type { AcceptTermsResponse, LegalDocument, TermsStatus } from "@/types";

/**
 * GET /legal/terms-status
 * Returns whether the authenticated user needs to accept new terms.
 * The 300ms delay simulates a DynamoDB GetItem call.
 */
const getTermsStatusHandler = http.get<never, never, TermsStatus>(
  "/legal/terms-status",
  async () => {
    await delay(300);
    return HttpResponse.json(mockTermsStatus);
  },
);

/**
 * GET /legal/terms
 * Returns the current Terms of Use document in the requested language.
 * Supports `?lang=en` (default) and `?lang=pt-BR` query params.
 */
const getTermsHandler = http.get<never, never, LegalDocument>(
  "/legal/terms",
  async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const lang = url.searchParams.get("lang") === "pt-BR" ? "pt-BR" : "en";
    return HttpResponse.json(getMockLegalDocument("terms", lang));
  },
);

/**
 * GET /legal/privacy
 * Returns the current Privacy Policy document in the requested language.
 * Supports `?lang=en` (default) and `?lang=pt-BR` query params.
 */
const getPrivacyHandler = http.get<never, never, LegalDocument>(
  "/legal/privacy",
  async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const lang = url.searchParams.get("lang") === "pt-BR" ? "pt-BR" : "en";
    return HttpResponse.json(getMockLegalDocument("privacy", lang));
  },
);

/**
 * POST /legal/accept
 * Records the user's acceptance of the current terms and privacy policy versions.
 * Updates in-memory state so subsequent GET /legal/terms-status returns needsAcceptance: false.
 */
const acceptTermsHandler = http.post<
  never,
  { termsVersion: string; privacyVersion: string },
  AcceptTermsResponse
>("/legal/accept", async () => {
  await delay(400);
  mockAcceptTerms();
  return HttpResponse.json({ acceptedAt: new Date().toISOString() });
});

export const legalHandlers = [
  getTermsStatusHandler,
  getTermsHandler,
  getPrivacyHandler,
  acceptTermsHandler,
];
