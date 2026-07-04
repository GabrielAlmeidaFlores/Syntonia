import { delay, http, HttpResponse } from "msw";

import { mockExtractTags } from "../data/tags";
import { MOCK_USER } from "../data/user";

import { AVAILABLE_TAGS } from "@/lib/constants";
import type { Language, Theme } from "@/stores/preferences";
import type { Tag, UpdateProfileResponse, UserPreferences } from "@/types";

interface UpdatePreferencesBody {
  readonly activeTags?: Tag[];
  readonly theme?: Theme;
  readonly language?: Language;
}

interface UpdatePreferencesResponse {
  readonly updatedAt: string;
}

interface UpdateProfileBody {
  readonly description: string;
}

/**
 * GET /user/preferences
 *
 * Returns the authenticated user's profile including their description,
 * active tags, full list of available tags, and persisted UI preferences
 * (theme and language).
 *
 * The 200ms delay simulates a DynamoDB GetItem on SintoniaUsers.
 */
const getPreferencesHandler = http.get<never, never, UserPreferences>(
  "/user/preferences",
  async () => {
    await delay(200);

    return HttpResponse.json({
      userId: MOCK_USER.userId,
      description: MOCK_USER.description,
      activeTags: MOCK_USER.activeTags,
      availableTags: AVAILABLE_TAGS,
      theme: MOCK_USER.theme,
      language: MOCK_USER.language,
    });
  },
);

/**
 * PUT /user/preferences
 *
 * Patch endpoint — accepts any combination of `activeTags`, `theme`, and
 * `language`. Only the provided fields are updated; omitted fields are
 * left unchanged. This endpoint is called from:
 *   - TagManager (activeTags only)
 *   - SettingsPanel (theme only, or language only)
 *
 * The 400ms delay simulates a DynamoDB UpdateItem on SintoniaUsers.
 */
const putPreferencesHandler = http.put<
  never,
  UpdatePreferencesBody,
  UpdatePreferencesResponse
>("/user/preferences", async ({ request }) => {
  await delay(400);

  const body = await request.json();

  if (body.activeTags !== undefined) {
    MOCK_USER.activeTags.splice(
      0,
      MOCK_USER.activeTags.length,
      ...body.activeTags,
    );
  }

  if (body.theme !== undefined) {
    (MOCK_USER as { theme: Theme }).theme = body.theme;
  }

  if (body.language !== undefined) {
    (MOCK_USER as { language: Language }).language = body.language;
  }

  return HttpResponse.json({ updatedAt: new Date().toISOString() });
});

/**
 * PUT /user/profile
 *
 * Saves the user's free-text description and runs AI tag extraction.
 * In production this calls Gemini to extract relevant tags from the description.
 * Here we use `mockExtractTags()` which keyword-matches the description against
 * AVAILABLE_TAGS — same logic, no network call.
 *
 * The 2000ms delay simulates the synchronous Gemini API call (real latency).
 */
const putProfileHandler = http.put<
  never,
  UpdateProfileBody,
  UpdateProfileResponse
>("/user/profile", async ({ request }) => {
  await delay(2000);

  const { description } = await request.json();
  const extractedTags = mockExtractTags(description);

  MOCK_USER.activeTags.splice(0, MOCK_USER.activeTags.length, ...extractedTags);

  return HttpResponse.json({
    description,
    activeTags: extractedTags,
    updatedAt: new Date().toISOString(),
  });
});

export const userHandlers = [
  getPreferencesHandler,
  putPreferencesHandler,
  putProfileHandler,
];
