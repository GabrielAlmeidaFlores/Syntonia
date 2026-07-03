import { create } from 'zustand';

interface TermsState {
  /** Whether the user must accept new terms before using the app. */
  readonly needsAcceptance: boolean;
  /** Current terms version from the backend. */
  readonly termsVersion: string;
  /** Current privacy policy version from the backend. */
  readonly privacyVersion: string;
  /** True while GET /legal/terms-status is in flight. */
  readonly isChecking: boolean;
  readonly setStatus: (needsAcceptance: boolean, termsVersion: string, privacyVersion: string) => void;
  readonly setChecking: (checking: boolean) => void;
  readonly clearAcceptance: () => void;
}

/**
 * Stores the user's current terms acceptance status as returned by the backend.
 * Not persisted — checked on every authenticated session start via GET /legal/terms-status.
 * When `needsAcceptance` is true, `TermsAcceptanceModal` blocks the entire app.
 */
export const useTermsStore = create<TermsState>((set) => ({
  needsAcceptance: false,
  termsVersion: '',
  privacyVersion: '',
  isChecking: false,

  setStatus: (needsAcceptance, termsVersion, privacyVersion) =>
    set({ needsAcceptance, termsVersion, privacyVersion }),

  setChecking: (isChecking) => set({ isChecking }),

  clearAcceptance: () =>
    set({ needsAcceptance: false }),
}));
