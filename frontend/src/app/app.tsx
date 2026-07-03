import * as Tooltip from "@radix-ui/react-tooltip";
import * as React from "react";

import { TermsAcceptanceModal } from "@/components/ui/terms-acceptance-modal";
import { ToastContainer } from "@/components/ui/toast";
import { AppRouter } from "@/router";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { useTermsStore } from "@/stores/terms";
import type { TermsStatus } from "@/types";

/**
 * Root application component.
 *
 * On desktop, centers the app in a max-w-[560px] phone-style container.
 * The outer background is a mesh-gradient effect that adapts to the active theme.
 *
 * Theme synchronisation: on every change to `usePreferencesStore.theme`, the
 * corresponding class (`dark` or `light`) is applied to `<html>`.
 *
 * Terms check: after authentication, GET /legal/terms-status is called once.
 * If `needsAcceptance: true`, TermsAcceptanceModal blocks the entire app until
 * the user accepts. The modal is rendered at z-index 99999 via React Portal.
 */
export function App(): React.JSX.Element {
  const theme = usePreferencesStore((s) => s.theme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setStatus = useTermsStore((s) => s.setStatus);
  const setChecking = useTermsStore((s) => s.setChecking);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
  }, [theme]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    setChecking(true);
    void api
      .get<TermsStatus>("/legal/terms-status")
      .then((status) => {
        setStatus(
          status.needsAcceptance,
          status.termsVersion,
          status.privacyVersion,
        );
      })
      .finally(() => {
        setChecking(false);
      });
  }, [isAuthenticated, setStatus, setChecking]);

  const isDark = theme === "dark";
  const outerBg = isDark ? "#060714" : "#dde3ee";
  const orbs = isDark
    ? [
        "radial-gradient(ellipse 70% 60% at 20% 10%, rgba(79,70,229,0.28) 0%, transparent 70%)",
        "radial-gradient(ellipse 60% 55% at 80% 85%, rgba(124,58,237,0.22) 0%, transparent 65%)",
        "radial-gradient(ellipse 50% 40% at 55% 45%, rgba(99,102,241,0.10) 0%, transparent 60%)",
      ].join(", ")
    : [
        "radial-gradient(ellipse 70% 60% at 20% 10%, rgba(79,70,229,0.12) 0%, transparent 70%)",
        "radial-gradient(ellipse 60% 55% at 80% 85%, rgba(124,58,237,0.10) 0%, transparent 65%)",
        "radial-gradient(ellipse 50% 40% at 55% 45%, rgba(99,102,241,0.06) 0%, transparent 60%)",
      ].join(", ");

  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <div
        className="relative flex min-h-dvh justify-center overflow-hidden"
        style={{ backgroundColor: outerBg }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: orbs }}
        />
        <div className="relative w-full max-w-[560px]">
          <AppRouter />
        </div>
      </div>
      <ToastContainer />
      <TermsAcceptanceModal />
    </Tooltip.Provider>
  );
}
