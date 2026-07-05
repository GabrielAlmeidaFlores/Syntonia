/** Machine-readable error codes returned by the backend on all non-2xx responses. */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'POST_NOT_FOUND'
  | 'POST_NOT_SAVED'
  | 'POST_NOT_LIKED'
  | 'LEGAL_DOCUMENT_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'TERMS_VERSION_MISMATCH'
  | 'GENERATION_LIMIT_REACHED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'AI_EXTRACTION_FAILED'
  | 'INTERNAL_ERROR';
