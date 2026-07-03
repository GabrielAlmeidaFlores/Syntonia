import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

/**
 * MSW ServiceWorker instance for the browser.
 *
 * Started in development via main.tsx before React renders.
 * Intercepts all fetch calls made by `src/services/api.ts` and returns
 * the mock responses defined in `src/mocks/handlers/`.
 */
export const worker = setupWorker(...handlers);
