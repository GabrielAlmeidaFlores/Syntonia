import type { Tag } from './tag.js';
import type { Theme } from './theme.js';
import type { Language } from './language.js';

/** DynamoDB item shape for SintoniaUsers. */
export interface UserRecord {
  readonly userId: string;
  readonly email: string;
  readonly description?: string;
  readonly activeTags: Tag[];
  readonly theme?: Theme;
  readonly language?: Language;
  readonly termsAcceptedVersion?: string;
  readonly privacyAcceptedVersion?: string;
  readonly termsAcceptedAt?: string;
  readonly createdAt: string;
  readonly lastActiveAt: string;
}
