import { create } from 'zustand';

import type { UserProfile } from '@/types';

interface AuthCallbackResponse {
  readonly user: UserProfile;
  readonly token: string;
}

interface AuthState {
  readonly user: UserProfile | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  /**
   * Exchanges a mock Cognito authorisation code for a user session by calling
   * POST /auth/callback. MSW intercepts the request and returns the mock user
   * with a fake token. In production this would exchange a real Cognito code.
   */
  readonly login: (code: string) => Promise<void>;
  readonly logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (code) => {
    const { api } = await import('@/services/api');
    const response = await api.post<AuthCallbackResponse>('/auth/callback', { code });
    set({ user: response.user, token: response.token, isAuthenticated: true });
  },

  logout: () => {
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
