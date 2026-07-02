import { Sparkles } from 'lucide-react';
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { sleep } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { MOCK_AUTH_USER } from '@/stores/auth/mock-users';
import { useUserStore } from '@/stores/user';

/**
 * Mock Cognito login page.
 *
 * In production, Cognito Hosted UI handles authentication and this page does not exist.
 * In the mock, a single button simulates the OAuth redirect returning with a session.
 */
export default function MockCognitoPage(): React.JSX.Element {
  const [loading, setLoading] = React.useState(false);
  const mockCognitoLogin = useAuthStore((s) => s.mockCognitoLogin);
  const setProfile = useUserStore((s) => s.setProfile);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const returnTo = searchParams.get('returnTo') ?? '/feed';

  const handleLogin = async (): Promise<void> => {
    setLoading(true);
    await sleep(800);

    mockCognitoLogin();

    if (MOCK_AUTH_USER.description !== null) {
      setProfile(MOCK_AUTH_USER.description, MOCK_AUTH_USER.activeTags);
    }

    navigate(returnTo, { replace: true });
  };

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-surface px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted">
          <Sparkles className="h-8 w-8 text-accent-light" aria-hidden />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Syntonia</h1>
          <p className="text-sm text-gray-400">Personal Learning Engine</p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card p-6">
        <div className="mb-6 text-center">
          <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">
            Mock Cognito Hosted UI
          </p>
          <h2 className="text-lg font-semibold text-white">Sign in to continue</h2>
          <p className="mt-1 text-sm text-gray-400">
            In production, Cognito handles authentication. This simulates the OAuth redirect.
          </p>
        </div>

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
              Signing in…
            </span>
          ) : (
            'Continue with Cognito'
          )}
        </Button>

        <p className="mt-4 text-center text-xs text-gray-600">
          Logs in as <span className="text-gray-400">{MOCK_AUTH_USER.email}</span>
        </p>
      </div>
    </div>
  );
}
