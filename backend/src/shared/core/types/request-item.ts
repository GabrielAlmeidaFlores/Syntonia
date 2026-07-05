import type { Tag } from './tag.js';

/** DynamoDB item shape for SintoniaRequests. */
export interface RequestItem {
  readonly id: string;
  readonly userId: string;
  readonly tags: Tag[];
  readonly sqsMessageId: string;
  readonly status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  readonly createdAt: string;
  readonly processingAt?: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly postId?: string;
  readonly errorMessage?: string;
  readonly ttl: number;
}
