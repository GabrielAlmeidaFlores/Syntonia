export type Tag =
  | 'AWS'
  | 'React'
  | 'TypeScript'
  | 'Node.js'
  | 'Python'
  | 'Docker'
  | 'Kubernetes'
  | 'Linux'
  | 'DynamoDB'
  | 'PostgreSQL'
  | 'Redis'
  | 'GraphQL'
  | 'Rust'
  | 'Go'
  | 'CI/CD'
  | 'Terraform'
  | 'Serverless'
  | 'Security'
  | 'Performance'
  | 'Architecture';

/** A single AI-generated post in the user's feed. */
export interface Post {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly summary: string;
  readonly content?: string;
  readonly tags: Tag[];
  readonly gradient: readonly [string, string];
  readonly createdAt: string;
  /** ISO 8601 — present only when the user has saved this post. */
  readonly savedAt?: string;
}

/** Paginated response from GET /posts/saved. */
export interface SavedPostsResponse {
  readonly posts: Post[];
  readonly cursor: string | null;
  readonly hasMore: boolean;
}

/** Response from POST /post/:id/save. */
export interface SavePostResponse {
  readonly savedAt: string;
}

/** Response from DELETE /post/:id/save. */
export interface UnsavePostResponse {
  readonly message: string;
}

/** Authenticated user profile stored in DynamoDB and synced to the Zustand store. */
export interface UserProfile {
  readonly userId: string;
  readonly email: string;
  readonly description: string | null;
  readonly activeTags: Tag[];
}

/** Paginated response from GET /feed. */
export interface FeedResponse {
  readonly posts: Post[];
  readonly cursor: string | null;
  readonly hasMore: boolean;
}

/** Response from POST /feed/request. */
export interface GenerationResponse {
  readonly requestIds: string[];
  readonly status: 'PENDING';
  readonly message: string;
}

/** Response from GET /user/preferences. */
export interface UserPreferences {
  readonly userId: string;
  readonly description: string | null;
  readonly activeTags: Tag[];
  readonly availableTags: Tag[];
}

/** Response from PUT /user/profile after AI tag extraction. */
export interface UpdateProfileResponse {
  readonly description: string;
  readonly activeTags: Tag[];
  readonly updatedAt: string;
}
