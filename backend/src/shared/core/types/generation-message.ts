import type { Tag } from './tag.js';

/** Parsed SQS message body from GenerationQueue. */
export interface GenerationMessage {
  readonly requestId: string;
  readonly userId: string;
  readonly tags: Tag[];
  readonly description: string | null;
}
