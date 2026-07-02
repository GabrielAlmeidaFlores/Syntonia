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
8. **Update AGENTS.md** — if you add a component, page, store, or mock, document it here.

**There are no exceptions to this flow.**

---

## §2 — Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.x | UI framework |
| TypeScript | 5.7.x | Language — strict mode, zero `any` |
| Vite | 6.x | Build tool + dev server |
| Tailwind CSS | 3.4.x | Utility-first styling |
| Zustand | 5.x | Global state management |
| React Router | 6.28.x | Client-side routing |
| Framer Motion | 11.x | Swipe animations (PostCard, PostDetail) |
| react-markdown | 9.x | Renders Markdown post content |
| rehype-highlight | 7.x | Syntax highlighting in code blocks |
| highlight.js | 11.x | Highlight themes |
| Radix UI | various | Accessible headless primitives |
| CVA | 0.7.x | Component variant system |
| clsx + tailwind-merge | latest | Class name merging (`cn()`) |
| Lucide React | 0.469.x | Icon set |

**Node version:** 22.15.0 (enforced via `engines` in package.json)

**Zero real API calls** — this is a pure mock. All data comes from `src/mocks/data/`.

---

## §3 — Directory Structure

```
src/
├── main.tsx                         Entry point. Starts MSW worker in dev, then renders App.
├── app/
│   ├── App.tsx                      Root component. Toast + Tooltip providers + AppRouter.
│   └── layouts/
│       ├── index.tsx                Barrel export for layouts.
│       └── feed-layout.tsx          Authenticated layout: Outlet + bottom nav (Feed | Profile | Logout).
├── components/
│   ├── shared/                      Feature-agnostic reusable components.
│   │   ├── empty-feed-screen/       "No posts yet" — shown when feed is empty.
│   │   ├── loading-skeleton/        Full-screen PostCard skeleton during loading.
│   │   └── tag-selector/            Toggleable tag chips (receives tags + activeTags as props).
│   └── ui/                          Design system primitives (CVA + Radix UI).
│       ├── button/                  Button — variants: primary, outline, ghost, destructive, link.
│       ├── badge/                   Badge — variants: default, accent, outline, success, warning,
│       │                            destructive, tag, tag-active.
│       ├── card/                    Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
│       ├── input/                   Controlled text input (dark theme).
│       ├── textarea/                Controlled textarea (dark theme).
│       ├── skeleton/                Shimmer skeleton block (dark theme).
│       └── toast/                   ToastContainer + ToastViewport (Radix Toast).
├── features/                        One folder per feature, structured as {feature}/page/.
│   ├── auth/
│   │   └── login/page/              MockCognitoPage — calls POST /auth/callback (MSW).
│   ├── onboarding/page/             OnboardingPage + extracted-tags.tsx
│   ├── feed/page/                   FeedPage + feed-container.tsx + post-card.tsx + post-detail.tsx
│   ├── profile/page/                ProfilePage + description-form.tsx + tag-manager.tsx
│   └── post/page/                   PostPage — deep-link single post view (/post/:id).
├── hooks/
│   ├── use-feed.ts                  Calls GET /feed via api.ts; paginates with cursor.
│   └── use-jit.ts                   Calls POST /feed/request when buffer ≤ TRIGGER_THRESHOLD.
├── lib/
│   ├── env.ts                       Single source of truth for all VITE_* env vars. Every
│   │                                import.meta.env access goes through here — nowhere else.
│   ├── utils.ts                     cn(), formatDate(), formatRelativeTime(), truncate(), sleep().
│   └── constants.ts                 AVAILABLE_TAGS, DEFAULT_TAGS, TRIGGER_THRESHOLD,
│                                    MAX_PENDING_REQUESTS, FEED_PAGE_SIZE, TAG_EXTRACTION_DELAY_MS,
│                                    JIT_GENERATION_DELAY_MS.
├── mocks/
│   ├── browser.ts                   Configures and exports the MSW ServiceWorker instance.
│   ├── handlers/
│   │   ├── index.ts                 Barrel: [...authHandlers, ...feedHandlers, ...userHandlers].
│   │   ├── auth.ts                  POST /auth/callback → returns MOCK_USER + fake token (800ms).
│   │   ├── feed.ts                  GET /feed, GET /post/:id, POST /feed/request.
│   │   └── user.ts                  GET /user/preferences, PUT /user/preferences, PUT /user/profile.
│   └── data/
│       ├── index.ts                 Barrel: exports MOCK_POSTS, MOCK_USER, mockExtractTags, TAG_COLORS.
│       ├── posts.ts                 15 mock posts (5 topics × 3) with Markdown content.
│       ├── user.ts                  MOCK_USER — single source of truth for the mock authenticated user.
│       └── tags.ts                  TAG_COLORS map + mockExtractTags() simulation function.
├── router/
│   └── index.tsx                    createBrowserRouter, RequireAuth, RootRedirect, AppRouter.
├── services/
│   └── api.ts                       Central HTTP client (api.get/post/put/delete). MSW intercepts
│                                    all calls in dev; real API Gateway in production.
├── stores/
│   ├── auth/
│   │   └── index.ts                 useAuthStore — user, token, login(code), logout.
│   ├── feed/
│   │   └── index.ts                 useFeedStore — posts[], currentIndex, cursor, isLoading, hasMore.
│   ├── user/
│   │   └── index.ts                 useUserStore — description, activeTags, setProfile, toggleTag.
│   └── toast/
│       └── index.ts                 useToastStore — toasts[], addToast, removeToast.
├── styles/
│   └── globals.css                  @tailwind base/components/utilities + dark theme overrides +
│                                    snap-scroll utilities (.snap-feed, .snap-card) +
│                                    Markdown prose overrides.
└── types/
    ├── domain.ts                    Post, Tag, UserProfile, FeedResponse, UserPreferences,
    │                                GenerationResponse, UpdateProfileResponse.
    └── index.ts                     Re-exports from domain.ts.
```

---

## §4 — Naming Conventions

| Category | Convention | Example |
|---|---|---|
| Component files | `kebab-case/index.tsx` | `post-card/index.tsx` |
| Sub-components | `kebab-case.tsx` alongside `index.tsx` | `post-detail.tsx` |
| Hook files | `use-kebab-case.ts` | `use-feed.ts` |
| Store files | `kebab-case/index.ts` | `feed/index.ts` |
| Mock files | `kebab-case.ts` | `posts.ts` |
| Constants | `SCREAMING_SNAKE_CASE` | `TRIGGER_THRESHOLD` |
| Types/Interfaces | `PascalCase` | `Post`, `UserProfile` |
| Functions | `camelCase` | `mockExtractTags` |
| React components | `PascalCase` named export | `export function PostCard` |
| Pages | `default export` + PascalCase | `export default function FeedPage` |

**File structure rule:** Each UI component lives in its own folder with `index.tsx`. Sub-components for a feature page live alongside the page's `index.tsx`.

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

### Tailwind custom colors (dark theme)

```
surface.DEFAULT   #030712   gray-950 — app background
surface.card      #111827   gray-900 — card surfaces
surface.elevated  #1f2937   gray-800 — inputs, elevated elements
surface.border    #374151   gray-700 — borders, dividers

accent.DEFAULT    #4f46e5   indigo-600 — primary interactive
accent.hover      #4338ca   indigo-700
accent.light      #e0e7ff   indigo-100 — text on dark for accent context
accent.muted      #312e81   indigo-900 — subtle accent backgrounds
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

| Topic | Gradient |
|---|---|
| AWS / Serverless | `['#FF6B35', '#F7931E']` |
| TypeScript | `['#3178C6', '#235A97']` |
| Docker | `['#0DB7ED', '#384D54']` |
| Kubernetes | `['#326CE5', '#1A3A8F']` |
| Security | `['#E74C3C', '#922B21']` |
| Redis | `['#D82C20', '#8B1A10']` |
| PostgreSQL | `['#336791', '#1A3A5C']` |
| Terraform | `['#7B42BC', '#4A1A8C']` |
| Architecture / General | `['#2ECC71', '#1A7A44']` |

---

## §7 — Component Pattern (CVA + Radix UI)

All design-system components follow this structure:

```tsx
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const componentVariants = cva(
  'base classes',
  {
    variants: {
      variant: { default: '...', accent: '...' },
      size:    { default: '...', sm: '...' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {}

function Component({ className, variant, size, ...props }: ComponentProps): React.JSX.Element {
  return <element className={cn(componentVariants({ variant, size, className }))} {...props} />;
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

| Component | Props | Description |
|---|---|---|
| `EmptyFeedScreen` | `onReload: () => void` | Shown when feed is empty. Links to /profile, has reload button. |
| `LoadingSkeleton` | none | Full-height shimmer card shown at the end of the feed while JIT runs. |
| `TagSelector` | `tags`, `activeTags`, `onToggle`, `className?` | Toggleable tag chips. Renders only the provided `tags` — never `AVAILABLE_TAGS` directly. |

---

## §9 — Layout Rules

### `FeedLayout` (`/feed`, `/profile`)

- `h-dvh` container, `flex-col`
- `<Outlet />` fills `flex-1 overflow-hidden`
- Bottom nav: `h-16 shrink-0` with Feed + Profile + Logout tabs
- No sidebar, no top header — Syntonia is mobile-first

### No-layout pages

Pages that render without `FeedLayout`:
- `/auth/login` (MockCognitoPage)
- `/onboarding` (OnboardingPage)
- `/post/:id` (PostPage — full-screen, own sticky header)

### Snap-scroll CSS

The feed uses CSS snap, not JavaScript scroll control:

```css
/* Applied to FeedContainer's wrapper */
.snap-feed {
  scroll-snap-type: y mandatory;
  overflow-y: scroll;
  height: 100dvh;
}

/* Applied to each PostCard */
.snap-card {
  scroll-snap-align: start;
  scroll-snap-stop: always;
  height: 100dvh;
}
```

---

## §10 — Routing Rules

```
/                  RootRedirect → /auth/login | /onboarding | /feed
/auth/login        MockCognitoPage (no auth required)
/onboarding        OnboardingPage (RequireAuth)
/feed              FeedPage (RequireAuth + FeedLayout)
/profile           ProfilePage (RequireAuth + FeedLayout)
/post/:id          PostPage (RequireAuth, no layout)
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
import { create } from 'zustand';

interface MyState {
  // State (readonly)
  readonly value: string;
  // Actions
  readonly setValue: (v: string) => void;
}

export const useMyStore = create<MyState>((set) => ({
  value: '',
  setValue: (value) => set({ value }),
}));
```

**Rules:**
- State fields are `readonly` in the interface.
- Actions receive primitive values — no complex objects in `set()` unless necessary.
- Use `(s) => s.field` selectors in components to avoid unnecessary re-renders.
- `persist` middleware is used only for `useUserStore` (localStorage key: `syntonia-user-prefs`).

### Stores summary

| Store | Key state | Persisted? |
|---|---|---|
| `useAuthStore` | `user`, `isAuthenticated` | No |
| `useFeedStore` | `posts[]`, `currentIndex`, `cursor`, `isLoading` | No |
| `useUserStore` | `description`, `activeTags` | Yes (localStorage) |
| `useToastStore` | `toasts[]` | No |

---

## §12 — Mock Data Rules & MSW

### The HTTP flow

All API calls go through `src/services/api.ts` → `fetch()` → **MSW intercepts in dev** → mock handler returns JSON.

```
Component / Hook
     │
     ▼
api.get('/feed') ← src/services/api.ts
     │
     ▼
fetch('/feed')   ← browser native fetch
     │
     ▼  [MSW ServiceWorker intercepts]
Handler in src/mocks/handlers/feed.ts
     │
     ▼
HttpResponse.json({ posts: MOCK_POSTS.slice(...) })
     │
     ▼
Component receives { posts, cursor, hasMore }
```

In production: remove MSW initialisation from `main.tsx`, set `VITE_API_URL`, and all requests go to the real API Gateway.

### Adding a new API endpoint

1. Add the handler in `src/mocks/handlers/{domain}.ts`
2. Add it to the barrel in `src/mocks/handlers/index.ts`
3. Call it via `api.get/post/put/delete(...)` in the component/hook
4. Never import mock data directly in components or hooks — always via `api.ts`

### Adding mock posts

Add to `src/mocks/data/posts.ts`. Follow this shape:

```typescript
{
  id: 'post-NNN',           // Unique, sequential
  userId: 'user-mock-001',  // Always the mock user
  title: '...',             // Max 60 characters
  summary: '...',           // Max 120 characters
  tags: ['AWS'] as Tag[],   // 1–3 tags from AVAILABLE_TAGS
  gradient: ['#hex1', '#hex2'],  // See §6 gradient convention
  createdAt: '2026-07-0xTxx:00:00Z',
  content: `## Heading\n\nMarkdown content with \`code blocks\`...`,
}
```

### Mock delays (defined in MSW handlers)

| Endpoint | Delay | Simulates |
|---|---|---|
| `POST /auth/callback` | 800ms | Cognito OAuth round-trip |
| `GET /feed` | 400ms | DynamoDB GSI Query + Lambda |
| `GET /post/:id` | 200ms | DynamoDB GetItem |
| `POST /feed/request` | 300ms | SQS SendMessage |
| `GET /user/preferences` | 200ms | DynamoDB GetItem |
| `PUT /user/preferences` | 400ms | DynamoDB UpdateItem |
| `PUT /user/profile` | 2000ms | Gemini API tag extraction |

### `mockExtractTags(description: string): Tag[]`

Keyword-matching function that simulates Gemini's `extractTagsFromDescription`.
Used by the `PUT /user/profile` MSW handler. Always returns at least 3 tags.
Source: `src/mocks/data/tags.ts`.

### Adding posts

Add to `src/mocks/data/posts.ts`. Follow this shape:

```typescript
{
  id: 'post-NNN',           // Unique, sequential
  userId: 'user-mock-001',  // Always the mock user
  title: '...',             // Max 60 characters
  summary: '...',           // Max 120 characters
  tags: ['AWS'] as Tag[],   // 1–3 tags from AVAILABLE_TAGS
  gradient: ['#hex1', '#hex2'],  // See §6 gradient convention
  createdAt: '2026-07-0xTxx:00:00Z',
  content: `## Heading\n\nMarkdown content with \`code blocks\`...`,
}
```

### Mock delays

Always simulate realistic latency using `sleep()` from `@/lib/utils`:

| Operation | Delay | Constant |
|---|---|---|
| Initial feed load | 400ms | (inline in `useFeed`) |
| JIT generation | 1500ms | `JIT_GENERATION_DELAY_MS` |
| Tag extraction | 2000ms | `TAG_EXTRACTION_DELAY_MS` |
| Tag save | 400ms | (inline in `useTagManager`) |
| Mock Cognito login | 800ms | (inline in `MockCognitoPage`) |

### `mockExtractTags(description: string): Tag[]`

Keyword-matching function that simulates Gemini's `extractTagsFromDescription`.
Returns a subset of `AVAILABLE_TAGS`. Always returns at least 3 tags.
Source: `src/mocks/data/tags.ts`.

---

## §13 — Feed Mechanics

### Snap-scroll

The feed is a CSS snap-scroll container. Each `PostCard` occupies `100dvh` and locks on scroll.

```
FeedPage
  └── FeedContainer (div.snap-feed)
       ├── PostCard (div.snap-card) data-index="0"
       ├── PostCard (div.snap-card) data-index="1"
       ├── PostCard (div.snap-card) data-index="2"
       └── LoadingSkeleton (div.snap-card)  ← shown when isLoading
```

### currentIndex tracking

`FeedContainer` uses `IntersectionObserver` (threshold: 0.7) to update `useFeedStore.currentIndex` when a new card becomes 70% visible.

### JIT trigger

`useJIT` runs inside `FeedPage` on every render:

```
postsRemaining = totalPosts - currentIndex
if postsRemaining <= TRIGGER_THRESHOLD (2) && !isGenerating:
  → simulate POST /feed/request
  → await sleep(JIT_GENERATION_DELAY_MS)
  → appendPosts(3 shuffled posts matching activeTags)
  → isGenerating stays true for 10s (debounce)
```

### X-axis: PostCard → PostDetail

1. User drags `PostCard` left > 80px (`framer-motion` drag).
2. `setExpanded(true)` triggers `AnimatePresence`.
3. `PostDetail` slides in from the right (`x: '100%' → 0`).
4. "Back" button calls `setExpanded(false)` → `PostDetail` slides out.

---

## §14 — Post Content (Markdown)

`PostDetail` and `PostPage` both render Markdown using:

```tsx
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

<ReactMarkdown rehypePlugins={[rehypeHighlight]}>
  {post.content ?? post.summary}
</ReactMarkdown>
```

The `prose-invert` Tailwind class combined with custom overrides in `globals.css` styles the rendered Markdown for the dark theme.

**If `post.content` is undefined** (feed-only view), fall back to `post.summary`.

---

## §15 — Tag System Rules

### AVAILABLE_TAGS

The master list of 20 valid tags is defined in `src/lib/constants.ts` and `src/types/domain.ts` (as a TypeScript union type).

Never hardcode tag strings in components — always import from `@/lib/constants`.

### activeTags

- Extracted by AI from the user's `description` (mocked via `mockExtractTags`).
- Stored in `useUserStore.activeTags` (persisted in localStorage).
- Minimum 1 active tag must always remain — enforced in `useUserStore.toggleTag` and `TagSelector`.
- Used by `useJIT` to filter relevant posts for generation.

### Tag display rules

| Context | Component | Tags shown |
|---|---|---|
| PostCard gradient card | inline `Badge` | Post's own tags (from `post.tags`) |
| OnboardingPage review | `ExtractedTags` | AI-extracted tags for confirmation |
| ProfilePage / Tags tab | `TagSelector` | User's `activeTags` |

---

## §16 — User Profile Rules

### Description → Tags flow

1. User writes description in `DescriptionForm` (min 20, max 500 chars).
2. On save → `mockExtractTags(description)` simulates Gemini API.
3. Returns `Tag[]` → `useUserStore.setProfile(description, extractedTags)`.
4. All extracted tags start as `activeTags`.
5. User can then disable individual tags in `TagManager`.

### Onboarding vs Profile

| Feature | OnboardingPage | ProfilePage |
|---|---|---|
| Route | `/onboarding` | `/profile` |
| First-time only | Yes | No |
| Has layout (bottom nav) | No | Yes |
| Description field | Yes | Yes (`DescriptionForm`) |
| Tag review | Yes (inline `ExtractedTags`) | Yes (separate `TagManager` tab) |

---

## §17 — Auth Flow (Mock)

### Production (real Cognito)

```
User → /auth/login → Cognito Hosted UI → confirm email
→ Cognito PostConfirmation trigger → profile created in DynamoDB
→ App redirect → /onboarding (no description) or /feed
```

### Mock flow

```
User → /auth/login → MockCognitoPage
→ click "Continue with Cognito"
→ sleep(800ms)
→ useAuthStore.mockCognitoLogin() → sets user from MOCK_AUTH_USER
→ useUserStore.setProfile(description, activeTags)
→ navigate(returnTo) → /feed (mock user has description set)
```

The mock user has a pre-set description and active tags so the feed works immediately after login.

### RequireAuth

Wraps all authenticated routes. Reads `useAuthStore.isAuthenticated`. On `false`:

```tsx
return <Navigate to={`/auth/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
```

---

## §18 — Animation Guidelines

### When to use Framer Motion

- **PostCard drag** — `useMotionValue(0)` + `drag="x"` + `dragConstraints`.
- **PostDetail slide** — `AnimatePresence` + `motion.div` with `x: '100%' → 0`.
- **New page transitions** — optional, use `animate-fade-in` CSS class first.

### When to use CSS animations (Tailwind)

- Skeleton shimmer: `animate-shimmer` or `shimmer-base` utility.
- Toast notifications: `animate-toast-in`, `animate-toast-out`.
- Page content appearance: `animate-fade-in`, `animate-slide-up`, `animate-scale-in`.
- Loading spinners: `animate-spin`.

### `prefers-reduced-motion`

`globals.css` includes a media query that disables all animations for users who prefer reduced motion. **Never override this.**

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
5. If it needs mock data, add it to `src/mocks/data/`.
6. If it needs state, add a Zustand store in `src/stores/`.
7. Update §3 (directory tree) and §9 (routing) in this file.

---

## §22 — Adding a New UI Component

1. Create `src/components/ui/{name}/index.tsx`.
2. Use the CVA pattern from §7.
3. Export: component function + variants function + Props type.
4. Add dark-theme-appropriate defaults (see §6 for color tokens).
5. Add to the components table in §8 if it's a shared component.

---

## §23 — Performance Guidelines

1. **All pages are `React.lazy`** — loaded on demand, not in the initial bundle.
2. **`React.memo`** — use on components that receive stable props and render frequently (e.g., `PostCard` inside a long list).
3. **Stable references** — use `React.useCallback` for functions passed as props, `React.useMemo` for expensive derived values.
4. **Avoid re-renders** — use Zustand selectors `(s) => s.field` to subscribe to only what you need.
5. **Image optimisation** — not applicable in the mock (no images). When added, always specify `width` + `height`.

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
 * Paginates the mock post list, simulating GET /feed?limit=5&cursor=...
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
export function mockExtractTags(description: string): Tag[] { ... }
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

| Situation | Correct action |
|---|---|
| Want to explain what a variable holds | Give it a descriptive name |
| Want to explain why a value is used | Give the function/hook a descriptive name |
| Want to mark a TODO | Open a GitHub issue instead |
| Need to document an exported function | Add a JSDoc block |
| ESLint flags a rule violation | Fix the code — never suppress the rule |

