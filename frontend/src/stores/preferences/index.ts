import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Visual theme applied to the application. */
export type Theme = 'dark' | 'light';

/** UI language used for content labels. */
export type Language = 'en' | 'pt-BR';

interface PreferencesState {
  readonly theme: Theme;
  readonly language: Language;
  readonly setTheme: (theme: Theme) => void;
  readonly setLanguage: (language: Language) => void;
}

/**
 * Detects the user's operating-system color scheme preference.
 * Falls back to 'dark' if the API is unavailable (e.g. SSR).
 */
function detectSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Persisted store for user preferences: visual theme and UI language.
 * On first visit, theme is initialised from the OS color-scheme preference.
 * Changes are written to localStorage under the key `syntonia-preferences`.
 */
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: detectSystemTheme(),
      language: 'en',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
    }),
    { name: 'syntonia-preferences' },
  ),
);
