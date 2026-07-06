import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useTranslation } from "@/hooks/use-translation";
import { VITE_MODE } from "@/lib/env";
import { getApiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";

type AuthMode = "signin" | "signup" | "confirm";

/**
 * Authentication page — handles sign-in, sign-up, and email confirmation.
 *
 * In development: shows a single "Continue with Cognito" button (MSW mock).
 * In production: shows real email+password forms connected to the Cognito User Pool.
 *   - Sign-in: email + password → Amplify signIn
 *   - Sign-up: email + password + confirm password → Amplify signUp
 *   - Confirm: 6-digit code from email → Amplify confirmSignUp → auto sign-in
 */
export default function LoginPage(): React.JSX.Element {
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/feed";

  const login = useAuthStore((s) => s.login);
  const syncFromServer = useUserStore((s) => s.syncFromServer);

  const isMock = VITE_MODE === "development";

  const [mode, setMode] = React.useState<AuthMode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [confirmCode, setConfirmCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const clearError = (): void => {
    setError(null);
  };

  const switchMode = (next: AuthMode): void => {
    clearError();
    setMode(next);
  };

  const afterSignIn = (): void => {
    const { user } = useAuthStore.getState();
    if (
      user?.description !== undefined &&
      user.description !== null &&
      user.description !== ""
    ) {
      syncFromServer(user.description, user.activeTags);
    }
    navigate(returnTo, { replace: true });
  };

  const handleSignIn = async (): Promise<void> => {
    setLoading(true);
    clearError();
    try {
      await login(email, password);
      afterSignIn();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t.errors));
      setLoading(false);
    }
  };

  const handleSignUp = async (): Promise<void> => {
    if (password !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      return;
    }
    setLoading(true);
    clearError();
    try {
      const { signUp } = await import("@aws-amplify/auth");
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });
      setMode("confirm");
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errors.INTERNAL_ERROR);
      setLoading(false);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    clearError();
    try {
      const { confirmSignUp } = await import("@aws-amplify/auth");
      await confirmSignUp({ username: email, confirmationCode: confirmCode });
      await login(email, password);
      afterSignIn();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errors.INTERNAL_ERROR);
      setLoading(false);
    }
  };

  const headings: Record<AuthMode, string> = {
    signin: t.auth.signinHeading,
    signup: t.auth.signupHeading,
    confirm: t.auth.confirmHeading,
  };

  return (
    <motion.div
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-12"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
            <Sparkles className="h-7 w-7 text-accent-light" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-content-primary">
              {t.auth.appTitle}
            </h1>
            <p className="mt-1 text-sm text-content-muted">
              {t.auth.appSubtitle}
            </p>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-surface-border bg-surface-card p-6">
          {isMock && (
            <div className="mb-4 rounded-lg bg-accent-muted px-3 py-1.5 text-center">
              <span className="text-xs font-medium text-accent-light">
                {t.auth.mockLabel}
              </span>
            </div>
          )}

          <h2 className="mb-1 text-base font-semibold text-content-primary">
            {headings[mode]}
          </h2>

          {mode === "confirm" ? (
            <p className="mb-5 text-xs text-content-muted">
              {t.auth.confirmDescription(email)}
            </p>
          ) : (
            <p className="mb-5 text-xs text-content-muted">
              {isMock ? t.auth.signinDescription : t.auth.appSubtitle}
            </p>
          )}

          {!isMock && mode === "signin" && (
            <div className="mb-4 flex flex-col gap-3">
              <Input
                type="email"
                placeholder={t.auth.emailPlaceholder}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                disabled={loading}
                aria-label={t.auth.emailPlaceholder}
              />
              <PasswordInput
                placeholder={t.auth.passwordPlaceholder}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                disabled={loading}
                aria-label={t.auth.passwordPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void handleSignIn();
                }}
              />
            </div>
          )}

          {!isMock && mode === "signup" && (
            <div className="mb-4 flex flex-col gap-3">
              <Input
                type="email"
                placeholder={t.auth.emailPlaceholder}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                disabled={loading}
                aria-label={t.auth.emailPlaceholder}
              />
              <PasswordInput
                placeholder={t.auth.passwordPlaceholder}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                disabled={loading}
                aria-label={t.auth.passwordPlaceholder}
              />
              <PasswordInput
                placeholder={t.auth.passwordConfirmPlaceholder}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                }}
                disabled={loading}
                aria-label={t.auth.passwordConfirmPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void handleSignUp();
                }}
              />
            </div>
          )}

          {!isMock && mode === "confirm" && (
            <div className="mb-4">
              <Input
                type="text"
                placeholder={t.auth.confirmCodePlaceholder}
                value={confirmCode}
                onChange={(e) => {
                  setConfirmCode(e.target.value);
                }}
                disabled={loading}
                aria-label={t.auth.confirmCodePlaceholder}
                maxLength={6}
                inputMode="numeric"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void handleConfirm();
                }}
              />
            </div>
          )}

          {error !== null && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400"
            >
              {error}
            </p>
          )}

          {isMock ? (
            <Button
              className="w-full"
              onClick={() => {
                void handleSignIn();
              }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  {t.auth.signingInButton}
                </span>
              ) : (
                t.auth.signinButton
              )}
            </Button>
          ) : mode === "signin" ? (
            <>
              <Button
                className="w-full"
                onClick={() => {
                  void handleSignIn();
                }}
                disabled={loading || email.length === 0 || password.length === 0}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden
                    />
                    {t.auth.signingInButton}
                  </span>
                ) : (
                  t.auth.realSigninButton
                )}
              </Button>
              <button
                type="button"
                className="mt-4 w-full text-center text-xs text-content-muted transition-colors hover:text-content-primary"
                onClick={() => {
                  switchMode("signup");
                }}
              >
                {t.auth.switchToSignup}
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              <Button
                className="w-full"
                onClick={() => {
                  void handleSignUp();
                }}
                disabled={
                  loading ||
                  email.length === 0 ||
                  password.length === 0 ||
                  confirmPassword.length === 0
                }
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      aria-hidden
                    />
                    {t.auth.creatingAccountButton}
                  </span>
                ) : (
                  t.auth.createAccountButton
                )}
              </Button>
              <button
                type="button"
                className="mt-4 w-full text-center text-xs text-content-muted transition-colors hover:text-content-primary"
                onClick={() => {
                  switchMode("signin");
                }}
              >
                {t.auth.switchToSignin}
              </button>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                void handleConfirm();
              }}
              disabled={loading || confirmCode.length !== 6}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  {t.auth.confirmingButton}
                </span>
              ) : (
                t.auth.confirmButton
              )}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
