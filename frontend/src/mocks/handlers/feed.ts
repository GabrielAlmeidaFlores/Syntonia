import { delay, http, HttpResponse } from "msw";

import { MOCK_POSTS } from "../data/posts";

import { FEED_PAGE_SIZE } from "@/lib/constants";
import type { FeedResponse, Post } from "@/types";

interface GenerationRequestBody {
  readonly tags: string[];
  readonly quantity: number;
}

interface GenerationResponse {
  readonly requestIds: string[];
  readonly status: "PENDING";
}

/**
 * GET /feed
 *
 * Returns a paginated slice of MOCK_POSTS filtered by an optional `after`
 * query param (ISO timestamp). Posts with createdAt <= after are excluded,
 * mirroring the production DynamoDB `createdAt > :after` KeyConditionExpression.
 *
 * The cursor is a base64-encoded JSON object `{ offset: number }` — identical
 * structure to the production DynamoDB LastEvaluatedKey encoding.
 * The 400ms delay simulates a real DynamoDB GSI query via API Gateway + Lambda.
 */
const getFeedHandler = http.get<never, never, FeedResponse>(
  "/feed",
  async ({ request }) => {
    await delay(400);

    const url = new URL(request.url);
    const cursorParam = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");
    const afterParam = url.searchParams.get("after");

    const filtered =
      afterParam !== null
        ? MOCK_POSTS.filter((p) => p.createdAt > afterParam)
        : MOCK_POSTS;

    const offset =
      cursorParam !== null
        ? (JSON.parse(atob(cursorParam)) as { offset: number }).offset
        : 0;
    const limit =
      limitParam !== null ? Math.min(Number(limitParam), 10) : FEED_PAGE_SIZE;

    const slice = filtered.slice(offset, offset + limit);
    const nextOffset = offset + slice.length;
    const nextCursor =
      nextOffset < filtered.length
        ? btoa(JSON.stringify({ offset: nextOffset }))
        : null;

    return HttpResponse.json({
      posts: slice,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    });
  },
);

/**
 * GET /post/:id
 *
 * Returns the full post object (including the `content` Markdown field) for a
 * given post ID. Returns 404 if the ID is not found in MOCK_POSTS.
 *
 * The 200ms delay simulates a DynamoDB GetItem call.
 */
const getPostHandler = http.get<
  { id: string },
  never,
  Post | { error: string }
>("/post/:id", async ({ params }) => {
  await delay(200);

  const { id } = params;
  const post = MOCK_POSTS.find((p) => p.id === id);

  if (post === undefined) {
    return HttpResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return HttpResponse.json(post);
});

/**
 * POST /feed/request
 *
 * Enqueues a JIT generation request. In production this sends a message to SQS
 * which triggers the workerInternal Lambda → Gemini → DynamoDB flow.
 *
 * In the mock we respond immediately with 202 ACCEPTED. The actual new posts
 * will appear on the next GET /feed call (the JIT hook re-triggers fetchMore
 * after this response is received).
 *
 * The 300ms delay simulates the SQS SendMessage + DynamoDB PutItem round-trip.
 */
const postFeedRequestHandler = http.post<
  never,
  GenerationRequestBody,
  GenerationResponse
>("/feed/request", async ({ request }) => {
  await delay(300);

  const { quantity } = await request.json();

  const requestIds = Array.from(
    { length: quantity },
    (_, i) => `req-mock-${Date.now().toString()}-${String(i)}`,
  );

  return HttpResponse.json(
    {
      requestIds,
      status: "PENDING",
    },
    { status: 202 },
  );
});

export const feedHandlers = [
  getFeedHandler,
  getPostHandler,
  postFeedRequestHandler,
];
