import { delay, http, HttpResponse } from "msw";

import { MOCK_POSTS } from "@/mocks/data/posts";

/** In-memory set of liked post IDs for the mock session. */
const likedIds = new Set<string>();

/**
 * POST /post/:id/like
 *
 * Records a like on the post. Sets `likedAt` timestamp.
 * Returns 404 if the post ID is not found in MOCK_POSTS.
 *
 * The 300ms delay simulates a DynamoDB UpdateItem call.
 */
const likePostHandler = http.post<
  { id: string },
  never,
  { likedAt: string } | { error: string }
>("/post/:id/like", async ({ params }) => {
  await delay(300);

  const { id } = params;
  const exists = MOCK_POSTS.some((p) => p.id === id);
  if (!exists) {
    return HttpResponse.json({ error: "Post not found" }, { status: 404 });
  }

  likedIds.add(id);
  return HttpResponse.json({ likedAt: new Date().toISOString() });
});

/**
 * DELETE /post/:id/like
 *
 * Removes the like from a post. Clears `likedAt`.
 * Returns 404 if the post was not liked.
 *
 * The 300ms delay simulates a DynamoDB UpdateItem call.
 */
const unlikePostHandler = http.delete<
  { id: string },
  never,
  { error: string } | Record<string, string>
>("/post/:id/like", async ({ params }) => {
  await delay(300);

  const { id } = params;
  if (!likedIds.has(id)) {
    return HttpResponse.json({ error: "Post was not liked" }, { status: 404 });
  }

  likedIds.delete(id);
  return HttpResponse.json({});
});

export const likeHandlers = [likePostHandler, unlikePostHandler];
