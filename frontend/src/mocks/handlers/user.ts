import { delay, http, HttpResponse } from 'msw';


import { mockExtractTags } from '../data/tags';
import { MOCK_USER } from '../data/user';

import { AVAILABLE_TAGS } from '@/lib/constants';
import type { Tag, UpdateProfileResponse, UserPreferences } from '@/types';

interface UpdatePreferencesBody {
  readonly activeTags: Tag[];
}

interface UpdateProfileBody {
  readonly description: string;
}

/**
 * GET /user/preferences
 *
 * Returns the authenticated user's profile including their description,
 * active tags and the full list of available tags.
 *
 * The 200ms delay simulates a DynamoDB GetItem on SintoniaUsers.
 */
const getPreferencesHandler = http.get<never, never, UserPreferences>(
  '/user/preferences',
  async () => {
    await delay(200);

    return HttpResponse.json({
      userId: MOCK_USER.userId,
      description: MOCK_USER.description,
      activeTags: MOCK_USER.activeTags,
      availableTags: AVAILABLE_TAGS,
    });
  },
);

/**
 * PUT /user/preferences
 *
 * Persists the user's active tag selection. This endpoint is called when the
 * user enables or disables individual AI-extracted tags on the Profile page.
 *
 * The 400ms delay simulates a DynamoDB UpdateItem on SintoniaUsers.
 */
const putPreferencesHandler = http.put<never, UpdatePreferencesBody>(
  '/user/preferences',
  async ({ request }) => {
    await delay(400);

    const { activeTags } = await request.json();

    MOCK_USER.activeTags.splice(0, MOCK_USER.activeTags.length, ...activeTags);

    return HttpResponse.json({
      activeTags,
      updatedAt: new Date().toISOString(),
    });
  },
);

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
const putProfileHandler = http.put<never, UpdateProfileBody, UpdateProfileResponse>(
  '/user/profile',
  async ({ request }) => {
    await delay(2000);

    const { description } = await request.json();
    const extractedTags = mockExtractTags(description);

    MOCK_USER.activeTags.splice(0, MOCK_USER.activeTags.length, ...extractedTags);

    return HttpResponse.json({
      description,
      activeTags: extractedTags,
      updatedAt: new Date().toISOString(),
    });
  },
);

export const userHandlers = [getPreferencesHandler, putPreferencesHandler, putProfileHandler];
