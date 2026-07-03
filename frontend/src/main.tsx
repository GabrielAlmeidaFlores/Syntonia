import * as React from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/app";
import { VITE_MODE } from "@/lib/env";
import "@/styles/globals.css";

/**
 * Application entry point.
 *
 * In development, starts the MSW ServiceWorker before rendering so that every
 * fetch call made by `src/services/api.ts` is intercepted and served by the
 * mock handlers in `src/mocks/handlers/`. In production the worker is never
 * loaded and all requests go to the real API Gateway.
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

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element #root not found in DOM");
}

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
