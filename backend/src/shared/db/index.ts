import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

import type { LegalDocumentItem, PostItem, PostSummaryWithLike, RequestItem, Tag, UserRecord } from '../core/types/index.js';
import { AWS_REGION } from '../core/env.js';
import { Tables } from '../core/tables.js';

export { ConditionalCheckFailedException };

const client = new DynamoDBClient({ region: AWS_REGION });
export const db = DynamoDBDocumentClient.from(client);

/** Encodes a DynamoDB LastEvaluatedKey as a base64 opaque cursor string. */
function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key)).toString('base64');
}

/** Decodes a base64 cursor string into a DynamoDB ExclusiveStartKey. */
function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as Record<string, unknown>;
}

// ── Feed ──────────────────────────────────────────────────────────────

/**
 * Queries the user's feed via userId-createdAt-index GSI.
 * Returns posts in descending createdAt order with cursor-based pagination.
 */
export async function getFeedByUser(
  userId: string,
  limit = 5,
  cursor: string | null = null,
): Promise<{ items: PostItem[]; cursor: string | null }> {
  const result = await db.send(new QueryCommand({
    TableName: Tables.FEED,
    IndexName: 'userId-createdAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false,
    Limit: limit,
    ...(cursor !== null && { ExclusiveStartKey: decodeCursor(cursor) }),
  }));

  const nextCursor = result.LastEvaluatedKey !== undefined
    ? encodeCursor(result.LastEvaluatedKey)
    : null;

  return { items: (result.Items ?? []) as PostItem[], cursor: nextCursor };
}

/**
 * Fetches the last `limit` posts for a user that match any of the given tags.
 * Returns `title`, `summary`, and `likedAt` — used by workerInternal to build
 * the deduplication + preference context for the Gemini prompt.
 */
export async function getRecentPostsByTags(
  userId: string,
  tags: Tag[],
  limit = 90,
): Promise<PostSummaryWithLike[]> {
  if (tags.length === 0) return [];

  const tagConditions = tags.map((_, i) => `contains(#tags, :tag${String(i)})`).join(' OR ');
  const tagValues = Object.fromEntries(tags.map((tag, i) => [`:tag${String(i)}`, tag]));

  const result = await db.send(new QueryCommand({
    TableName: Tables.FEED,
    IndexName: 'userId-createdAt-index',
    KeyConditionExpression: 'userId = :uid',
    FilterExpression: tagConditions,
    ProjectionExpression: '#title, #summary, likedAt',
    ExpressionAttributeNames: {
      '#tags': 'tags',
      '#title': 'title',
      '#summary': 'summary',
    },
    ExpressionAttributeValues: {
      ':uid': userId,
      ...tagValues,
    },
    ScanIndexForward: false,
    Limit: limit * 3,
  }));

  return ((result.Items ?? []) as PostSummaryWithLike[]).slice(0, limit);
}

/**
 * Returns a single post by its primary key.
 * Returns null if the post does not exist.
 */
export async function getPostById(postId: string): Promise<PostItem | null> {
  const result = await db.send(new GetCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
  }));
  return (result.Item as PostItem | undefined) ?? null;
}

/**
 * Writes a new generated post to SintoniaFeed.
 * TTL is set at creation — auto-deleted after 90 days unless saved.
 */
export async function putPost(post: PostItem): Promise<void> {
  await db.send(new PutCommand({ TableName: Tables.FEED, Item: post }));
}

/**
 * Sets `savedAt` on a post and removes its TTL, making it persist indefinitely.
 * Uses a ConditionExpression to prevent cross-user access.
 * Throws `ConditionalCheckFailedException` if the post doesn't belong to userId.
 */
export async function markPostSaved(postId: string, userId: string): Promise<string> {
  const savedAt = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
    ConditionExpression: 'userId = :uid',
    UpdateExpression: 'SET savedAt = :s REMOVE #ttl',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: { ':s': savedAt, ':uid': userId },
  }));
  return savedAt;
}

/**
 * Removes `savedAt` from a post and restores its TTL to now + 30 days.
 * Uses a ConditionExpression to prevent cross-user access.
 * Throws `ConditionalCheckFailedException` if the post doesn't belong to userId.
 */
export async function markPostUnsaved(postId: string, userId: string): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 2_592_000;
  await db.send(new UpdateCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
    ConditionExpression: 'userId = :uid',
    UpdateExpression: 'REMOVE savedAt SET #ttl = :t',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: { ':t': ttl, ':uid': userId },
  }));
}

/**
 * Sets `likedAt` on a post, recording user preference for AI deduplication.
 * Uses a ConditionExpression to prevent cross-user access.
 * Throws `ConditionalCheckFailedException` if the post doesn't belong to userId.
 */
export async function markPostLiked(postId: string, userId: string): Promise<string> {
  const likedAt = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
    ConditionExpression: 'userId = :uid',
    UpdateExpression: 'SET likedAt = :l',
    ExpressionAttributeValues: { ':l': likedAt, ':uid': userId },
  }));
  return likedAt;
}

/**
 * Removes `likedAt` from a post.
 * Uses a ConditionExpression to prevent cross-user access.
 * Throws `ConditionalCheckFailedException` if the post doesn't belong to userId.
 */
export async function markPostUnliked(postId: string, userId: string): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
    ConditionExpression: 'userId = :uid AND attribute_exists(#la)',
    UpdateExpression: 'REMOVE likedAt',
    ExpressionAttributeNames: { '#la': 'likedAt' },
    ExpressionAttributeValues: { ':uid': userId },
  }));
}

/**
 * Queries saved posts for a user via userId-savedAt-index GSI.
 * Returns posts ordered by savedAt descending (newest saved first).
 */
export async function getSavedByUser(
  userId: string,
  limit = 20,
  cursor: string | null = null,
): Promise<{ items: PostItem[]; cursor: string | null }> {
  const result = await db.send(new QueryCommand({
    TableName: Tables.FEED,
    IndexName: 'userId-savedAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false,
    Limit: limit,
    ...(cursor !== null && { ExclusiveStartKey: decodeCursor(cursor) }),
  }));

  const nextCursor = result.LastEvaluatedKey !== undefined
    ? encodeCursor(result.LastEvaluatedKey)
    : null;

  return { items: (result.Items ?? []) as PostItem[], cursor: nextCursor };
}

// ── Generation Requests ──────────────────────────────────────────────

/** Writes a new generation request to SintoniaRequests. */
export async function saveRequest(request: RequestItem): Promise<void> {
  await db.send(new PutCommand({ TableName: Tables.REQUESTS, Item: request }));
}

/** Updates the status of a generation request, with optional extra fields. */
export async function updateRequestStatus(
  id: string,
  status: RequestItem['status'],
  extra: Record<string, unknown> = {},
): Promise<void> {
  const sets = ['#s = :s'];
  const names: Record<string, string> = { '#s': 'status' };
  const values: Record<string, unknown> = { ':s': status };

  let idx = 0;
  for (const [k, v] of Object.entries(extra)) {
    const placeholder = `#x${String(idx)}`;
    const valuePlaceholder = `:x${String(idx)}`;
    sets.push(`${placeholder} = ${valuePlaceholder}`);
    names[placeholder] = k;
    values[valuePlaceholder] = v;
    idx++;
  }

  await db.send(new UpdateCommand({
    TableName: Tables.REQUESTS,
    Key: { id },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

/** Counts the number of PENDING generation requests for a user. */
export async function countPendingRequests(userId: string): Promise<number> {
  const result = await db.send(new QueryCommand({
    TableName: Tables.REQUESTS,
    IndexName: 'userId-status-index',
    KeyConditionExpression: 'userId = :uid AND #s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':uid': userId, ':s': 'PENDING' },
    Select: 'COUNT',
  }));
  return result.Count ?? 0;
}

// ── Users ─────────────────────────────────────────────────────────────

/** Returns the user record or null if not found. */
export async function getUser(userId: string): Promise<UserRecord | null> {
  const result = await db.send(new GetCommand({
    TableName: Tables.USERS,
    Key: { userId },
  }));
  return (result.Item as UserRecord | undefined) ?? null;
}

/** Upserts a user record (PutItem). */
export async function saveUser(user: UserRecord): Promise<void> {
  await db.send(new PutCommand({ TableName: Tables.USERS, Item: user }));
}

/**
 * Updates the user's description and active tags after Gemini extraction.
 * Also updates `lastActiveAt`.
 */
export async function updateUserProfile(
  userId: string,
  description: string,
  activeTags: string[],
): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: Tables.USERS,
    Key: { userId },
    UpdateExpression: 'SET #desc = :d, activeTags = :t, lastActiveAt = :ts',
    ExpressionAttributeNames: { '#desc': 'description' },
    ExpressionAttributeValues: {
      ':d': description,
      ':t': activeTags,
      ':ts': new Date().toISOString(),
    },
  }));
}

/**
 * Patch-updates any combination of `activeTags`, `theme`, and `language`.
 * Only provided fields are written; omitted fields are left unchanged.
 */
export async function updateUserPreferences(
  userId: string,
  patch: {
    readonly activeTags?: string[];
    readonly theme?: string;
    readonly language?: string;
  },
): Promise<void> {
  const sets: string[] = ['lastActiveAt = :ts'];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ':ts': new Date().toISOString() };

  if (patch.activeTags !== undefined) {
    sets.push('activeTags = :at');
    values[':at'] = patch.activeTags;
  }
  if (patch.theme !== undefined) {
    sets.push('#th = :th');
    names['#th'] = 'theme';
    values[':th'] = patch.theme;
  }
  if (patch.language !== undefined) {
    sets.push('#la = :la');
    names['#la'] = 'language';
    values[':la'] = patch.language;
  }

  await db.send(new UpdateCommand({
    TableName: Tables.USERS,
    Key: { userId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ...(Object.keys(names).length > 0 && { ExpressionAttributeNames: names }),
    ExpressionAttributeValues: values,
  }));
}

/** Records the user's acceptance of the current terms and privacy policy versions. */
export async function acceptUserTerms(
  userId: string,
  termsVersion: string,
  privacyVersion: string,
): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: Tables.USERS,
    Key: { userId },
    UpdateExpression: 'SET termsAcceptedVersion = :tv, privacyAcceptedVersion = :pv, termsAcceptedAt = :ta',
    ExpressionAttributeValues: {
      ':tv': termsVersion,
      ':pv': privacyVersion,
      ':ta': new Date().toISOString(),
    },
  }));
}

// ── Legal ─────────────────────────────────────────────────────────────

/**
 * Returns the most recent (active) document for the given type and language.
 * Uses `typeLanguage` as the partition key (e.g. "terms#en", "privacy#pt-BR").
 * Queries with ScanIndexForward: false, Limit: 1 — the first result is the latest.
 * Returns null if no document has been published yet for this type+language combination.
 */
export async function getLatestLegalDocument(
  type: 'terms' | 'privacy',
  language: 'en' | 'pt-BR' = 'en',
): Promise<LegalDocumentItem | null> {
  const typeLanguage = `${type}#${language}`;
  const result = await db.send(new QueryCommand({
    TableName: Tables.LEGAL,
    KeyConditionExpression: 'typeLanguage = :pk',
    ExpressionAttributeValues: { ':pk': typeLanguage },
    ScanIndexForward: false,
    Limit: 1,
  }));
  const item = (result.Items ?? [])[0];
  return (item as LegalDocumentItem | undefined) ?? null;
}

/** Inserts a legal document version into SintoniaLegal. */
export async function putLegalDocument(doc: LegalDocumentItem): Promise<void> {
  await db.send(new PutCommand({ TableName: Tables.LEGAL, Item: doc }));
}

export { DeleteCommand };
