import * as React from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/app";
import { configureAmplify } from "@/lib/cognito";
import { VITE_MODE } from "@/lib/env";
import "@/styles/globals.css";

/**
 * Application entry point.
 *
 * 1. Configures Amplify Auth (no-op in dev when env vars are absent).
 * 2. Starts the MSW ServiceWorker in development so every fetch is intercepted.
 * 3. Attempts to restore an existing Cognito session before rendering, preventing
 *    a flash-redirect to the login page on page refresh.
 * 4. Renders the React tree.
 */
async function enableMocking(): Promise<void> {
  if (VITE_MODE !== "development") return;

  const { worker } = await import("@/mocks/browser");
  await worker.start({
    onUnhandledRequest: "warn",
    serviceWorker: {
      url: "/mock-service-worker.js",
    },
  });
}

async function restoreSession(): Promise<void> {
  const { useAuthStore } = await import("@/stores/auth");
  await useAuthStore.getState().restoreSession();
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element #root not found in DOM");
}

configureAmplify();

void enableMocking()
  .then(restoreSession)
  .then(() => {
    createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
