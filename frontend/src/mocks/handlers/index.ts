import { authHandlers } from "./auth";
import { feedHandlers } from "./feed";
import { legalHandlers } from "./legal";
import { likeHandlers } from "./likes";
import { savedHandlers } from "./saved";
import { userHandlers } from "./user";

/**
 * Combined list of all MSW request handlers.
 * Imported by `src/mocks/browser.ts` to configure the ServiceWorker.
 */
export const handlers = [
  ...authHandlers,
  ...feedHandlers,
  ...legalHandlers,
  ...likeHandlers,
  ...savedHandlers,
  ...userHandlers,
];
