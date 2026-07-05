import type { Language, Theme } from "@/stores/preferences";

/**
 * Content tag — free-form string extracted by the AI from the user's
 * profile description. Any value is valid; no predefined allow-list.
 */
export type Tag = string;

/**
 * Machine-readable error codes returned by the backend on all non-2xx responses.
 * The frontend maps each code to a translated user-facing message via `t.errors`.
 */
export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "POST_NOT_FOUND"
  | "POST_NOT_SAVED"
  | "POST_NOT_LIKED"
  | "LEGAL_DOCUMENT_NOT_FOUND"
  | "VALIDATION_ERROR"
  | "TERMS_VERSION_MISMATCH"
  | "GENERATION_LIMIT_REACHED"
  | "RATE_LIMIT_EXCEEDED"
  | "AI_EXTRACTION_FAILED"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

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
  /** ISO 8601 — present only when the user has liked this post. */
  readonly likedAt?: string;
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
export type UnsavePostResponse = Record<string, never>;

/** Response from POST /post/:id/like. */
export interface LikePostResponse {
  readonly likedAt: string;
}

/** Response from DELETE /post/:id/like. */
export type UnlikePostResponse = Record<string, never>;

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
  readonly status: "PENDING";
}

/** Response from GET /user/preferences. */
export interface UserPreferences {
  readonly userId: string;
  readonly description: string | null;
  readonly activeTags: Tag[];
  readonly theme: Theme;
  readonly language: Language;
}

/** Response from PUT /user/profile after AI tag extraction. */
export interface UpdateProfileResponse {
  readonly description: string;
  readonly activeTags: Tag[];
  readonly updatedAt: string;
}

/** Response from GET /legal/terms-status. */
export interface TermsStatus {
  readonly needsAcceptance: boolean;
  readonly termsVersion: string;
  readonly privacyVersion: string;
}

/** Response from GET /legal/{type}?lang={en|pt-BR}. */
export interface LegalDocument {
  readonly typeLanguage: string;
  readonly type: "terms" | "privacy";
  readonly language: "en" | "pt-BR";
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly content: string;
}

/** Request body for POST /legal/accept. */
export interface AcceptTermsRequest {
  readonly termsVersion: string;
  readonly privacyVersion: string;
}

/** Response from POST /legal/accept. */
export interface AcceptTermsResponse {
  readonly acceptedAt: string;
}
