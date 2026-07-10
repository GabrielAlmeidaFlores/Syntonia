import { create } from "zustand";

import { appCache } from "@/lib/cache";
import { useFeedStore } from "@/stores/feed";
import { useHistoryStore } from "@/stores/history";
import type { UserProfile } from "@/types";

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
   * Signs the user in via Cognito using email and password.
   * Calls Amplify signIn, fetches the session token and user preferences,
   * then hydrates the auth store.
   */
  readonly login: (email: string, password: string) => Promise<void>;
  /**
   * Signs the user out.
   * Calls Cognito signOut in the background to revoke the refresh token,
   * then clears all local state and caches.
   */
  readonly logout: () => void;
  /**
   * Attempts to restore a previous Cognito session on app boot.
   * Called once from main.tsx before the React tree renders.
   * If a valid idToken exists, hydrates the auth and user stores.
   */
  readonly restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
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
    void import("@aws-amplify/auth").then(({ signOut }) => {
      void signOut();
    });
    appCache.invalidateAll();
    useHistoryStore.getState().reset();
    useFeedStore.getState().reset();
    set({ user: null, token: null, isAuthenticated: false });
  },

  restoreSession: async () => {
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
