/** Minimal projection used for deduplication context in workerInternal. */
export interface PostSummaryWithLike {
  readonly title: string;
  readonly summary: string;
  /** Present when the user liked this post — used to bias future generation. */
  readonly likedAt?: string;
}
