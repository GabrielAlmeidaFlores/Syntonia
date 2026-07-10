# AGENTS.md — Syntonia Frontend

> **MANDATORY:** Read this file completely before making any change. No exceptions.

---

## §1 — AI Agent Premise

Every AI agent working on this codebase must follow this exact sequence before writing a single line of code:

1. **Read AGENTS.md** (this file) in full.
2. **Map the files** relevant to the task (use the directory tree in §3).
3. **Identify the feature** — which panel, route, and store are involved.
4. **Plan** — write out what you will create/modify before touching any file.
5. **Implement** — follow every rule in this document without exception.
6. **Typecheck** — run `yarn typecheck`. Zero errors before committing.
7. **Lint** — run `yarn lint`. Zero warnings (`--max-warnings 0`) before committing.
8. **Update AGENTS.md** — if you add a component, page, store, or hook, document it here.

**There are no exceptions to this flow.**

---

## §2 — Stack

| Technology            | Version | Purpose                                 |
| --------------------- | ------- | --------------------------------------- |
| React                 | 18.3.x  | UI framework                            |
| TypeScript            | 5.7.x   | Language — strict mode, zero `any`      |
| Vite                  | 6.x     | Build tool + dev server                 |
| Tailwind CSS          | 3.4.x   | Utility-first styling                   |
| Zustand               | 5.x     | Global state management                 |
| React Router          | 6.28.x  | Client-side routing                     |
| Framer Motion         | 11.x    | Swipe animations (PostCard, PostDetail) |
| aws-amplify           | 6.x     | Cognito auth (signIn, signUp, signOut, session restore) |
| react-markdown        | 9.x     | Renders Markdown post content           |
| rehype-highlight      | 7.x     | Syntax highlighting in code blocks      |
| highlight.js          | 11.x    | Highlight themes                        |
| Radix UI              | various | Accessible headless primitives          |
| CVA                   | 0.7.x   | Component variant system                |
| clsx + tailwind-merge | latest  | Class name merging (`cn()`)             |
| Lucide React          | 0.469.x | Icon set                                |

**Node version:** 22.15.0 (enforced via `engines` in package.json)

**All environments:** Cognito (`@aws-amplify/auth`) handles authentication; API Gateway handles all other endpoints. No mock layer — every API call goes to the real backend.

---

## §3 — Directory Structure

```
src/
├── main.tsx                         Entry point. Configures Amplify, restores Cognito session,
│                                    renders App, removes splash screen (min 1500ms + 500ms fade-out).
├── app/
│   ├── app.tsx                      Root component. Syncs theme class on <html>, mesh-gradient
│   │                                outer background, Toast + Tooltip providers + AppRouter.
│   └── layouts/
│       ├── index.tsx                Barrel export for layouts.
│       └── feed-layout.tsx          Authenticated layout: Outlet + bottom nav (Feed | Saved | Profile).
│                                    Logout is inside ProfilePage, not the nav.
├── components/
│   ├── shared/                      Feature-agnostic reusable components.
│   │   ├── empty-feed-screen/       "No posts yet" — shown when feed is empty.
│   │   ├── feed-initial-loading/    Full-screen loading state for initial feed fetch and JIT generation.
│   │   │                            Gradient background, animated Sparkles icon, bouncing dots, skeleton rows.
│   │   ├── spinner/                 Decorative loading spinner using the accent token. Sizes: sm/md/lg.
│   │   └── tag-selector/            Toggleable tag chips. Reads useTranslation() for aria-labels.
│   └── ui/                          Design system primitives (CVA + Radix UI).
│       ├── button/                  Button — variants: primary, outline, ghost, destructive, link.
│       ├── badge/                   Badge — variants: default, accent, outline, success, warning,
│       │                            destructive, tag, tag-active.
│       ├── card/                    Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
│       ├── confirm-modal/           ConfirmModal — bottom-sheet confirmation with backdrop. Used for
│       │                            logout and unsave actions. Portal + AnimatePresence.
│       ├── input/                   Controlled text input (dark theme).
│       ├── legal-doc-modal/         LegalDocModal — bottom-sheet that fetches and renders a legal
│       │                            document (terms/privacy) as Markdown from GET /legal/{type}.
│       ├── password-input/          PasswordInput — text input with Eye/EyeOff toggle button.
│       │                            Wraps the base Input style; manages visible/hidden state internally.
│       ├── share-modal/             ShareModal — bottom-sheet with post URL + copy-to-clipboard button.
│       ├── skeleton/                Shimmer skeleton block (dark theme).
│       ├── terms-acceptance-modal/  TermsAcceptanceModal — full-screen blocking modal (z:99999) shown
│       │                            when needsAcceptance=true. Cannot be dismissed without accepting.
│       │                            Fetches both documents, accordion expand, checkbox + confirm button.
│       ├── textarea/                Controlled multi-line textarea input (dark theme).
│       └── toast/                   ToastContainer (Framer Motion, portal).
├── features/                        One folder per feature, structured as {feature}/page/.
│   ├── auth/
│   │   └── login/page/              LoginPage — full auth form (signin / signup / confirm /
│   │                                forgotPassword / resetPassword) via @aws-amplify/auth.
│   │                                
│   ├── onboarding/page/             OnboardingPage + extracted-tags.tsx
│   ├── feed/page/                   FeedPage + feed-container.tsx + post-card.tsx + post-detail.tsx
│   ├── profile/page/                ProfilePage (tabs: Profile | Settings | Legal) +
│   │                                description-form.tsx + tag-manager.tsx + settings-panel.tsx +
│   │                                legal-tab.tsx
│   ├── post/page/                   PostPage — deep-link single post view (/post/:id).
│   └── saved/
│       ├── page/                    SavedGridPage (index.tsx) + saved-post-card.tsx — /saved
│       └── feed/                    SavedFeedPage (index.tsx) — /saved/feed?start=post-id
├── hooks/
│   ├── use-feed.ts                  Calls GET /feed via api.ts; paginates with cursor.
│   │                                In production passes `?after=sessionAfter` on every request so
│   │                                only posts newer than the user's last session are returned.
│   ├── use-horizontal-swipe.ts      Attaches pointer events to a DOM element and fires a callback
│   │                                when the user swipes left or right past a configurable threshold.
│   │                                Uses setPointerCapture + passive:false on pointermove to block
│   │                                vertical snap-scroll only when horizontal intent is confirmed.
│   ├── use-jit.ts                   Calls POST /feed/request when buffer ≤ TRIGGER_THRESHOLD.
│   │                                In production: polls GET /feed every 5s until posts arrive (90s max).
│   │                                Poll also passes `?after=sessionAfter` to avoid detecting old posts.
│   ├── use-saved-posts.ts           Loads GET /posts/saved with in-memory cache (SAVED_POSTS_TTL_MS = 5min).
│   │                                Skips re-fetch if cache is fresh. Exposes `refresh()` to force
│   │                                re-fetch and invalidate cache (called by the Reload button).
│   ├── use-snap-navigation.ts       Intercepts wheel + keyboard events on a snap-scroll container
│   │                                for reliable desktop navigation (wheel delta fix + Arrow/Space keys).
│   └── use-translation.ts           Returns the translations object for the active language.
│                                    Reads usePreferencesStore.language — reactive on language switch.
├── lib/
│   ├── env.ts                       Single source of truth for all VITE_* env vars. Every
│   │                                import.meta.env access goes through here — nowhere else.
│   ├── cache.ts                     In-memory TTL cache for API responses. Keyed by string.
│   │                                Constants: SAVED_POSTS_TTL_MS (5min), POST_DETAIL_TTL_MS (30min),
│   │                                PREFERENCES_TTL_MS (10min). Cleared entirely on logout.
│   │                                API: appCache.{set, get, isFresh, touch, invalidate, invalidateAll}.
│   ├── cognito.ts                   Calls Amplify.configure() with Cognito User Pool settings
│   │                                from VITE_* env vars. Called once from main.tsx before the
│   │                                React tree renders. No-op in dev (env vars absent).
│   ├── i18n.ts                      Master translations file. Record<Language, Translations>.
│   │                                All UI strings live here. Adding a language = adding a key.
│   ├── utils.ts                     cn(), formatDate(), formatRelativeTime(), truncate(), sleep().
│   └── constants.ts                 AVAILABLE_TAGS, DEFAULT_TAGS, TRIGGER_THRESHOLD,
│                                    MAX_PENDING_REQUESTS, FEED_PAGE_SIZE, SAVED_PAGE_SIZE,
│                                    TAG_EXTRACTION_DELAY_MS, JIT_GENERATION_DELAY_MS.
├── router/
│   └── index.tsx                    createBrowserRouter, RequireAuth, RootRedirect, AppRouter.
├── services/
│   └── api.ts                       Central HTTP client (api.get/post/put/delete). All calls go to
│                                    the real API Gateway. Exports `getApiErrorMessage(err, errors)`
│                                    helper — maps backend `ApiErrorCode` to a translated string from `t.errors`.
├── stores/
│   ├── auth/
│   │   └── index.ts                 useAuthStore — user, token, isAuthenticated,
│   │                                login(email, password), logout(), restoreSession().
│   │                                login() uses @aws-amplify/auth signIn + GET /user/preferences.
│   │                                restoreSession() checks for an existing Cognito session on app boot.
│   ├── feed/
│   │   └── index.ts                 useFeedStore — posts[], currentIndex, cursor, isLoading,
│   │                                hasMore, isPostExpanded (locks snap container when PostDetail open).
│   ├── preferences/
│   │   └── index.ts                 usePreferencesStore — theme ('dark'|'light'), language ('en'|'pt-BR').
│   │                                Persisted to localStorage: syntonia-preferences.
│   │                                First visit: theme detected from OS prefers-color-scheme.
│   ├── saved/
│   │   └── index.ts                 useSavedStore — savedIds (Set, persisted), posts[], save(),
│   │                                unsave(), isSaved(). Persisted to localStorage: syntonia-saved.
│   ├── terms/
│   │   └── index.ts                 useTermsStore — needsAcceptance, termsVersion, privacyVersion,
│   │                                isChecking. NOT persisted. Checked on every authenticated session
│   │                                via GET /legal/terms-status in app.tsx useEffect.
│   ├── user/
│   │   └── index.ts                 useUserStore — description, extractedTags, activeTags (enabled subset),
│   │                                setDescription(), setProfile(), setTags(), toggleTag(),
│   │                                syncFromServer(description, activeTags).
│   │                                setProfile() — full reset after new AI extraction; all tags start active.
│   │                                syncFromServer() — soft sync from server (login/restore); preserves
│   │                                local extractedTags, merges new activeTags into them.
│   │                                Persisted to localStorage: syntonia-user-prefs.
│   ├── liked/
│   │   └── index.ts                 useLikedStore — likedIds (Set, persisted), like(), unlike(), isLiked().
│   │                                Persisted to localStorage: syntonia-liked.
│   └── toast/
│       └── index.ts                 useToastStore — toasts[], addToast, removeToast.
├── styles/
│   └── globals.css                  @tailwind base/components/utilities.
│                                    CSS variable tokens: :root (dark) + html.light (light theme).
│                                    surface.* and accent.* tokens for backgrounds/borders.
│                                    content.* tokens for text (theme-adaptive, no overrides needed).
│                                    snap-scroll utilities (.snap-feed, .snap-card — no height).
│                                    Markdown prose uses content.* tokens directly.
│                                    No html.light .text-* overrides — semantic tokens handle it.
└── types/
    ├── domain.ts                    Post (includes savedAt?), Tag, ApiErrorCode, Theme, Language,
    │                                UserPreferencesLocal, UserProfile, FeedResponse,
    │                                SavedPostsResponse, SavePostResponse, UnsavePostResponse,
    │                                UserPreferences (includes theme + language),
    │                                GenerationResponse, UpdateProfileResponse,
    │                                TermsStatus, LegalDocument, AcceptTermsRequest, AcceptTermsResponse.
    └── index.ts                     Re-exports from domain.ts.
```

---

## §4 — Naming Conventions

| Category         | Convention                             | Example                            |
| ---------------- | -------------------------------------- | ---------------------------------- |
| Component files  | `kebab-case/index.tsx`                 | `post-card/index.tsx`              |
| Sub-components   | `kebab-case.tsx` alongside `index.tsx` | `post-detail.tsx`                  |
| Hook files       | `use-kebab-case.ts`                    | `use-feed.ts`                      |
| Store files      | `kebab-case/index.ts`                  | `feed/index.ts`                    |
| Mock files       | `kebab-case.ts`                        | `posts.ts`                         |
| Public assets    | `kebab-case.js`                        | `favicon.svg`                      |
| Constants        | `SCREAMING_SNAKE_CASE`                 | `TRIGGER_THRESHOLD`                |
| Types/Interfaces | `PascalCase`                           | `Post`, `UserProfile`              |
| Functions        | `camelCase`                            | `getApiErrorMessage`               |
| React components | `PascalCase` named export              | `export function PostCard`         |
| Pages            | `default export` + PascalCase          | `export default function FeedPage` |

**File structure rule:** Each UI component lives in its own folder with `index.tsx`. Sub-components for a feature page live alongside the page's `index.tsx`.

**PascalCase and camelCase filenames are forbidden everywhere** — including `public/` and `src/`. All source files must use `kebab-case`: words separated by `-`, all lowercase. No `App.tsx`, no `feedStore.ts`, no `useFeed.ts` → must be `use-feed.ts`.

---

## §5 — TypeScript Rules

These rules are enforced by `tsconfig.app.json` and ESLint. **Never relax them.**

```
strict: true
noUncheckedIndexedAccess: true        — arr[0] is T | undefined, not T
exactOptionalPropertyTypes: true      — { a?: string } ≠ { a: string | undefined }
noImplicitReturns: true
noFallthroughCasesInSwitch: true
verbatimModuleSyntax: true            — import type for type-only imports
noUnusedLocals: true
noUnusedParameters: true
```

**Critical rules:**

1. **No `any`** — ESLint rule `@typescript-eslint/no-explicit-any: error`. Use `unknown` + type guards.
2. **`import type` for all type imports** — `import type { Post } from '@/types'`.
3. **Explicit return types on all functions** — `function foo(): ReturnType`.
4. **`React.JSX.Element` return type** — NOT `JSX.Element`. Always `React.JSX.Element`.
5. **`readonly` on props interfaces** — `interface Props { readonly title: string }`.
6. **Exhaustive switch** — every `switch` on a union type must handle all cases.
7. **No non-null assertions** — `!` is banned. Use optional chaining or type guards.
8. **`as const` for literal arrays** — `['AWS', 'TypeScript'] as const`.
9. **No `ts-ignore`** — use `ts-expect-error` with a description if absolutely necessary.

**Async rules:**

- No floating promises — `void asyncFn()` is fine; unhandled `.then()` is not.
- All async functions must be `async`: `onClick={() => { void handleClick(); }}`.

---

## §6 — Design System Tokens

### Color system — CSS variables + Tailwind

All colors are driven by **CSS variables** defined in `globals.css`. Tailwind resolves them at runtime so tokens adapt automatically when the theme changes — no component changes needed.

#### Surface tokens (backgrounds, borders)

**Dark (`:root` default) → Light (`html.light`):**

```
surface.DEFAULT     #030712 → #f8fafc   — app background
surface.card        #111827 → #ffffff   — card surfaces
surface.elevated    #1f2937 → #f1f5f9  — inputs, elevated elements
surface.border      #374151 → #e2e8f0  — borders, dividers

accent.DEFAULT      #4f46e5 → #4f46e5  — primary interactive (same both themes)
accent.hover        #4338ca → #4338ca
accent.light        #e0e7ff → #3730a3  — accent text (inverted for visibility)
accent.muted        #312e81 → #e0e7ff  — subtle accent background (inverted)
```

#### Content tokens (text colors) — semantic, theme-adaptive

```
content.primary     white → slate-900  — headings, labels, primary values
content.secondary   gray-300 → slate-600  — secondary labels, slightly muted
content.muted       gray-400 → slate-500  — hints, subtitles, helper text
content.subtle      gray-500/600 → slate-400  — timestamps, counters, very subtle
```

**Tailwind config syntax (supports opacity modifiers like `text-content-primary/80`):**

```ts
content: { primary: 'rgb(var(--color-content-primary) / <alpha-value>)', ... }
```

#### Usage rules — the most important part

| Text context                                                           | Use                      | Never use                        |
| ---------------------------------------------------------------------- | ------------------------ | -------------------------------- |
| Heading / label on `surface` background                                | `text-content-primary`   | `text-white`                     |
| Secondary label on `surface`                                           | `text-content-secondary` | `text-gray-300`                  |
| Hint / subtitle on `surface`                                           | `text-content-muted`     | `text-gray-400`, `text-gray-500` |
| Timestamp / counter on `surface`                                       | `text-content-subtle`    | `text-gray-600`, `text-gray-700` |
| **Text on always-dark colored background** (accent btn, gradient card) | `text-white`             | content tokens                   |

**The rule in one sentence:** Use `text-content-*` when the background is theme-adaptive (`surface.*`). Use `text-white` when the background is always dark (post gradient, `bg-accent`, `bg-red-700`, `bg-black/40`).

```tsx
className = "text-content-primary"; // ✓ heading on surface
className = "text-content-muted"; // ✓ hint text on surface
className = "bg-accent text-white"; // ✓ button on accent bg (always dark)
className = "text-white"; // ✓ text on post gradient (always dark)

className = "text-white"; // ✗ heading on surface — breaks in light mode
className = "text-gray-400"; // ✗ hint on surface — no theme adaptation
```

**Never add CSS overrides to `globals.css` to fix broken text colors.** The semantic tokens are the correct solution — use the right token and the color adapts for free.

#### CSS variable definitions (in `globals.css`)

```css
:root {
  /* dark default */
  --color-content-primary: 255 255 255; /* white */
  --color-content-secondary: 209 213 219; /* gray-300 */
  --color-content-muted: 156 163 175; /* gray-400 */
  --color-content-subtle: 107 114 128; /* gray-500 */
}
html.light {
  /* light override */
  --color-content-primary: 15 23 42; /* slate-900 */
  --color-content-secondary: 71 85 105; /* slate-600 */
  --color-content-muted: 100 116 139; /* slate-500 */
  --color-content-subtle: 148 163 184; /* slate-400 */
}
```

### Animations

All keyframes are in `tailwind.config.ts`. Use these utilities:

```
animate-fade-in       — opacity 0 → 1 (0.25s ease-out)
animate-slide-up      — translateY(14px) + opacity 0 → normal (0.3s ease-out)
animate-scale-in      — scale(0.94) + opacity 0 → normal (0.2s)
animate-shimmer       — skeleton shimmer effect (2.2s linear infinite)
animate-spin          — full rotation (use on loading indicators)
```

### Gradient cards

Post cards use gradient backgrounds from `post.gradient: [string, string]`:

```tsx
const background = `linear-gradient(135deg, ${post.gradient[0]}, ${post.gradient[1]})`;
<motion.div style={{ background }} ... />
```

**Gradient convention by tag topic:**

| Topic                  | Gradient                 |
| ---------------------- | ------------------------ |
| AWS / Serverless       | `['#FF6B35', '#F7931E']` |
| TypeScript             | `['#3178C6', '#235A97']` |
| Docker                 | `['#0DB7ED', '#384D54']` |
| Kubernetes             | `['#326CE5', '#1A3A8F']` |
| Security               | `['#E74C3C', '#922B21']` |
| Redis                  | `['#D82C20', '#8B1A10']` |
| PostgreSQL             | `['#336791', '#1A3A5C']` |
| Terraform              | `['#7B42BC', '#4A1A8C']` |
| Architecture / General | `['#2ECC71', '#1A7A44']` |

---

## §7 — Component Pattern (CVA + Radix UI)

All design-system components follow this structure:

```tsx
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const componentVariants = cva("base classes", {
  variants: {
    variant: { default: "...", accent: "..." },
    size: { default: "...", sm: "..." },
  },
  defaultVariants: { variant: "default", size: "default" },
});

interface ComponentProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {}

function Component({
  className,
  variant,
  size,
  ...props
}: ComponentProps): React.JSX.Element {
  return (
    <element
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Component, componentVariants };
export type { ComponentProps };
```

**Rules:**

- Use `cn()` for all class merging — never string concatenation.
- Export the `variants` function alongside the component for external use.
- `interface` over `type` for object shapes (ESLint rule).
- `readonly` on all prop interface fields.

---

## §8 — Shared Components Reference

| Component            | Props                                          | Description                                                                               |
| -------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `EmptyFeedScreen`    | `onReload: () => void`                         | Shown when feed is empty. Links to /profile, has reload button.                           |
| `FeedInitialLoading` | none                                           | Full-screen loading state for initial feed fetch and JIT generation.                      |
| `Spinner`            | `size?: 'sm'\|'md'\|'lg'`, `className?`        | Decorative loading spinner. Aria-hidden — context communicates loading state.             |
| `TagSelector`        | `tags`, `activeTags`, `onToggle`, `className?` | Toggleable tag chips. Renders only the provided `tags` — never `AVAILABLE_TAGS` directly. |

**Toast** is not in the table above because it is used via `useToastStore`, not imported directly. See §28 for the full toast pattern.

---

## §9 — Layout Rules

### `FeedLayout` (`/feed`, `/saved`, `/profile`)

- `h-dvh` container, `flex-col`, `overflow-hidden`
- `<Outlet />` fills `flex-1 overflow-hidden`
- Bottom nav: `shrink-0` with inner `h-16` content row + `paddingBottom: env(safe-area-inset-bottom, 0px)` for device nav bar clearance. **Feed · Saved · Profile** (three tabs — no Logout in nav)
- **Logout** lives at the bottom of `ProfilePage`, not in the nav
- No sidebar, no top header — Syntonia is mobile-first

### No-layout pages

Pages that render without `FeedLayout`:

- `/auth/login` (LoginPage — three-mode form: signin / signup / confirm)
- `/onboarding` (OnboardingPage)
- `/post/:id` (PostPage — full-screen, own sticky header)
- `/saved/feed` (SavedFeedPage — full-screen snap-scroll, own back button)

### Snap-scroll CSS

The feed uses CSS snap, not JavaScript scroll control. Heights are controlled by **utility classes**, not the CSS utilities themselves — this ensures proper sizing relative to the parent container.

```css
/* .snap-feed — no height set here */
.snap-feed {
  scroll-snap-type: y mandatory;
  overflow-y: scroll;
}

/* .snap-card — no height set here */
.snap-card {
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

**Height must be set on the container at usage site:**

| Usage                               | Height             | Why                                                   |
| ----------------------------------- | ------------------ | ----------------------------------------------------- |
| `FeedContainer` (inside FeedLayout) | `snap-feed h-full` | Parent `main` is `flex-1` = `dvh - nav height` (nav = 64px content row + `safe-area-inset-bottom`) |
| `SavedFeedPage` (standalone)        | `snap-feed h-dvh`  | No nav — fills full viewport                          |
| Each `PostCard`                     | `snap-card h-full` | Fills 100% of its snap container                      |

**Snap container scroll lock:** When a `PostDetail` is open, `useFeedStore.isPostExpanded` is `true`. Both `FeedContainer` and `SavedFeedPage` observe this and set `el.style.overflowY = 'hidden'` via a DOM ref — bypassing CSS cascade so `overflow-y: scroll` cannot win.

---

## §10 — Routing Rules

```
/                  RootRedirect → /auth/login | /onboarding | /feed
/auth/login        LoginPage (no auth required)
/onboarding        OnboardingPage (RequireAuth)
/feed              FeedPage (RequireAuth + FeedLayout)
/saved             SavedGridPage (RequireAuth + FeedLayout)
/profile           ProfilePage (RequireAuth + FeedLayout)
/post/:id          PostPage (RequireAuth, no layout)
/saved/feed        SavedFeedPage (RequireAuth, no layout — snap-scroll)
```

**`RootRedirect` logic:**

1. Not authenticated → `/auth/login`
2. Authenticated, `description === ''` → `/onboarding`
3. Authenticated, has description → `/feed`

**All pages are `React.lazy`** — wrapped with `withSuspense()` which renders a full-screen spinner as fallback.

**`RequireAuth`** — redirects to `/auth/login?returnTo=<encoded-path>` if `useAuthStore.isAuthenticated === false`.

---

## §11 — Zustand Store Patterns

### Store interface

All stores follow this pattern:

```typescript
import { create } from "zustand";

interface MyState {
  // State (readonly)
  readonly value: string;
  // Actions
  readonly setValue: (v: string) => void;
}

export const useMyStore = create<MyState>((set) => ({
  value: "",
  setValue: (value) => set({ value }),
}));
```

**Rules:**

- State fields are `readonly` in the interface.
- Actions receive primitive values — no complex objects in `set()` unless necessary.
- **Always use `(s) => s.field` selectors** in components to avoid unnecessary re-renders.
- Never call `useMyStore()` without a selector in a component — it subscribes to all state.
- `persist` middleware is used for `useUserStore`, `useSavedStore`, `usePreferencesStore`, and `useHistoryStore`.

### Stores summary

| Store                 | Key state                                                          | Persisted? | localStorage key       |
| --------------------- | ------------------------------------------------------------------ | ---------- | ---------------------- |
| `useAuthStore`        | `user`, `isAuthenticated`                                          | No         | —                      |
| `useFeedStore`        | `posts[]`, `currentIndex`, `cursor`, `isLoading`, `isPostExpanded` | No         | —                      |
| `useSavedStore`       | `savedIds` (Set), `posts[]`, `isSaved()`                           | Yes        | `syntonia-saved`       |
| `useLikedStore`       | `likedIds` (Set), `isLiked()`                                      | Yes        | `syntonia-liked`       |
| `usePreferencesStore` | `theme`, `language`                                                | Yes        | `syntonia-preferences` |
| `useUserStore`        | `description`, `extractedTags`, `activeTags`                       | Yes        | `syntonia-user-prefs`  |
| `useHistoryStore`     | `lastViewedCreatedAt` (ISO string or null)                         | Yes        | `syntonia-history`     |
| `useTermsStore`       | `needsAcceptance`, `termsVersion`, `privacyVersion`, `isChecking`  | No         | —                      |
| `useToastStore`       | `toasts[]`                                                         | No         | —                      |

---

## §12 — API Rules

### The HTTP flow

All API calls go through `src/services/api.ts` → `fetch()` → real API Gateway.

```
Component / Hook
     │
     ▼
api.get('/feed') ← src/services/api.ts
     │
     ▼
fetch('https://api.execute-api…/feed', { Authorization: Bearer <idToken> })
     │
     ▼
API Gateway → Lambda → DynamoDB
     │
     ▼
Component receives { posts, cursor, hasMore }
```

`VITE_API_URL` must be set in the environment (`.env.local` for dev, Amplify Console for prod).

### Toast on every API action

**Every action that calls the API must show a toast for feedback** — both on success and on error. Use `useToastStore` directly in the component that performs the action. See §28 for the full toast pattern.

**Success toasts** use component-specific i18n keys. **Error toasts** always use `getApiErrorMessage(err, t.errors)` from `@/services/api` — this maps the backend `ApiErrorCode` to the translated message in `t.errors[code]`.

| Action                     | Success toast                                  | Error pattern                                         |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Save post                  | `t.saved.toastSaved`                           | `getApiErrorMessage(err, t.errors)`                   |
| Unsave post                | `t.saved.toastUnsaved`                         | `getApiErrorMessage(err, t.errors)`                   |
| Update profile description | `t.descriptionForm.toastSuccess(n)`            | `getApiErrorMessage(err, t.errors)`                   |
| Toggle tag                 | `t.tagManager.toastActivated/Deactivated(tag)` | `getApiErrorMessage(err, t.errors)`                   |
| Change theme / language    | — (no success toast)                           | `getApiErrorMessage(err, t.errors)` as `warning` type |

All error code → message mappings live in `t.errors: Record<ApiErrorCode, string>` in `src/lib/i18n.ts`.

### API error codes

All non-2xx backend responses carry `{ code: ApiErrorCode, error: string, message: string }`. The frontend maps `code` to a translated message. `ApiErrorCode` is exported from `src/types/domain.ts`:

| Code                       | When                                                  |
| -------------------------- | ----------------------------------------------------- |
| `UNAUTHENTICATED`          | Token absent, expired, or invalid                     |
| `POST_NOT_FOUND`           | Post not found or belongs to another user             |
| `POST_NOT_SAVED`           | Unsaving a post that is not saved                     |
| `POST_NOT_LIKED`           | Unliking a post that has not been liked               |
| `LEGAL_DOCUMENT_NOT_FOUND` | No active legal document for the type                 |
| `VALIDATION_ERROR`         | Malformed body or invalid fields                      |
| `TERMS_VERSION_MISMATCH`   | Accepted versions don't match current active versions |
| `GENERATION_LIMIT_REACHED` | Too many pending generations                          |
| `RATE_LIMIT_EXCEEDED`      | General API rate limit                                |
| `AI_EXTRACTION_FAILED`     | Gemini failed to extract tags                         |
| `INTERNAL_ERROR`           | Uncategorised server error                            |
| `UNKNOWN_ERROR`            | Fallback for unrecognised codes                       |

### Adding a new API endpoint

1. Call it via `api.get/post/put/delete(...)` in the component/hook
2. Add the error code to `ApiErrorCode` in `src/types/domain.ts` if needed
3. Add translations in `t.errors` for all languages in `src/lib/i18n.ts`

---

## §13 — Feed Mechanics

### Snap-scroll

The feed is a CSS snap-scroll container. Each `PostCard` fills the available height of the snap container (not `100dvh` directly — see §9 for the height model).

```
FeedPage
  └── FeedContainer (div.snap-feed h-full)  ← h-full = dvh - nav height (64px content + safe-area-inset-bottom)
       ├── PostCard (div.snap-card h-full) data-index="0"
       ├── PostCard (div.snap-card h-full) data-index="1"
       ├── PostCard (div.snap-card h-full) data-index="2"
       └── FeedInitialLoading (div.snap-card h-full)  ← shown when isLoading
```

### currentIndex tracking

`FeedContainer` uses `IntersectionObserver` (threshold: 0.7) to update `useFeedStore.currentIndex` when a new card becomes 70% visible.

### JIT trigger

`useJIT` runs inside `FeedPage` on every render. Triggers when `activeTags.length > 0` AND `postsRemaining ≤ TRIGGER_THRESHOLD` — including when the feed is completely empty (first load for a new user).

```
postsRemaining ≤ TRIGGER_THRESHOLD && !isGenerating && activeTags.length > 0
  → POST /feed/request → real SQS → Gemini worker (~15–60s)
  → pollUntilPostsArrive(prevCount):
      GET /feed every 5s, up to 18 attempts (90s total)
      When data.posts.length > prevCount:
        setPosts(data.posts) if prevCount === 0
        appendPosts(deduplicated fresh posts) otherwise
        setCursor(data.cursor)
  → setLoading(false); isGenerating locked for 10s
```

### X-axis: PostCard → PostDetail

1. User swipes `PostCard` **left > 50px** OR taps the **"Read" button** — detected via native `addEventListener` on the gradient `div` (not Framer Motion drag, which conflicts with CSS snap-scroll).
2. `open()` → `setExpanded(true)` + `useFeedStore.setPostExpanded(true)` (locks snap container).
3. `PostDetail` slides in from the right (`motion.div` with `x: '100%' → 0`, spring transition).
4. To close: tap the **"Back" button** or swipe **right > 80px** on the PostDetail panel (Framer Motion `drag="x"` with `dragDirectionLock`).
5. `close()` → `setExpanded(false)` + `useFeedStore.setPostExpanded(false)` (unlocks snap container).

**Swipe detection uses `useHorizontalSwipe` (extracted hook):**

```tsx
useHorizontalSwipe(bgRef, { direction: "left", onSwipe: open });
useHorizontalSwipe(detailRef, {
  direction: "right",
  enabled: expanded,
  onSwipe: close,
});
```

The hook attaches pointer events with `setPointerCapture` + `passive: false` on `pointermove`.
`e.preventDefault()` is called only when horizontal intent is confirmed, so vertical snap-scroll
is never interrupted during primarily vertical gestures.

---

## §14 — Post Content (Markdown)

`PostDetail` and `PostPage` both render Markdown using:

```tsx
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

<ReactMarkdown rehypePlugins={[rehypeHighlight]}>
  {post.content ?? post.summary}
</ReactMarkdown>;
```

The `prose-invert` Tailwind class combined with custom overrides in `globals.css` styles the rendered Markdown for the dark theme.

**If `post.content` is undefined** (feed-only view), fall back to `post.summary`.

---

## §15 — Tag System Rules

### AVAILABLE_TAGS

The master list of 20 valid tags is defined in `src/lib/constants.ts` and `src/types/domain.ts` (as a TypeScript union type).

Never hardcode tag strings in components — always import from `@/lib/constants`.

### activeTags vs extractedTags

- `extractedTags` — all tags the user has ever had active. Set by `setProfile()` when a new description is submitted (full reset — all new tags start active). Expanded (never shrunk) by `syncFromServer()` on every login and session restore, which merges any server-side `activeTags` not already present locally. Deactivated tags remain in `extractedTags` so they can be re-enabled by the user.
- `activeTags` — the enabled subset of `extractedTags`. Drives feed generation. Stored in localStorage.
- Minimum 1 active tag must always remain — enforced in `useUserStore.toggleTag` and `TagManager`.
- Used by `useJIT` to filter relevant posts for generation.

### Tag display rules

| Context                   | Component       | Tags shown                                          |
| ------------------------- | --------------- | --------------------------------------------------- |
| PostCard gradient card    | inline `Badge`  | Post's own tags (from `post.tags`)                  |
| OnboardingPage review     | `ExtractedTags` | AI-extracted tags for confirmation                  |
| ProfilePage / Profile tab | `TagSelector`   | `extractedTags` (all) with `activeTags` highlighted |

---

## §16 — User Profile Rules

### Description → Tags flow

1. User writes description in `DescriptionForm` (min 20, max 500 chars).
2. On save → calls `onExtractionStateChange(true)` → `ProfilePage` sets `isExtractingTags = true` → `TagManager` renders skeleton chips.
3. `PUT /user/profile` → Gemini API extracts tags (2s delay in real backend).
4. Returns `Tag[]` → `useUserStore.setProfile(description, extractedTags)`.
5. `setProfile` sets both `extractedTags = tags` and `activeTags = tags` — all start active.
6. `onExtractionStateChange(false)` → `ProfilePage` sets `isExtractingTags = false` → `TagManager` renders real tags.
7. `extractedTags` never changes after step 5 **unless** the user signs in or the app restores a session (see below).
8. User can toggle individual tags in `TagManager` — only `activeTags` changes.
9. Deactivated tags stay visible in `TagSelector` (muted style) and can be re-enabled.

**Sync from server (login + session restore):**

On every sign-in (`afterSignIn()` in `LoginPage`) and on every page reload with an active Cognito session (`useAuthStore.restoreSession()`), `syncFromServer(description, activeTags)` is called:
- Updates `description` and `activeTags` from the server
- Merges any `activeTags` not already in `extractedTags` into `extractedTags`
- Preserves deactivated tags that exist in `extractedTags` but not in the server's `activeTags`
- Does NOT reset `extractedTags` to the server's `activeTags` only

**Tag loading state wiring:**
- `ProfilePage` holds `isExtractingTags: boolean` state
- `DescriptionForm` receives `onExtractionStateChange: (isExtracting: boolean) => void` prop
- `TagManager` receives `isExtracting: boolean` prop
- When `isExtracting` is true, `TagManager` renders 5 skeleton chips + animated label instead of the real tags

### Onboarding vs Profile

| Feature                     | OnboardingPage               | ProfilePage                       |
| --------------------------- | ---------------------------- | --------------------------------- |
| Route                       | `/onboarding`                | `/profile`                        |
| First-time only             | Yes                          | No                                |
| Has layout (bottom nav)     | No                           | Yes                               |
| Description field           | Yes                          | Yes (`DescriptionForm`)           |
| Tag review                  | Yes (inline `ExtractedTags`) | Yes (`TagManager` in Profile tab) |
| Settings (theme + language) | No                           | Yes (Settings tab)                |

---

## §17 — Auth Flow

### Production (real Cognito)

```
Sign-up:
User → /auth/login (LoginPage, mode="signup")
  → signUp(email, password) via @aws-amplify/auth
  → Cognito sends 6-digit verification email
  → mode switches to "confirm"
  → confirmSignUp(email, code) → auto sign-in → afterSignIn()
  → Cognito PostConfirmation trigger → onUserSignup Lambda → profile created in DynamoDB
  → navigate → /onboarding (no description) or /feed

Sign-in:
User → /auth/login (LoginPage, mode="signin")
  → login(email, password) → Amplify signIn → fetchAuthSession + fetchUserAttributes
  → GET /user/preferences → set user+token in auth store
  → afterSignIn(): syncFromServer(description, activeTags) in user store
  → navigate(returnTo)

Session restore (app boot — no redirect needed):
main.tsx → useAuthStore.restoreSession()
  → fetchAuthSession(): if no valid idToken → return (unauthenticated, go to /auth/login)
  → fetchUserAttributes() + GET /user/preferences (parallel)
  → set user + token + isAuthenticated in auth store
  → if description non-empty: syncFromServer(description, activeTags) in user store
  → React tree renders with isAuthenticated = true → RootRedirect sends to /feed
```

### RequireAuth

Wraps all authenticated routes. Reads `useAuthStore.isAuthenticated`. On `false`:

```tsx
return (
  <Navigate
    to={`/auth/login?returnTo=${encodeURIComponent(location.pathname)}`}
    replace
  />
);
```

---

## §18 — Animation Guidelines

### Animation inventory — what exists

| Context                           | Mechanism                                                        | Animation                                         |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| Route change (Feed/Saved/Profile) | `motion.div key={pathname}` (no AnimatePresence)                 | Tween: opacity 0→1 + y:12→0, 220ms ease-out      |
| Bottom nav active indicator       | Framer Motion `layoutId="nav-active"` spring                     | Pill slides between tabs, spring                  |
| ProfilePage tab switch            | Framer Motion `AnimatePresence` + direction variants             | Slide 20px horizontal, 200ms                      |
| SavedGrid card entrance           | Framer Motion stagger (`gridContainerVariants`)                  | Scale 0.9→1, stagger 45ms                         |
| PostDetail open (feed slide)      | `AnimatePresence` + `motion.div` spring x                        | Slide from right, spring (damping:32, stiff:300)  |
| PostDetail open (saved expand)    | `AnimatePresence` + `motion.div` tween scale                     | Scale 0.92→1 + opacity, 260ms ease-out            |
| PostPage entrance                 | `motion.div`                                                     | Slide 30px from right, 280ms                      |
| Login / Onboarding entrance       | `motion.div`                                                     | Fade + y:16→0, 300ms                              |
| EmptyFeedScreen entrance          | `motion.div`                                                     | Fade + y:16→0, 300ms                              |
| Bottom-sheet modals (open)        | `motion.div` tween y                                             | y:100%→0, 280ms `ease:[0.32,0.72,0,1]`            |
| Bottom-sheet modals (close)       | `exit` tween y                                                   | y:0→100%, 200ms `ease:[0.72,0,0.28,1]`            |
| Modal overlays                    | `motion.div` opacity tween                                       | opacity 0→1, 180ms easeOut — NO backdrop blur     |
| Terms accordion                   | `AnimatePresence` opacity                                        | Fade in/out 150ms — no height animation           |
| Toast enter                       | Framer Motion `AnimatePresence mode="popLayout"`                 | Slide from right with overshoot                   |
| Toast exit                        | Framer Motion exit variants                                      | Slide right + fade 300ms                          |
| Toast layout shift                | Framer Motion `layout` prop                                      | Spring — others animate up smoothly               |

### When to use Framer Motion

- **Route transitions** — `AnimatePresence` with `key={location.pathname}` in `FeedLayout`
- **Direction-aware transitions** — `custom` prop + `variants` functions for ProfilePage tabs
- **Layout animations** — `layoutId` for shared element transitions (nav indicator), `layout` for reordering (toast stack)
- **Stagger lists** — `variants` + `staggerChildren` on container for SavedGrid, etc.
- **PostDetail slide-in/out** — `AnimatePresence` + `motion.div` with spring transition

### When to use CSS animations (Tailwind)

- Skeleton shimmer: `animate-shimmer` or `shimmer-base` utility
- Loading spinners: `animate-spin`
- Content appearance (simple): `animate-fade-in`, `animate-slide-up`, `animate-scale-in`

### Standard timing values

```
Micro (button press):       100ms  — active:scale-[0.97] (Tailwind)
Fast (route transition):    220ms  — route change in FeedLayout (tween y:12 + opacity)
Normal (slide):             200ms  — tab content, card items
Slow (page entrance):       280–300ms  — full page enter animations
Modal enter (bottom-sheet): 280ms  — tween ease:[0.32,0.72,0,1]
Modal exit (bottom-sheet):  200ms  — tween ease:[0.72,0,0.28,1]
Modal overlay:              180ms  — tween easeOut, opacity only
Spring (layout):            damping 30, stiffness 380  — nav indicator, layout shifts
```

### Direction-aware animation pattern (ProfilePage tabs)

```tsx
const [slideDirection, setSlideDirection] = React.useState<1 | -1>(1);

const handleTabChange = (tab: Tab): void => {
  setSlideDirection(TAB_ORDER[tab] > TAB_ORDER[activeTab] ? 1 : -1);
  setActiveTab(tab);
};

<AnimatePresence mode="wait" initial={false} custom={slideDirection}>
  <motion.div
    key={activeTab}
    custom={slideDirection}
    variants={{
      initial: (dir: number) => ({ opacity: 0, x: dir * 20 }),
      animate: { opacity: 1, x: 0 },
      exit: (dir: number) => ({ opacity: 0, x: dir * -20 }),
    }}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.2, ease: "easeInOut" }}
  >
    {/* content */}
  </motion.div>
</AnimatePresence>;
```

### Stagger list pattern (SavedGrid)

```tsx
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

<motion.ul variants={containerVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.li key={item.id} variants={itemVariants}>
      ...
    </motion.li>
  ))}
</motion.ul>;
```

### Toast animation — special rules

Radix UI Toast was replaced by Framer Motion. See §28 for the full toast pattern.

### Animation performance rules

These rules prevent jank on mid-range and low-end devices. Follow them for any new animated element.

1. **Never use `backdropFilter` on animated elements.** `backdrop-filter: blur()` forces GPU compositing but recalculates every frame — it is the single most expensive CSS property. For overlays, use a solid semi-transparent Tailwind class (`bg-black/60`) instead of blur.

2. **Use `type: "tween"` for modals and route transitions.** Spring physics are calculated every frame and are non-deterministic. For predictable, GPU-friendly animations use tween with a cubic-bezier curve. Springs are only appropriate for draggable/interactive elements (nav indicator, PostDetail drag-to-dismiss).

3. **Set `style={{ willChange: "transform" }}` on bottom-sheet containers and route wrappers.** This tells the browser to promote the element to its own compositing layer *before* the animation starts, avoiding a costly layer-creation spike on the first frame. Do not add `willChange` to deeply-nested or numerous elements — it consumes GPU memory.

4. **Never animate `height` to/from `"auto"`.** Height animation forces layout recalculation (reflow) on every frame. For accordion-style expand/collapse, animate `opacity` only, or use CSS `grid-template-rows: 0fr → 1fr`.

5. **Only animate GPU-accelerated properties:** `transform` (translate, scale, rotate), `opacity`. Never animate `width`, `height`, `top`, `left`, `margin`, `padding` with Framer Motion.

6. **Shared constants for bottom-sheet transitions:**

```typescript
const SHEET_ENTER = { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.28 } as const;
const SHEET_EXIT  = { type: "tween", ease: [0.72, 0, 0.28, 1], duration: 0.2  } as const;
const OVERLAY     = { type: "tween", ease: "easeOut",           duration: 0.18 } as const;
```

Define these as module-level constants (not inline) so TypeScript treats them as stable references.

### `prefers-reduced-motion`

`globals.css` includes a media query that disables all CSS animations for users who prefer reduced motion. **Never override this.** Framer Motion respects `prefers-reduced-motion` automatically when you use `useReducedMotion()` — add it to animation-heavy components if needed.

---

## §19 — Accessibility Rules

These are enforced by `eslint-plugin-jsx-a11y`:

1. All `<img>` elements must have `alt` text.
2. Interactive elements (`button`, `a`) must be keyboard-accessible.
3. `aria-label` on icon-only buttons: `<button aria-label="Go back">`.
4. `aria-pressed` on toggle buttons: `<button aria-pressed={isActive}>`.
5. `aria-hidden` on decorative icons: `<Icon aria-hidden />`.
6. Labels must be associated with their inputs: `<label htmlFor="id">` + `<input id="id">`.
7. No `onClick` on non-interactive elements (`div`, `span`).

---

## §20 — ESLint & Prettier

### Running checks

```bash
yarn typecheck     # TypeScript — zero errors required
yarn lint          # ESLint — zero warnings required (--max-warnings 0)
yarn format        # Prettier — auto-fix formatting
```

### Import order (enforced by `eslint-plugin-import`)

```
1. builtin       (node:path, node:url)
2. external      (react, framer-motion, zustand)
3. internal      (@/...)
4. parent        (../...)
5. sibling       (./...)
6. index         (./)
```

Alphabetical within each group. One blank line between groups.

### Key ESLint rules

- `@typescript-eslint/no-explicit-any: error` — use `unknown`.
- `react/no-array-index-key: error` — use stable IDs.
- `react-hooks/exhaustive-deps: error` — all hook dependencies must be listed.
- `no-console: warn` — remove before committing.
- `@typescript-eslint/switch-exhaustiveness-check` — all variants handled.
- `no-inline-comments: error` — no `//` comments next to code.
- `local/no-comments: error` — no `//` or `/* */` comments anywhere.
- `jsdoc/require-jsdoc: error` — JSDoc required on all exported functions/classes.
- `jsdoc/require-description: error` — JSDoc must include a description.
- **`eslint-disable` in any form is prohibited** — fix the code instead (see §25).

---

## §21 — Adding a New Feature Page

Follow this exact pattern:

```
src/features/{feature-name}/page/
├── index.tsx          ← default export, lazy-loaded by router
└── {sub-component}.tsx
```

1. Create the folder and `index.tsx` with a `default export` function component.
2. Add the `React.lazy` import in `src/router/index.tsx`.
3. Add the route to the `createBrowserRouter` array.
4. If it needs the bottom nav, nest it under the `FeedLayout` route group.
5. If it needs state, add a Zustand store in `src/stores/`.
7. Update §3 (directory tree) and §9 (routing) in this file.

---

## §22 — Adding a New UI Component

1. Create `src/components/ui/{name}/index.tsx`.
2. Use the CVA pattern from §7.
3. Export: component function + variants function + Props type.
4. Use **semantic tokens** for text (`text-content-primary/secondary/muted/subtle`) and surface tokens for backgrounds — never hardcode `text-white` or `text-gray-*` for theme-adaptive elements (see §6).
5. Add to the components table in §8 if it's a shared component.

---

## §23 — Performance Guidelines

1. **All pages are `React.lazy`** — loaded on demand, not in the initial bundle.
2. **`React.memo`** — use on components that receive stable props and render frequently (e.g., `PostCard` inside a long list).
3. **Stable references** — use `React.useCallback` for functions passed as props, `React.useMemo` for expensive derived values.
4. **Avoid re-renders** — use Zustand selectors `(s) => s.field` to subscribe to only what you need.
5. **Image optimisation** — not applicable currently (no image uploads). When added, always specify `width` + `height`.

---

## §24 — Project Scripts

```bash
yarn dev          # Start Vite dev server on :5173
yarn build        # typecheck + production build → dist/
yarn preview      # Preview production build
yarn typecheck    # Run tsc --noEmit (zero errors required)
yarn lint         # Run ESLint --max-warnings 0 (zero warnings)
yarn lint:fix     # Auto-fix ESLint issues
yarn format       # Auto-format with Prettier
```

---

## §25 — Comment Policy

### Rule 1 — No casual comments anywhere

`//` line comments and `/* */` block comments are **prohibited** in all source files.
This is enforced by two ESLint rules:

- `no-inline-comments: error` — bans comments on the same line as code
- `local/no-comments: error` — bans all `//` line comments and `/* */` block comments

**If you feel the need to write a `//` comment, it means the code is not self-documenting.
The correct action is to rename the variable/function so the intent is obvious.**

```typescript
const x = users.filter((u) => u.activeTags.length > 0);
```

is better than:

```typescript
const x = users.filter((u) => u.activeTags.length > 0);
```

### Rule 2 — JSDoc required on all exported functions and classes

Every exported function and class **must** have a JSDoc block comment (`/** ... */`)
with at least one sentence of description. Enforced by:

- `jsdoc/require-jsdoc: error` (publicOnly — only exported symbols)
- `jsdoc/require-description: error`

```typescript
/** ❌ Missing JSDoc — lint error */
export function useFeed(): FeedResult { ... }

/** ✅ Correct */
/**
 * Fetches and paginates the authenticated user's feed via GET /feed.
 * In production this calls the real API Gateway endpoint.
 */
export function useFeed(): FeedResult { ... }
```

### What is allowed

Only JSDoc-style `/** */` block comments attached to an exported symbol:

```typescript
/** One-line description is sufficient for simple helpers. */
export function cn(...inputs: ClassValue[]): string { ... }

/**
 * Multi-line description for complex functions.
 * Second sentence adds more context.
 */
export function formatRelativeTime(date: string): string { ... }
```

### What is forbidden

```typescript
// This is forbidden ← no-inline-comments + local/no-comments
const value = compute(); // inline explanation ← no-inline-comments

/* Block comment — also forbidden */ ← local/no-comments

/**
 * JSDoc on a non-exported (private) function is optional but allowed.
 * JSDoc on an exported function is REQUIRED.
 */
function internalHelper(): void { ... }
```

### Rule 3 — `eslint-disable` comments are prohibited

`eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line`, and all their
variants are **strictly forbidden** in every source file.

If ESLint flags a line, the correct action is to **fix the code** until ESLint passes.
There are no legitimate reasons to suppress lint rules in this codebase.

### What is forbidden

```typescript
const value = compute(); // inline explanation ← banned

/* eslint-disable no-console */  ← banned
console.log(debug);

const x = risky() as string; // eslint-disable-next-line @typescript-eslint/no-explicit-any ← banned
```

### Practical guide

| Situation                             | Correct action                            |
| ------------------------------------- | ----------------------------------------- |
| Want to explain what a variable holds | Give it a descriptive name                |
| Want to explain why a value is used   | Give the function/hook a descriptive name |
| Want to mark a TODO                   | Open a GitHub issue instead               |
| Need to document an exported function | Add a JSDoc block                         |
| ESLint flags a rule violation         | Fix the code — never suppress the rule    |

---

## §26 — Theme System

### Architecture

Syntonia supports **Dark** and **Light** themes via CSS variables. No component needs to know the active theme — only the CSS variable values change.

```
usePreferencesStore.theme  ('dark' | 'light')
        │
        ▼  useEffect in app/app.tsx
document.documentElement.classList.add('dark' | 'light')
        │
        ▼  globals.css
:root           { --color-surface: 3 7 18; ... }      ← dark values (default)
html.light      { --color-surface: 248 250 252; ... } ← light values override
        │
        ▼  tailwind.config.ts
surface.DEFAULT = rgb(var(--color-surface) / <alpha-value>)
```

### Rules

1. **Never hardcode hex colors** for theme-aware surfaces — always use the named tokens.
2. **Surface + accent** tokens (`bg-surface`, `text-accent-light`, `border-surface-border`) adapt automatically via CSS variables.
3. **Content tokens** (`text-content-primary/secondary/muted/subtle`) replace `text-white` and `text-gray-*` for all text on theme-adaptive backgrounds. No CSS overrides needed — see §6.
4. The outer background in `app.tsx` switches between dark `#060714` and light `#dde3ee` via inline style reacting to `usePreferencesStore.theme`.
5. `usePreferencesStore` is persisted. On first visit, `detectSystemTheme()` reads `prefers-color-scheme`.

### Adding a new theme

Currently only `dark` and `light` are supported. To add a new theme (e.g. `amoled`):

1. Add `'amoled'` to the `Theme` union in `stores/preferences/index.ts`.
2. Add `html.amoled { --color-surface: 0 0 0; ... }` to `globals.css`.
3. Add an option card in `settings-panel.tsx` translations (`i18n.ts`) and UI.

---

## §27 — i18n (Translations)

### Architecture

All UI strings live in a **single file**: `src/lib/i18n.ts`. The `Translations` interface enforces that every language provides every key — TypeScript errors if a key is missing or has the wrong type.

```typescript
export const translations: Record<Language, Translations> = {
  en:    { nav: { feed: 'Feed', ... }, ... },
  'pt-BR': { nav: { feed: 'Feed', ... }, ... },
};
```

### `useTranslation` hook

```typescript
import { useTranslation } from '@/hooks/use-translation';

export function MyComponent(): React.JSX.Element {
  const t = useTranslation();
  return <button>{t.feed.readButton}</button>;
}
```

- `useTranslation` reads `usePreferencesStore.language` reactively.
- The entire UI updates instantly when the user changes language in Settings — no page reload.
- **Do not import from `@/lib/i18n` directly in components** — always use the hook.

### Dynamic strings (with parameters)

Dynamic strings are typed as functions. TypeScript enforces the signature across all languages:

```typescript
charCount: (n: number) => string;
count: (active: number, total: number) => string;
toastActivated: (tag: string) => string;
```

Usage:

```tsx
<p>{t.descriptionForm.charCount(value.length)}</p>
<p>{t.tagManager.count(activeTags.length, extractedTags.length)}</p>
```

### Adding a new language

1. Add the language code to `Language` type in `stores/preferences/index.ts`:
   ```typescript
   export type Language = "en" | "pt-BR" | "es";
   ```
2. Add a new key to the `translations` object in `src/lib/i18n.ts`:
   ```typescript
   es: { nav: { feed: 'Feed', saved: 'Guardados', ... }, ... }
   ```
   TypeScript will list every missing key as a compile error until the object is complete.
3. Add an option card for the new language in `settings-panel.tsx` (label + description strings go in `i18n.ts` `settings.language*` keys if needed).

### Adding a new translatable string

1. Add the key to the `Translations` interface in `src/lib/i18n.ts`.
2. Add the value for `en` and `pt-BR`.
3. Use `t.mySection.myKey` via `useTranslation()` in the component.
4. TypeScript will error until all languages have the new key.

### What NOT to translate

- Tag names (`AWS`, `TypeScript`, etc.) — these are domain identifiers, not UI labels.
- Post titles and content — generated by Gemini (language controlled via Gemini prompt, future feature).

### `common` namespace

Shared strings reused across multiple unrelated components:

- `t.common.close` — close button aria-label (used by all portal modals)

### `errors` namespace

`t.errors: Record<ApiErrorCode, string>` — maps every `ApiErrorCode` to a translated user-facing message. **All catch blocks use `getApiErrorMessage(err, t.errors)` — never hardcode error strings in components.**

Adding a new error code requires:

1. Add the code to `ApiErrorCode` in `src/types/domain.ts`
2. Add to the `isApiErrorCode` guard in `src/services/api.ts`
3. Add the `switch` case in `getApiErrorMessage`
4. Add translations in `t.errors` for all languages in `src/lib/i18n.ts`

---

## §28 — Toast Notification Pattern

### Architecture

Toasts are triggered via `useToastStore.addToast()` from any component or hook. `ToastContainer` is rendered in `app.tsx` and positions toasts in the **top-right corner** (`z-[100]`).

```
Component calls addToast({ type, message })
        │
        ▼
useToastStore.toasts[] gains a new entry
        │
        ▼
ToastContainer renders <ToastItem> (Radix ToastPrimitive.Root)
        │
        ▼
data-[state=open]:animate-toast-in  ← slides in from right with overshoot
        │
        ▼  (after 4000ms, Radix calls onOpenChange(false))
data-[state=closed]:animate-toast-out  ← slides out to right
        │
        ▼  (after EXIT_DURATION_MS = 280ms, useEffect)
removeToast(id) → component unmounts
```

### Usage

```typescript
import { useToastStore } from '@/stores/toast';
import { getApiErrorMessage } from '@/services/api';

export function MyComponent(): React.JSX.Element {
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const handleSave = async (): Promise<void> => {
    try {
      await api.post('/some-endpoint', {});
      addToast({ type: 'success', message: t.section.toastSuccess });
    } catch (err) {
      addToast({ type: 'error', message: getApiErrorMessage(err, t.errors) });
    }
  };
  ...
}
```

### Types

| Type      | Icon            | Bar color | When to use                                       |
| --------- | --------------- | --------- | ------------------------------------------------- |
| `success` | ✓ CheckCircle   | green-500 | Action completed successfully                     |
| `error`   | ✗ XCircle       | red-500   | Action failed — always show on `.catch()`         |
| `warning` | ⚠ TriangleAlert | amber-400 | Non-critical issue (e.g. settings failed to sync) |
| `info`    | ℹ Info          | blue-500  | Neutral information                               |

### Rules

1. **Every API action must have a toast** — both `.then()` (success) and `.catch()` (error). Silent failures are forbidden.
2. **Success toasts** use component-specific `t.*` strings (e.g. `t.saved.toastSaved`).
3. **Error toasts** always use `getApiErrorMessage(err, t.errors)` — maps the backend `ApiErrorCode` to the translated message from `t.errors`. Never hardcode error message strings in components.
4. **Never call `removeToast` synchronously** in `onOpenChange` — this skips the exit animation. Use the `useEffect` + `setTimeout` pattern (already implemented in `toast/index.tsx`).
5. **Duration:** default 4000ms. For destructive/error actions, use 5000ms: `addToast({ type: 'error', message: '...', duration: 5000 })`.
6. **User can dismiss early** via the X button — the Radix `Close` component calls `onOpenChange(false)` which triggers the exit animation before removal.

### Controlled Radix Toast pattern (implemented in `toast/index.tsx`)

The key insight: `ToastPrimitive.Root` must use `open` + `onOpenChange` (controlled). Without this, Radix cannot auto-dismiss reliably.

```tsx
const [open, setOpen] = React.useState(true);

React.useEffect(() => {
  if (open) return;
  const timer = setTimeout(() => {
    removeToast(id);
  }, EXIT_DURATION_MS);
  return () => {
    clearTimeout(timer);
  };
}, [open, removeToast, id]);

<ToastPrimitive.Root
  open={open}
  onOpenChange={setOpen} // Radix sets to false after `duration` ms OR on Close click
  duration={duration}
  className="... data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out"
>
  <ToastPrimitive.Close>
    {" "}
    {/* NO onClick — Radix handles it via onOpenChange */}
    <X />
  </ToastPrimitive.Close>
</ToastPrimitive.Root>;
```
