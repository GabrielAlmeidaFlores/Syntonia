import { delay, http, HttpResponse } from "msw";

import { getMockSavedPosts, MOCK_SAVED_AT } from "../data/saved";

import { MOCK_POSTS } from "@/mocks/data/posts";
import type {
  SavedPostsResponse,
  SavePostResponse,
  UnsavePostResponse,
} from "@/types";

/**
 * In-memory set of saved post IDs for the mock session.
 * Pre-seeded with the IDs defined in MOCK_SAVED_AT.
 */
const savedIds = new Set<string>(Object.keys(MOCK_SAVED_AT));

/**
 * In-memory map of post-id → savedAt timestamp for the mock session.
 * Mutated by save/unsave handlers so GET /posts/saved stays consistent.
 */
const runtimeSavedAt = new Map<string, string>(Object.entries(MOCK_SAVED_AT));

/**
 * POST /post/:id/save
 *
 * Adds the post to the saved set and records the savedAt timestamp.
 * Returns 404 if the post ID is not found in MOCK_POSTS.
 *
 * The 300ms delay simulates a DynamoDB UpdateItem call.
 */
const savePostHandler = http.post<
  { id: string },
  never,
  SavePostResponse | { error: string }
>("/post/:id/save", async ({ params }) => {
  await delay(300);

  const { id } = params;
  const exists = MOCK_POSTS.some((p) => p.id === id);
  if (!exists) {
    return HttpResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const savedAt = new Date().toISOString();
  savedIds.add(id);
  runtimeSavedAt.set(id, savedAt);

  return HttpResponse.json({ savedAt });
});

/**
 * DELETE /post/:id/save
 *
 * Removes the post from the saved set and clears the savedAt timestamp.
 * Returns 404 if the post ID is not in the saved set.
 *
 * The 300ms delay simulates a DynamoDB UpdateItem call.
 */
const unsavePostHandler = http.delete<
  { id: string },
  never,
  UnsavePostResponse | { error: string }
>("/post/:id/save", async ({ params }) => {
  await delay(300);

  const { id } = params;
  if (!savedIds.has(id)) {
    return HttpResponse.json(
      { error: "Post not found in saved posts" },
      { status: 404 },
    );
  }

  savedIds.delete(id);
  runtimeSavedAt.delete(id);

  return HttpResponse.json({
    message: "Post unsaved. TTL restored to 30 days.",
  });
});

/**
 * GET /posts/saved
 *
 * Returns the user's saved posts ordered by savedAt descending.
 * Supports cursor-based pagination using a numeric offset cursor.
 *
 * The 400ms delay simulates a DynamoDB GSI Query on userId-savedAt-index.
 */
const getSavedPostsHandler = http.get<never, never, SavedPostsResponse>(
  "/posts/saved",
  async ({ request }) => {
    await delay(400);

    const url = new URL(request.url);
    const cursorParam = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");

    const limit = limitParam !== null ? Math.min(Number(limitParam), 50) : 12;
    const offset = cursorParam !== null ? Number(cursorParam) : 0;

    const allSaved = getMockSavedPosts(savedIds, runtimeSavedAt).map((p) => ({
      ...p,
      savedAt: runtimeSavedAt.get(p.id) ?? p.savedAt,
    }));

    const slice = allSaved.slice(offset, offset + limit);
    const nextOffset = offset + slice.length;
    const nextCursor = nextOffset < allSaved.length ? String(nextOffset) : null;

    return HttpResponse.json({
      posts: slice,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    });
  },
);

export const savedHandlers = [
  savePostHandler,
  unsavePostHandler,
  getSavedPostsHandler,
];
