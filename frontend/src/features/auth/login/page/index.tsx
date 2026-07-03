import { Sparkles } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

/**
 * Mock Cognito login page.
 *
 * In production, Cognito Hosted UI handles authentication and this page does not exist.
 * In the mock, a single button calls POST /auth/callback — MSW intercepts the request
 * and returns the mock user + token, simulating the real Cognito OAuth redirect flow.
 */
export default function MockCognitoPage(): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const setProfile = useUserStore((s) => s.setProfile);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useTranslation();

  const returnTo = searchParams.get('returnTo') ?? '/feed';

  const handleLogin = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await login('mock-cognito-code');

      const { user } = useAuthStore.getState();
      if (user?.description !== null && user?.description !== undefined) {
        setProfile(user.description, user.activeTags);
      }

      navigate(returnTo, { replace: true });
    } catch {
      setError(t.auth.errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-surface px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted">
          <Sparkles className="h-8 w-8 text-accent-light" aria-hidden />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-content-primary">{t.auth.appTitle}</h1>
          <p className="text-sm text-content-muted">{t.auth.appSubtitle}</p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card p-6">
        <div className="mb-6 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-content-subtle">
            {t.auth.mockLabel}
          </p>
          <h2 className="text-lg font-semibold text-content-primary">{t.auth.signinHeading}</h2>
          <p className="mt-1 text-sm text-content-muted">{t.auth.signinDescription}</p>
        </div>

        {error !== null && (
          <p className="mb-4 rounded-lg bg-red-950 px-3 py-2 text-center text-sm text-red-400">
            {error}
          </p>
        )}

        <Button
          variant="primary"
          className="w-full"
          disabled={loading}
          onClick={() => {
            void handleLogin();
          }}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {t.auth.signingInButton}
            </span>
          ) : (
            t.auth.signinButton
          )}
        </Button>
      </div>
    </div>
  );
}
