import { z } from 'zod';

/** Thrown when Zod schema validation fails. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates `data` against `schema`. Returns the parsed value on success.
 * Throws `ValidationError` on failure — caught by handlers and returned as 400.
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join('; ');
    throw new ValidationError(message);
  }
  return result.data;
}

/**
 * POST /feed/request body schema.
 *
 * Tags are free-form strings — any value is accepted. The AI extracts
 * whatever tags are relevant to the user's description; there is no
 * predefined allow-list enforced here.
 */
export const feedRequestSchema = z.object({
  tags: z.array(z.string().min(1).max(100)).min(1).max(50),
  quantity: z.number().int().min(1).max(5).default(3),
});

/**
 * PUT /user/preferences body schema.
 * Patch endpoint — at least one field must be provided.
 */
export const updatePreferencesSchema = z.object({
  activeTags: z.array(z.string().min(1).max(100)).min(1).max(50).optional(),
  theme: z.enum(['dark', 'light']).optional(),
  language: z.enum(['en', 'pt-BR']).optional(),
}).refine(
  (d) => d.activeTags !== undefined || d.theme !== undefined || d.language !== undefined,
  { message: 'At least one field (activeTags, theme, language) must be provided' },
);

/** PUT /user/profile body schema. */
export const updateProfileSchema = z.object({
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(500, 'Description must be at most 500 characters'),
});

/** POST /legal/accept body schema. */
export const acceptLegalTermsSchema = z.object({
  termsVersion: z.string().min(1),
  privacyVersion: z.string().min(1),
});
