import type { Tag } from './types/index.js';

/**
 * Default content tags applied to every new user profile at signup.
 *
 * These are intentionally diverse and broad so that any new user — regardless
 * of background — gets an interesting and varied feed from day one.
 * The user refines their interests by writing a profile description in
 * /onboarding, which triggers AI tag extraction to replace these defaults.
 */
export const DEFAULT_TAGS: Tag[] = [
  'technology',
  'travel',
  'health & fitness',
  'science',
  'productivity',
  'business & entrepreneurship',
  'personal finance',
];

/**
 * Default profile description applied to new users at signup.
 *
 * Paired with DEFAULT_TAGS to ensure the first AI-generated posts are
 * relevant and diverse. The user replaces this in /onboarding.
 */
export const DEFAULT_DESCRIPTION =
  'Curious person who enjoys exploring new ideas across technology, travel, health, science, and personal growth.';
