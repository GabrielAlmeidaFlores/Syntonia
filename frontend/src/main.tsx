import * as React from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/app";
import { configureAmplify } from "@/lib/cognito";
import "@/styles/globals.css";

const SPLASH_MIN_MS = 1500;
const SPLASH_FADE_MS = 700;
const splashStart = Date.now();

/**
 * Application entry point.
 *
 * 1. Configures Amplify Auth with Cognito credentials from environment variables.
 * 2. Attempts to restore an existing Cognito session before rendering, preventing
 *    a flash-redirect to the login page on page refresh.
 * 3. Renders the React tree.
 * 4. Removes the splash screen after a minimum visible duration with a fade-out.
 */
async function restoreSession(): Promise<void> {
  const { useAuthStore } = await import("@/stores/auth");
  await useAuthStore.getState().restoreSession();
}

function removeSplash(): void {
  const splash = document.getElementById("splash");
  if (splash === null) return;

  const elapsed = Date.now() - splashStart;
  const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);

  setTimeout(() => {
    splash.classList.add("splash-exit");
    setTimeout(() => {
      splash.remove();
    }, SPLASH_FADE_MS);
  }, remaining);
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element #root not found in DOM");
}

configureAmplify();

void restoreSession().then(() => {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  removeSplash();
});
