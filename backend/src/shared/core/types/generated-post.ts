import type { Tag } from './tag.js';

/** Response shape from Gemini for post generation. */
export interface GeneratedPost {
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly tags: Tag[];
  readonly gradient: [string, string];
}
