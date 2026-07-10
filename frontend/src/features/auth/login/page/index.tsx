import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useTranslation } from "@/hooks/use-translation";
import { getApiErrorMessage } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useUserStore } from "@/stores/user";

type AuthMode = "signin" | "signup" | "confirm" | "forgotPassword" | "resetPassword";

interface ButtonConfig {
  readonly text: string;
  readonly loadingText: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
}

interface SwitchLinkConfig {
  readonly label: string;
  readonly onClick: () => void;
}

/**
 * Authentication page — handles sign-in, sign-up, email confirmation,
 * forgot-password and password-reset flows via the Cognito User Pool.
 *
 * - Sign-in: email + password → Amplify signIn
 * - Sign-up: email + password + confirm password → Amplify signUp
 * - Confirm: 6-digit code → Amplify confirmSignUp → auto sign-in
 * - Forgot password: email → Amplify resetPassword (sends code)
 * - Reset password: code + new password → Amplify confirmResetPassword → back to sign-in
 */
export default function LoginPage(): React.JSX.Element {
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/feed";

  const login = useAuthStore((s) => s.login);
  const syncFromServer = useUserStore((s) => s.syncFromServer);

  const [mode, setMode] = React.useState<AuthMode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmCode, setConfirmCode] = React.useState("");
  const [resetCode, setResetCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const clearMessages = (): void => {
    setError(null);
    setSuccessMsg(null);
  };

  const switchMode = (next: AuthMode): void => {
    clearMessages();
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
    clearMessages();
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
    clearMessages();
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
    clearMessages();
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

  const handleForgotPassword = async (): Promise<void> => {
    setLoading(true);
    clearMessages();
    try {
      const { resetPassword } = await import("@aws-amplify/auth");
      await resetPassword({ username: email });
      setMode("resetPassword");
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errors.INTERNAL_ERROR);
      setLoading(false);
    }
  };

  const handleResetPassword = async (): Promise<void> => {
    setLoading(true);
    clearMessages();
    try {
      const { confirmResetPassword } = await import("@aws-amplify/auth");
      await confirmResetPassword({
        username: email,
        confirmationCode: resetCode,
        newPassword,
      });
      setResetCode("");
      setNewPassword("");
      setPassword("");
      setMode("signin");
      setSuccessMsg(t.auth.resetPasswordSuccess);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errors.INTERNAL_ERROR);
      setLoading(false);
    }
  };

  const headings: Record<AuthMode, string> = {
    signin: t.auth.signinHeading,
    signup: t.auth.signupHeading,
    confirm: t.auth.confirmHeading,
    forgotPassword: t.auth.forgotPasswordHeading,
    resetPassword: t.auth.resetPasswordHeading,
  };

  const descriptions: Record<AuthMode, string> = {
    signin: t.auth.appSubtitle,
    signup: t.auth.appSubtitle,
    confirm: t.auth.confirmDescription(email),
    forgotPassword: t.auth.forgotPasswordDescription,
    resetPassword: t.auth.resetPasswordDescription(email),
  };

  const buttonConfigs: Record<AuthMode, ButtonConfig> = {
    signin: {
      text: t.auth.signinButton,
      loadingText: t.auth.signingInButton,
      onClick: () => { void handleSignIn(); },
      disabled: email.length === 0 || password.length === 0,
    },
    signup: {
      text: t.auth.createAccountButton,
      loadingText: t.auth.creatingAccountButton,
      onClick: () => { void handleSignUp(); },
      disabled: email.length === 0 || password.length === 0 || confirmPassword.length === 0,
    },
    confirm: {
      text: t.auth.confirmButton,
      loadingText: t.auth.confirmingButton,
      onClick: () => { void handleConfirm(); },
      disabled: confirmCode.length !== 6,
    },
    forgotPassword: {
      text: t.auth.sendCodeButton,
      loadingText: t.auth.sendingCodeButton,
      onClick: () => { void handleForgotPassword(); },
      disabled: email.length === 0,
    },
    resetPassword: {
      text: t.auth.resetPasswordButton,
      loadingText: t.auth.resettingPasswordButton,
      onClick: () => { void handleResetPassword(); },
      disabled: resetCode.length !== 6 || newPassword.length === 0,
    },
  };

  const switchLinks: Partial<Record<AuthMode, SwitchLinkConfig>> = {
    signin: { label: t.auth.switchToSignup, onClick: () => { switchMode("signup"); } },
    signup: { label: t.auth.switchToSignin, onClick: () => { switchMode("signin"); } },
    forgotPassword: { label: t.auth.backToSignIn, onClick: () => { switchMode("signin"); } },
    resetPassword: { label: t.auth.backToSignIn, onClick: () => { switchMode("signin"); } },
  };

  const btn = buttonConfigs[mode];
  const switchLink = switchLinks[mode];

  return (
    <motion.div
      className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 py-12"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted">
          <Sparkles className="h-6 w-6 text-accent-light" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-content-primary">
          {t.auth.appTitle}
        </h1>
        <p className="text-sm text-content-muted">{t.auth.appSubtitle}</p>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
        <div className="flex flex-col gap-5 p-6">
          <div className="border-b border-surface-border pb-4">
            <h2 className="text-base font-semibold text-content-primary">
              {headings[mode]}
            </h2>
            <p className="mt-1 text-sm text-content-muted">
              {descriptions[mode]}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {mode === "signin" && (
              <>
                <Input
                  type="email"
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); }}
                  disabled={loading}
                  aria-label={t.auth.emailPlaceholder}
                />
                <div className="flex flex-col gap-1.5">
                  <PasswordInput
                    placeholder={t.auth.passwordPlaceholder}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); }}
                    disabled={loading}
                    aria-label={t.auth.passwordPlaceholder}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !loading) void handleSignIn();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { switchMode("forgotPassword"); }}
                    className="self-end text-xs text-content-subtle transition-colors hover:text-accent-light"
                  >
                    {t.auth.forgotPasswordLink}
                  </button>
                </div>
              </>
            )}

            {mode === "signup" && (
              <>
                <Input
                  type="email"
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); }}
                  disabled={loading}
                  aria-label={t.auth.emailPlaceholder}
                />
                <PasswordInput
                  placeholder={t.auth.passwordPlaceholder}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); }}
                  disabled={loading}
                  aria-label={t.auth.passwordPlaceholder}
                />
                <PasswordInput
                  placeholder={t.auth.passwordConfirmPlaceholder}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); }}
                  disabled={loading}
                  aria-label={t.auth.passwordConfirmPlaceholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) void handleSignUp();
                  }}
                />
              </>
            )}

            {mode === "confirm" && (
              <Input
                type="text"
                placeholder={t.auth.confirmCodePlaceholder}
                value={confirmCode}
                onChange={(e) => { setConfirmCode(e.target.value); }}
                disabled={loading}
                aria-label={t.auth.confirmCodePlaceholder}
                maxLength={6}
                inputMode="numeric"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void handleConfirm();
                }}
              />
            )}

            {mode === "forgotPassword" && (
              <Input
                type="email"
                placeholder={t.auth.emailPlaceholder}
                value={email}
                onChange={(e) => { setEmail(e.target.value); }}
                disabled={loading}
                aria-label={t.auth.emailPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void handleForgotPassword();
                }}
              />
            )}

            {mode === "resetPassword" && (
              <>
                <Input
                  type="text"
                  placeholder={t.auth.confirmCodePlaceholder}
                  value={resetCode}
                  onChange={(e) => { setResetCode(e.target.value); }}
                  disabled={loading}
                  aria-label={t.auth.confirmCodePlaceholder}
                  maxLength={6}
                  inputMode="numeric"
                />
                <PasswordInput
                  placeholder={t.auth.newPasswordPlaceholder}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); }}
                  disabled={loading}
                  aria-label={t.auth.newPasswordPlaceholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) void handleResetPassword();
                  }}
                />
              </>
            )}
          </div>

          <AnimatePresence mode="wait">
            {error !== null && (
              <motion.p
                key="error"
                role="alert"
                className="rounded-lg bg-feedback-error px-3 py-2.5 text-sm text-feedback-error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {error}
              </motion.p>
            )}
            {successMsg !== null && (
              <motion.p
                key="success"
                role="status"
                className="rounded-lg bg-feedback-success px-3 py-2.5 text-sm text-feedback-success"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {successMsg}
              </motion.p>
            )}
          </AnimatePresence>

          <Button
            className="w-full"
            onClick={btn.onClick}
            disabled={loading || btn.disabled}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                {btn.loadingText}
              </span>
            ) : (
              btn.text
            )}
          </Button>
        </div>
      </div>

      {switchLink !== undefined && (
        <button
          type="button"
          className="text-sm text-content-muted transition-colors hover:text-content-primary"
          onClick={switchLink.onClick}
        >
          {switchLink.label}
        </button>
      )}
    </motion.div>
  );
}
