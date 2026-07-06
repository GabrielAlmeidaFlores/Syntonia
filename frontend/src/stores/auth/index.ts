import { create } from "zustand";

import { appCache } from "@/lib/cache";
import { VITE_MODE } from "@/lib/env";
import type { UserProfile } from "@/types";

interface AuthCallbackResponse {
  readonly user: UserProfile;
  readonly token: string;
}

interface PrefsResponse {
  readonly userId: string;
  readonly description: string | null;
  readonly activeTags: string[];
  readonly theme: string;
  readonly language: string;
}

interface AuthState {
  readonly user: UserProfile | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  /**
   * Signs the user in.
   * In development, delegates to the MSW mock via POST /auth/callback.
   * In production, calls Cognito via the Amplify SDK and then fetches the
   * user's preferences to hydrate the profile.
   */
  readonly login: (email: string, password: string) => Promise<void>;
  /**
   * Signs the user out.
   * In production, calls Cognito signOut in the background before clearing
   * local state so the refresh token is revoked.
   */
  readonly logout: () => void;
  /**
   * Attempts to restore a previous Cognito session on app boot.
   * No-op in development (MSW handles authentication state).
   * Called once from main.tsx before the React tree renders.
   */
  readonly restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
    if (VITE_MODE === "development") {
      const { api } = await import("@/services/api");
      const response = await api.post<AuthCallbackResponse>("/auth/callback", {
        code: email,
      });
      set({ user: response.user, token: response.token, isAuthenticated: true });
      return;
    }

    const { signIn, fetchAuthSession, fetchUserAttributes } = await import(
      "@aws-amplify/auth"
    );
    await signIn({ username: email, password });
    const [session, attrs] = await Promise.all([
      fetchAuthSession(),
      fetchUserAttributes(),
    ]);
    const token = session.tokens?.idToken?.toString() ?? "";
    const { api } = await import("@/services/api");
    const prefs = await api.get<PrefsResponse>("/user/preferences");
    set({
      user: {
        userId: prefs.userId,
        email: attrs.email ?? email,
        description: prefs.description,
        activeTags: prefs.activeTags,
      },
      token,
      isAuthenticated: true,
    });
  },

  logout: () => {
    if (VITE_MODE !== "development") {
      void import("@aws-amplify/auth").then(({ signOut }) => {
        void signOut();
      });
    }
    appCache.invalidateAll();
    set({ user: null, token: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    if (VITE_MODE === "development") return;
    try {
      const { fetchAuthSession, fetchUserAttributes } = await import(
        "@aws-amplify/auth"
      );
      const session = await fetchAuthSession();
      if (session.tokens?.idToken === undefined) return;
      const token = session.tokens.idToken.toString();
      if (token === "") return;
      const [attrs, { api }] = await Promise.all([
        fetchUserAttributes(),
        import("@/services/api"),
      ]);
      const prefs = await api.get<PrefsResponse>("/user/preferences");
      set({
        user: {
          userId: prefs.userId,
          email: attrs.email ?? "",
          description: prefs.description,
          activeTags: prefs.activeTags,
        },
        token,
        isAuthenticated: true,
      });
      if (prefs.description !== null && prefs.description !== "") {
        const { useUserStore } = await import("@/stores/user");
        useUserStore.getState().syncFromServer(prefs.description, prefs.activeTags);
      }
    } catch {
      return;
    }
  },
}));
