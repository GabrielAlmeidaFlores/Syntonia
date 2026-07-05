import type { Tag } from './tag.js';

/** DynamoDB item shape for SintoniaFeed. */
export interface PostItem {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly tags: Tag[];
  readonly gradient: [string, string];
  readonly createdAt: string;
  readonly status: 'READY';
  readonly ttl?: number;
  readonly savedAt?: string;
  /** ISO 8601 — set when the user likes the post. Absent when not liked. */
  readonly likedAt?: string;
}
