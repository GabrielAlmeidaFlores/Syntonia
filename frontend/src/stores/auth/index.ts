import { create } from 'zustand';

import { MOCK_AUTH_USER } from './mock-users';

import type { UserProfile } from '@/types';

interface AuthState {
  readonly user: UserProfile | null;
  readonly isAuthenticated: boolean;
  /** Simulates the Cognito OAuth callback — instantly logs in with the mock user. */
  readonly mockCognitoLogin: () => void;
  readonly logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  mockCognitoLogin: () => {
    set({ user: MOCK_AUTH_USER, isAuthenticated: true });
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
