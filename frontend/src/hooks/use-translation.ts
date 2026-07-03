import { translations } from '@/lib/i18n';
import { usePreferencesStore } from '@/stores/preferences';

/**
 * Returns the translations object for the currently selected language.
 * Reads `usePreferencesStore.language` reactively — the returned object
 * updates automatically when the user switches language in Settings.
 */
export function useTranslation(): (typeof translations)[keyof typeof translations] {
  const language = usePreferencesStore((s) => s.language);
  return translations[language];
}
