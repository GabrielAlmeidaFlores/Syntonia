# Syntonia — Architecture Document

> Personal Learning Engine: infinite technical feed, AI-generated, fully controlled by the user.

---

## Table of Contents

1. [Vision & Core Concept](#1-vision--core-concept)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Frontend — React + AWS Amplify](#3-frontend--react--aws-amplify)
4. [Backend — AWS Lambda + Serverless Framework](#4-backend--aws-lambda--serverless-framework)
5. [Database — DynamoDB](#5-database--dynamodb)
6. [Authentication — AWS Cognito](#6-authentication--aws-cognito)
7. [AI Layer — Gemini API](#7-ai-layer--gemini-api)
8. [API Contract (REST)](#8-api-contract-rest)
9. [Data Models](#9-data-models)
10. [Content Generation Flow (Just-in-Time)](#10-content-generation-flow-just-in-time)
11. [Feed Navigation UX Model](#11-feed-navigation-ux-model)
12. [Infrastructure as Code](#12-infrastructure-as-code)
13. [Project Directory Structure](#13-project-directory-structure)
14. [Local Development Setup](#14-local-development-setup)
15. [Environments & CI/CD](#15-environments--cicd)
16. [Monitoring & Observability](#16-monitoring--observability)
17. [Cost Model](#17-cost-model)
18. [Security Checklist](#18-security-checklist)
19. [Roadmap & Phases](#19-roadmap--phases)

---

## 1. Vision & Core Concept

**Syntonia** is a *Personal Learning Engine* — an app that delivers dense, ultra-specific technical content generated in real time by AI, using the addictive navigation mechanics of TikTok.

### Competitive Advantage

| Feature | Traditional Social Networks | Syntonia |
|---|---|---|
| Content curation | Third-party engagement algorithm | Driven by user's own profile description |
| Tag discovery | Manual, user must know what to search | AI extracts relevant tags from user's description |
| Tag control | N/A | User enables/disables individual AI-extracted tags |
| Depth | Shallow (threads, short posts) | Full Markdown with code, diagrams and examples |
| Generation | Human-created, static content | AI-generated in real time, personalized per description + active tags |
| Intent | Entertainment | Intentional technical learning |
| Repetition | Frequently repeated content | Deduplication system ensures novelty |

### Bi-dimensional Navigation Model

```
Y-AXIS (vertical scroll — navigates between posts)
│
│  ┌─────────────────────────────────────┐
│  │  Card 1: "AWS Lambda Cold Start"     │  ◄── visible
│  │  summary + tags + gradient          │
│  └─────────────────────────────────────┘
│  ┌─────────────────────────────────────┐
│  │  Card 2: "DynamoDB GSI vs LSI"      │  ◄── next (pre-rendered)
│  └─────────────────────────────────────┘
│  ┌─────────────────────────────────────┐
│  │  Card 3: "React Server Components"  │  ◄── pre-loaded in memory
│  └─────────────────────────────────────┘
▼

         X-AXIS (horizontal swipe — depth)
         ──────────────────────────────────────────►
         [PostCard: Summary]  →  [PostDetail: Full Markdown]
                                  (code blocks, diagrams, practical examples)
```

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                              USER                                   │
│                     React SPA (Amplify Hosting)                     │
│               aws-amplify v6 SDK + Cognito User Pool                │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS / Authorization: Bearer <JWT>
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    API Gateway (REST API)                           │
│         Cognito Authorizer on all protected routes                  │
│         Throttling: 1000 req/s burst, 500 req/s steady              │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
  [getFeed]    [requestPost]   [getPost]     [user/preferences]
  [getSaved]   [savePost]      [unsavePost]  [get + update]
       │              │              │
       │    ┌─────────┴──────────┐   │
       │    │                    │   │
       │    ▼                    ▼   │
       │  [SQS: GenerationQueue] [DynamoDB: SintoniaRequests]
       │    │                    (history + throttle check)
       │    │ (trigger)
       │    ▼
       │  [Lambda: workerInternal]
       │    │  reservedConcurrency: 5
       │    ├── [Gemini API]
       │    │
       │    ▼  on failure (3x)
       │  [SQS: GenerationDLQ]
       │
       ▼    ▼
     [DynamoDB: SintoniaFeed]
       │    ttl = 90 days on creation
       │    savedAt set when saved → ttl removed
                      │
     [DynamoDB: SintoniaUsers] ◄── Cognito Post-Confirmation Trigger
                                   (creates user profile automatically)
```

### AWS Services Used

| Service | Role |
|---|---|
| **AWS Amplify Hosting** | Frontend hosting (React SPA), automatic CI/CD per branch |
| **API Gateway (REST)** | HTTP routing, CORS, Cognito Authorizer, throttling |
| **AWS Lambda** | All business logic (17 functions: 15 HTTP/SQS handlers + 1 Cognito trigger + 1 async worker) |
| **DynamoDB** | Primary database (NoSQL, serverless, PAY_PER_REQUEST) |
| **DynamoDB Streams** | Not used for queue triggering — SQS handles that |
| **SQS (GenerationQueue)** | Reliable delivery of generation requests to `workerInternal` |
| **SQS (GenerationDLQ)** | Dead Letter Queue — captures requests that failed after 3 retries |
| **Cognito User Pools** | Authentication (sign up, sign in, JWT, email verification, password reset) |
| **SSM Parameter Store** | Secure secret storage (GEMINI_API_KEY encrypted with KMS) |
| **CloudWatch Logs** | Logs for all Lambda functions (14-day retention) |
| **CloudWatch Alarms** | Alerts for worker errors, throttling, and latency |
| **IAM** | Least-privilege roles for each Lambda function |
| **DynamoDB (SintoniaRateLimit)** | Fixed-window rate limiting counters with TTL auto-expiry — protects against brute force and AI cost abuse |

---

## 3. Frontend — React + Vite + MSW

> **Status:** Production-ready frontend connected to AWS backend. In development, MSW intercepts every `fetch` request and returns deterministic mock data (`VITE_MODE === "development"`). In production, Cognito (`@aws-amplify/auth`) handles auth and all requests go to the real API Gateway. The `VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, and `VITE_COGNITO_CLIENT_ID` env vars control the production target.

### Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3.x | UI framework |
| **TypeScript** | 5.7.x | Strict mode — zero `any`, full type safety |
| **Vite** | 6.x | Build tool + dev server |
| **Tailwind CSS** | 3.4.x | Utility-first styling with CSS variable tokens |
| **Zustand** | 5.x | Global state — 8 stores (auth, feed, saved, liked, user, preferences, terms, toast) |
| **React Router** | 6.28.x | Client-side routing — lazy-loaded pages |
| **Framer Motion** | 11.x | Snap-scroll, swipe transitions, stagger animations |
| **react-markdown** | 9.x | Renders Markdown post content |
| **rehype-highlight** | 7.x | Syntax highlighting in code blocks |
| **remark-gfm** | latest | GitHub Flavored Markdown support |
| **highlight.js** | 11.x | Syntax highlight themes |
| **aws-amplify** | 6.x | Cognito auth — signIn, signUp, confirmSignUp, signOut, session restore |
| **MSW** | 2.x | Mock Service Worker — intercepts all API calls in development |
| **Radix UI** | various | Accessible headless primitives (Tooltip) |
| **CVA** | 0.7.x | Class Variance Authority — component variant system |
| **clsx + tailwind-merge** | latest | Class name merging via `cn()` |

| **Lucide React** | 0.469.x | Icon set |

### Route Structure

```
/                     → RootRedirect → /auth/login | /onboarding | /feed
/auth/login           → LoginPage (signin / signup / confirm — real Cognito in prod, MSW in dev)
/onboarding           → OnboardingPage (RequireAuth) — first-time profile setup
/feed                 → FeedPage (RequireAuth + FeedLayout) — main snap-scroll feed
/saved                → SavedGridPage (RequireAuth + FeedLayout) — 2-column saved posts grid
/saved/feed           → SavedFeedPage (RequireAuth, no layout) — snap-scroll saved posts feed
/profile              → ProfilePage (RequireAuth + FeedLayout) — 3 tabs: Profile, Settings, Legal
/post/:id             → PostPage (RequireAuth, no layout) — deep-link single post view
```

**`RootRedirect` logic:**
1. Not authenticated → `/auth/login`
2. Authenticated + `description === ''` → `/onboarding`
3. Authenticated + has description → `/feed`

**Node version:** 22.15.0 | **Package manager:** yarn 1.22.22

### Application Entry Points

All pages are `React.lazy` — wrapped in `withSuspense()` which renders a `Spinner` as fallback.
- Starts MSW ServiceWorker in development (`VITE_MODE === "development"`)
- Renders `<App />` in `<React.StrictMode>`

**`src/app/app.tsx`**
- Syncs `usePreferencesStore.theme` → applies `'dark'` or `'light'` class to `<html>`
- Renders mesh-gradient outer background (adapts to theme)
- Checks `GET /legal/terms-status` after every authenticated login
- If `needsAcceptance: true` → renders `TermsAcceptanceModal` (full-screen blocking portal, z-index 99999)
- Provides `Tooltip.Provider`, `ToastContainer`, `AppRouter`

### Mock Architecture (MSW)

In development, **every** `api.get/post/put/delete` call is intercepted by MSW before reaching the network. The flow:

```
Component → api.ts → fetch() → [MSW ServiceWorker] → mock handler → JSON response
```

**Handlers:** `src/mocks/handlers/` (auth, feed, legal, saved, user)
**Mock data:** `src/mocks/data/` (posts, user, legal, saved, tags)

In production: all requests go to the real API Gateway with `VITE_API_URL`. MSW is automatically disabled when `VITE_MODE !== "development"`.

### Key Page Flows

**`LoginPage`** (`/auth/login`)
- Dev: single "Continue" button → `POST /auth/callback` (MSW) → returns mock user + token
- Prod (signin): email+password → Amplify `signIn` → `GET /user/preferences` → `syncFromServer`
- Prod (signup): email+password → Amplify `signUp` → 6-digit confirm code → auto sign-in
- Navigates to `returnTo` param or `/feed`

**`OnboardingPage`** (`/onboarding`)
1. User fills description (min 20, max 500 chars)
2. `PUT /user/profile` with `{ description }` → Gemini (mocked) extracts `activeTags`
3. User reviews and optionally deactivates extracted tags
4. `PUT /user/preferences` with `{ activeTags }` → saves final selection → `/feed`

**`FeedPage`** (`/feed`)
- `useFeed` fetches `GET /feed?limit=5&cursor=...` on mount and on pagination
- `useJIT` triggers `POST /feed/request` when ≤ 2 posts remain in buffer
- `FeedContainer` renders CSS snap-scroll column of `PostCard`s
- Swipe left on `PostCard` (or tap "Read") → `PostDetail` slides in from right
- `EmptyFeedScreen` shown if feed is empty after load

**`PostCard`** (feed + saved feed)
- Gradient background computed from `post.gradient[0/1]`
- Swipe detection via `useHorizontalSwipe` hook (native pointer events, not Framer Motion drag)
- Swipe left → opens `PostDetail` (slide variant: feed / expand variant: saved feed)
- `PostDetail` has sticky header: Back button + Bookmark toggle + Share button

**`ProfilePage`** (`/profile`) — 3 tabs
- **Profile tab:** `DescriptionForm` + `TagManager`
  - Description save → `PUT /user/profile` (2s delay — Gemini extraction)
  - Tag toggle → `PUT /user/preferences` with `{ activeTags }` (optimistic, rollback on error)
- **Settings tab:** `SettingsPanel`
  - Theme + Language option cards — **instant local update + `PUT /user/preferences` to persist to server**
  - On API failure: local preference is kept (Opção B) + warning toast
- **Legal tab:** `LegalTab`
  - Two rows: Terms of Use + Privacy Policy → each opens `LegalDocModal`

**`SavedGridPage`** (`/saved`)
- `useSavedPosts` loads `GET /posts/saved` with in-memory cache (TTL: 5 minutes)
- Skips re-fetch on re-mount if cache is fresh — instant navigation back to `/saved`
- **Reload button** (`RotateCcw` icon) in the header — invalidates cache and re-fetches from backend
- 2-column grid with stagger animation on load
- Each `SavedPostCard`: tap → opens `ExpandedOverlay` (full-screen portal, swipe right to close)
- Unsave button → `ConfirmModal` → `DELETE /post/:id/save`

**`SavedFeedPage`** (`/saved/feed?start=postId`)
- Reuses the same `PostCard` component with `detailVariant="expand"`
- Scrolls to `?start=postId` on mount
- No JIT generation — fixed list of saved posts

**`PostPage`** (`/post/:id`)
- Deep link for sharing — `GET /post/:id` on first visit; cached for 30 minutes
- Subsequent visits to the same post render instantly from cache (no network round-trip)
- Full Markdown rendering with syntax highlighting

### State Management

| Store | Key state | Persisted | localStorage key |
|---|---|---|---|
| `useAuthStore` | `user`, `isAuthenticated`, `login()`, `logout()` | No | — |
| `useFeedStore` | `posts[]`, `currentIndex`, `cursor`, `isLoading`, `isPostExpanded` | No | — |
| `useSavedStore` | `savedIds` (Set), `posts[]`, `isSaved()` | Yes | `syntonia-saved` |
| `useLikedStore` | `likedIds` (Set), `isLiked()` | Yes | `syntonia-liked` |
| `usePreferencesStore` | `theme`, `language` | Yes | `syntonia-preferences` |
| `useUserStore` | `description`, `extractedTags`, `activeTags` | Yes | `syntonia-user-prefs` |
| `useTermsStore` | `needsAcceptance`, `termsVersion`, `privacyVersion`, `isChecking` | No | — |
| `useToastStore` | `toasts[]`, `addToast()`, `removeToast()` | No | — |

### Theme System

CSS-variable-based. No component needs to know the active theme — only the CSS variable values change.

```
usePreferencesStore.theme ('dark' | 'light')
        │
        ▼  [useEffect in app.tsx]
document.documentElement.classList  →  class 'dark' or class 'light'
        │
        ▼  [globals.css]
:root           { --color-surface: 3 7 18; ... }      ← dark default
html.light      { --color-surface: 248 250 252; ... } ← light override
        │
        ▼  [tailwind.config.ts]
bg-surface = rgb(var(--color-surface) / <alpha-value>)
```

**Semantic text tokens:** `text-content-primary/secondary/muted/subtle` adapt automatically. Use these on surface backgrounds — never `text-white` or `text-gray-*`.

**First visit:** `detectSystemTheme()` reads `window.matchMedia('(prefers-color-scheme: dark)')`. After the user sets a preference via Settings, it is persisted to localStorage.

**Theme is also persisted to the backend via `PUT /user/preferences`** — synced on login from `GET /user/preferences`.

| CSS Variable | Dark | Light |
|---|---|---|
| `--color-surface` | `3 7 18` (#030712) | `248 250 252` (#f8fafc) |
| `--color-surface-card` | `17 24 39` (#111827) | `255 255 255` (#ffffff) |
| `--color-surface-elevated` | `31 41 55` (#1f2937) | `241 245 249` (#f1f5f9) |
| `--color-surface-border` | `55 65 81` (#374151) | `226 232 240` (#e2e8f0) |
| `--color-accent` | `79 70 229` (#4f46e5) | `79 70 229` (#4f46e5) |
| `--color-accent-light` | `224 231 255` (#e0e7ff) | `55 48 163` (#3730a3) |
| `--color-accent-muted` | `49 46 129` (#312e81) | `224 231 255` (#e0e7ff) |

### Language Preference (i18n)

Language stored in `usePreferencesStore.language` as `'en' | 'pt-BR'`. **Fully implemented:**

- `src/lib/i18n.ts` — single translations file `Record<Language, Translations>` with 80+ strings. TypeScript enforces every language implements every key.
- `src/hooks/use-translation.ts` — `useTranslation()` reads `language` reactively. UI updates instantly on language switch — no reload.
- `t.errors: Record<ApiErrorCode, string>` — all API error codes mapped to translated messages.

**Language is also persisted to the backend via `PUT /user/preferences`** — synced on login from `GET /user/preferences`.

**Phase 4:** Pass `language` to `PUT /user/profile` → Lambda includes it in Gemini prompt → AI generates posts in the user's preferred language.

### Legal / Terms Acceptance System

On every authenticated session start, `app.tsx` calls `GET /legal/terms-status`. If `needsAcceptance: true`, `TermsAcceptanceModal` renders as a full-screen portal blocking the entire app:

```
GET /legal/terms-status → needsAcceptance: true
        │
        ▼  [TermsAcceptanceModal mounts — z-index 99999]
Fetches GET /legal/terms + GET /legal/privacy (in parallel)
Renders both documents in expandable accordions
User reads, checks acceptance checkbox, clicks "Accept and continue"
        │
        ▼
POST /legal/accept { termsVersion, privacyVersion }
        │
        ▼
Backend writes termsAcceptedVersion/privacyAcceptedVersion to SintoniaUsers
clearAcceptance() → modal unmounts → user proceeds normally
```

From the **Legal tab** of ProfilePage, users can review both documents anytime via `LegalDocModal` (bottom-sheet, no blocking).

### Error Handling (ApiErrorCode)

All non-2xx backend responses return `{ code: ApiErrorCode, error: string, message: string }`. The frontend maps `code` → translated message via `t.errors`:

```typescript
.catch((err: unknown) => {
  addToast({ type: 'error', message: getApiErrorMessage(err, t.errors) });
})
```

`getApiErrorMessage` is exported from `src/services/api.ts`. `t.errors` is `Record<ApiErrorCode, string>` with translations for all 11 codes in both EN and PT-BR.

### API Client (`src/services/api.ts`)

```typescript
export const api = {
  get:    async <T>(path: string): Promise<T>
  post:   async <T>(path: string, body: unknown): Promise<T>
  put:    async <T>(path: string, body: unknown): Promise<T>
  delete: async <T>(path: string): Promise<T>
};

export function getApiErrorMessage(
  err: unknown,
  errors: Record<ApiErrorCode, string>,
): string;
```

On non-2xx: parses `{ code, message }` from response body, encodes as `"API_ERROR::<CODE>::<message>"` in an `Error` object. `getApiErrorMessage` decodes and returns the translated string.

### Build Configuration

**`frontend/.env.example`**
```bash
VITE_API_URL=https://xxxxxxxxxx.execute-api.sa-east-1.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=sa-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AWS_REGION=sa-east-1
```

**`frontend/package.json`** — key dependencies:
```json
{
  "dependencies": {
    "aws-amplify": "^6.18.0",
    "framer-motion": "^11.0.0",
    "highlight.js": "^11.9.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-markdown": "^9.0.0",
    "react-router-dom": "^6.28.0",
    "rehype-highlight": "^7.0.0",
    "remark-gfm": "^4.0.0",
    "zustand": "^5.0.0",
    "msw": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.469.0",
    "@radix-ui/react-tooltip": "latest"
  }
}
```

### AWS Amplify Hosting

```
Amplify Hosting
├── Repository:    GitHub (monorepo)
├── Branch: main          → production (syntonia.app)
├── Branch: development   → staging (dev.syntonia.app)
│
├── App root:      frontend/
├── Build command: yarn build
├── Output dir:    dist/
│
├── Environment Variables (per branch):
│   ├── VITE_API_URL
│   ├── VITE_COGNITO_USER_POOL_ID
│   ├── VITE_COGNITO_CLIENT_ID
│   └── VITE_AWS_REGION
│
├── Custom domain: syntonia.app
└── SPA rewrite: all non-asset paths → /index.html (200)
```

**`frontend/amplify.yml`**
```yaml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - yarn install --frozen-lockfile
        build:
          commands:
            - yarn build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
    appRoot: frontend
```

---

## 4. Backend — AWS Lambda + Serverless Framework (TypeScript)

### Full Stack

```
Node.js 22.x (AWS Lambda runtime)
├── TypeScript 5.x               — strict mode, zero any, full type safety
├── Serverless Framework v4      — IaC + deployment
├── serverless-esbuild           — TypeScript compilation + fast bundling for Lambda
├── serverless-offline           — Simulates API Gateway + Lambda locally (no AWS needed)
├── @google/generative-ai        — Official Gemini SDK
├── @aws-sdk/client-dynamodb     — AWS SDK v3
├── @aws-sdk/lib-dynamodb        — DocumentClient (simplifies DynamoDB operations)
├── @aws-sdk/client-sqs          — SQS client for sending generation requests
├── zod                          — Input schema validation
└── uuid                         — Unique ID generation
```

**`backend/package.json`**
```json
{
  "name": "syntonia-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "serverless offline --stage dev",
    "build": "tsc --noEmit",
    "deploy:dev": "serverless deploy --stage dev",
    "deploy:prod": "serverless deploy --stage prod",
    "seed:legal": "tsx scripts/seed-legal.ts",
    "logs:worker": "serverless logs -f workerInternal --tail"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.600.0",
    "@aws-sdk/lib-dynamodb": "^3.600.0",
    "@aws-sdk/client-sqs": "^3.600.0",
    "@google/generative-ai": "^0.15.0",
    "uuid": "^9.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.0",
    "@types/node": "^22.0.0",
    "@types/uuid": "^9.0.0",
    "esbuild": "^0.23.0",
    "serverless": "^4.0.0",
    "serverless-esbuild": "^1.50.0",
    "serverless-offline": "^13.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

**`backend/.env.example`**
```bash
# For local development with serverless-offline only.
# In production, values come from SSM Parameter Store.
GEMINI_API_KEY=AIzaSy...
FEED_TABLE=SintoniaFeed-dev
REQUESTS_TABLE=SintoniaRequests-dev
USERS_TABLE=SintoniaUsers-dev
RATE_LIMIT_TABLE=SintoniaRateLimit-dev
LEGAL_TABLE=SintoniaLegal-dev
GENERATION_QUEUE_URL=https://sqs.sa-east-1.amazonaws.com/123456789/syntonia-generation-dev
STAGE=dev
```

### Lambda Functions

| Function | Trigger | Timeout | Concurrency | Description |
|---|---|---|---|---|
| `getFeed` | GET /feed | 10s | Default | Returns paginated posts via GSI |
| `requestPost` | POST /feed/request | 10s | Default | Sends to SQS + persists request to DynamoDB |
| `workerInternal` | SQS (GenerationQueue) | 60s | Default | Calls Gemini, saves post with 90-day TTL |
| `getPost` | GET /post/{id} | 10s | Default | Returns a full post by ID |
| `savePost` | POST /post/{id}/save | 10s | Default | Sets `savedAt`, removes `ttl` — post persists forever |
| `unsavePost` | DELETE /post/{id}/save | 10s | Default | Removes `savedAt`, restores `ttl = now + 30d` |
| `likePost` | POST /post/{id}/like | 10s | Default | Sets `likedAt` — used as positive AI feedback signal |
| `unlikePost` | DELETE /post/{id}/like | 10s | Default | Removes `likedAt` |
| `getSavedPosts` | GET /posts/saved | 10s | Default | Returns saved posts via `userId-savedAt-index` GSI |
| `getPreferences` | GET /user/preferences | 10s | Default | Returns user profile, description, active tags, theme, and language |
| `updatePreferences` | PUT /user/preferences | 10s | Default | Patch endpoint — accepts any combination of `activeTags`, `theme`, `language` |
| `updateProfile` | PUT /user/profile | 29s | Default | Saves description + calls Gemini to extract tags |
| `health` | GET /health | 5s | Default | Public health check (no auth) |
| `onUserSignup` | Cognito Post-Confirmation | 10s | Default | Creates user profile in DynamoDB after signup |
| `getLegalTermsStatus` | GET /legal/terms-status | 5s | Default | Compares user's accepted versions with the latest active versions in `SintoniaLegal` |
| `getLegalDocument` | GET /legal/terms, GET /legal/privacy | 5s | Default | Queries `SintoniaLegal` with `ScanIndexForward: false, Limit: 1` to return the active document |
| `acceptLegalTerms` | POST /legal/accept | 5s | Default | Validates sent versions match active versions; writes `termsAcceptedVersion`, `privacyAcceptedVersion`, `termsAcceptedAt` to `SintoniaUsers` |

### Shared Modules

> **Note:** The shared module layer is organised into domain subfolders — not flat files.
> The authoritative reference for all file paths and function signatures is `backend/AGENTS.md`.

```
src/shared/
├── core/
│   ├── types/            # One file per type — import via types/index.js barrel
│   │   ├── index.ts      # Re-exports all 11 types
│   │   ├── api-error-code.ts   # ApiErrorCode (11 codes incl. POST_NOT_LIKED)
│   │   ├── tag.ts              # Tag = string  (free-form — NO allow-list)
│   │   ├── theme.ts            # Theme = 'dark' | 'light'
│   │   ├── language.ts         # Language = 'en' | 'pt-BR'
│   │   ├── post-item.ts        # PostItem (SintoniaFeed DynamoDB shape, incl. likedAt)
│   │   ├── user-record.ts      # UserRecord (SintoniaUsers DynamoDB shape)
│   │   ├── legal-document-item.ts  # LegalDocumentItem (typeLanguage PK, multi-language)
│   │   ├── request-item.ts         # RequestItem (SintoniaRequests DynamoDB shape)
│   │   ├── post-summary-with-like.ts  # Deduplication context for Gemini
│   │   ├── generation-message.ts      # SQS GenerationQueue message body
│   │   └── generated-post.ts          # Gemini post generation response
│   ├── env.ts            # ALL process.env access centralised here
│   ├── tables.ts         # Tables.FEED / .REQUESTS / .USERS / .RATE_LIMIT / .LEGAL
│   ├── default-tags.ts   # DEFAULT_TAGS (7 broad tags) + DEFAULT_DESCRIPTION
│   └── logger.ts         # createLogger(fn, ctx) — structured JSON logs (CloudWatch)
├── http/
│   ├── auth.ts           # getUserId(), getUserEmail(), AuthError
│   ├── response.ts       # ok/badRequest/notFound/tooManyRequests/serverError(code?)
│   │                     # CORS controlled via CORS_ORIGINS env var (default: '*')
│   ├── validators.ts     # Zod schemas + validate() + ValidationError
│   └── rateLimit.ts      # checkRateLimit() + RateLimitError
├── db/
│   └── index.ts          # All DynamoDB operations (see AGENTS.md §8)
├── ai/
│   └── gemini.ts         # generatePost(), extractTagsFromDescription(), GeminiError
└── queue/
    └── sqs.ts            # sendGenerationRequest() → GenerationQueue
```

**Key types (actual code):**

```typescript
// Tag is free-form string — AI extracts whatever is relevant
export type Tag = string;

// 11 machine-readable error codes (frontend maps these to translated messages)
export type ApiErrorCode =
  | 'UNAUTHENTICATED' | 'POST_NOT_FOUND' | 'POST_NOT_SAVED' | 'POST_NOT_LIKED'
  | 'LEGAL_DOCUMENT_NOT_FOUND' | 'VALIDATION_ERROR' | 'TERMS_VERSION_MISMATCH'
  | 'GENERATION_LIMIT_REACHED' | 'RATE_LIMIT_EXCEEDED' | 'AI_EXTRACTION_FAILED'
  | 'INTERNAL_ERROR';

// SintoniaLegal item — PK is typeLanguage composite key; supports multi-language docs
export interface LegalDocumentItem {
  readonly typeLanguage: string;       // PK: 'terms#en', 'privacy#pt-BR', etc.
  readonly type: 'terms' | 'privacy';
  readonly language: 'en' | 'pt-BR';
  readonly version: string;            // Same across languages per publish event
  readonly createdAt: string;          // ISO 8601 — SK
  readonly updatedAt: string;
  readonly content: string;
}

// SintoniaFeed item — likedAt is the like feedback signal for Gemini
export interface PostItem {
  readonly id: string;         // PK
  readonly userId: string;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly tags: Tag[];
  readonly gradient: [string, string];
  readonly createdAt: string;
  readonly status: 'READY';
  readonly ttl?: number;
  readonly savedAt?: string;
  readonly likedAt?: string;   // Set when liked — used by Gemini as positive signal
}
```

**CORS — env-var controlled, NOT hardcoded:**

```typescript
// response.ts reads CORS_ORIGINS from env.ts
// CORS_ORIGINS='*' (default) → wildcard header, no credentials
// CORS_ORIGINS='https://a.com,...' → echoes matching origin + credentials: true
```

**`getLatestLegalDocument` — language-aware:**

```typescript
// Queries: typeLanguage = `${type}#${language}`, ScanIndexForward: false, Limit: 1
export async function getLatestLegalDocument(
  type: 'terms' | 'privacy',
  language: 'en' | 'pt-BR' = 'en',
): Promise<LegalDocumentItem | null>
```

**`serverError` accepts optional error code:**

```typescript
export function serverError(
  event: APIGatewayProxyEvent,
  err: unknown,
  code: ApiErrorCode = 'INTERNAL_ERROR',
): APIGatewayProxyResult
// e.g.: return serverError(event, err, 'AI_EXTRACTION_FAILED');
```


### Lambda Handler Implementations

> All handlers are TypeScript (`.ts`). Each follows the same structure: extract userId from JWT, validate input with Zod, call DynamoDB/SQS/Gemini helpers, return typed response.

**`src/functions/getFeed.ts`**
```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/auth.js';
import { getFeedByUser } from '../shared/db.js';
import { ok, unauthorized, serverError } from '../shared/response.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const limit = Math.min(Number(event.queryStringParameters?.['limit'] ?? 5), 10);
    const cursor = event.queryStringParameters?.['cursor'] ?? null;
    const { items, cursor: nextCursor } = await getFeedByUser(userId, limit, cursor);
    return ok(event, { posts: items, cursor: nextCursor, hasMore: nextCursor !== null });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/requestPost.ts`** — same logic as §4 specification; sends to SQS + persists to DynamoDB; returns `202 { requestIds, status }` (no `message` field).

**`src/functions/workerInternal.ts`** — SQS trigger; fetches last 30 recent posts by active tags for deduplication context; calls `generatePost()` with context; saves post with 90-day TTL; exponential backoff 3×; marks PROCESSING → COMPLETED | FAILED.

**`src/functions/getPost.ts`** — `GET /post/:id`; verifies `post.userId === userId` before returning.

**`src/functions/savePost.ts`** — `POST /post/:id/save`; sets `savedAt`, removes `ttl`.

**`src/functions/unsavePost.ts`** — `DELETE /post/:id/save`; removes `savedAt`, restores `ttl = now + 30d`; returns `200 {}`.

**`src/functions/getSavedPosts.ts`** — `GET /posts/saved`; queries `userId-savedAt-index` GSI; cursor pagination.

**`src/functions/getPreferences.ts`** — `GET /user/preferences`; upsert fallback if profile missing; returns `theme` and `language` from user record (defaults: `'dark'`, `'en'`).

**`src/functions/updatePreferences.ts`** — `PUT /user/preferences`; patch semantics via `updateUserPreferences()`; any combination of `activeTags`, `theme`, `language`.

**`src/functions/updateProfile.ts`** — `PUT /user/profile`; calls `extractTagsFromDescription()`; updates `description` + `activeTags` in `SintoniaUsers`; returns `{ description, activeTags, updatedAt }`.

**`src/functions/health.ts`** — `GET /health`; no auth; returns `{ status: 'ok', timestamp }`.

**`src/functions/onUserSignup.ts`** — Cognito Post-Confirmation trigger; creates user record with `DEFAULT_TAGS`; errors caught and logged (never thrown — would block signup).

**`src/functions/getLegalTermsStatus.ts`**
```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/auth.js';
import { getLatestLegalDocument, getUser } from '../shared/db.js';
import { ok, unauthorized, serverError } from '../shared/response.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);

    const [termsDoc, privacyDoc, user] = await Promise.all([
      getLatestLegalDocument('terms'),
      getLatestLegalDocument('privacy'),
      getUser(userId),
    ]);

    const termsVersion = termsDoc?.version ?? '';
    const privacyVersion = privacyDoc?.version ?? '';
    const termsAccepted = user?.termsAcceptedVersion ?? '';
    const privacyAccepted = user?.privacyAcceptedVersion ?? '';

    const needsAcceptance = termsVersion !== termsAccepted || privacyVersion !== privacyAccepted;

    return ok(event, { needsAcceptance, termsVersion, privacyVersion });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/getLegalDocument.ts`**
```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/auth.js';
import { getLatestLegalDocument } from '../shared/db.js';
import { ok, unauthorized, notFound, serverError } from '../shared/response.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    getUserId(event);
    const rawType = event.pathParameters?.['type'];
    if (rawType !== 'terms' && rawType !== 'privacy') {
      return notFound(event, 'Document type must be "terms" or "privacy"', 'LEGAL_DOCUMENT_NOT_FOUND');
    }
    const doc = await getLatestLegalDocument(rawType);
    if (!doc) return notFound(event, 'No active document found', 'LEGAL_DOCUMENT_NOT_FOUND');
    return ok(event, doc);
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/acceptLegalTerms.ts`**
```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/auth.js';
import { getLatestLegalDocument, acceptUserTerms } from '../shared/db.js';
import { ok, unauthorized, badRequest, serverError } from '../shared/response.js';
import { validate, acceptLegalTermsSchema, ValidationError } from '../shared/validators.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}') as unknown;
    const { termsVersion, privacyVersion } = validate(acceptLegalTermsSchema, body);

    const [termsDoc, privacyDoc] = await Promise.all([
      getLatestLegalDocument('terms'),
      getLatestLegalDocument('privacy'),
    ]);

    if (termsDoc?.version !== termsVersion || privacyDoc?.version !== privacyVersion) {
      return badRequest(
        event,
        'Provided versions do not match current active versions. Please refresh and try again.',
        'TERMS_VERSION_MISMATCH',
      );
    }

    await acceptUserTerms(userId, termsVersion, privacyVersion);
    return ok(event, { acceptedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    if (err instanceof ValidationError) return badRequest(event, err.message);
    return serverError(event, err);
  }
};
```


---

## 5. Database — DynamoDB

### Access Patterns

| Pattern | Table / Index | Operation | Key |
|---|---|---|---|
| Fetch paginated feed for a user | `SintoniaFeed` / GSI `userId-createdAt-index` | Query | PK: userId, SK: createdAt (desc) |
| Fetch a specific post by ID | `SintoniaFeed` | GetItem | PK: id |
| Save a new generated post | `SintoniaFeed` | PutItem | PK: id |
| **Save a post (bookmark)** | `SintoniaFeed` | UpdateItem (SET savedAt, REMOVE ttl) | PK: id |
| **Unsave a post** | `SintoniaFeed` | UpdateItem (REMOVE savedAt, SET ttl) | PK: id |
| **Fetch saved posts for a user** | `SintoniaFeed` / GSI `userId-savedAt-index` | Query | PK: userId, SK: savedAt (desc) |
| Save a generation request | `SintoniaRequests` | PutItem | PK: id |
| Update request status | `SintoniaRequests` | UpdateItem | PK: id |
| Count PENDING requests for a user | `SintoniaRequests` / GSI `userId-status-index` | Query + COUNT | PK: userId, SK: status |
| Fetch user profile (upsert if missing) | `SintoniaUsers` | GetItem + conditional PutItem | PK: userId |
| Create user profile | `SintoniaUsers` | PutItem | PK: userId |
| Update user tags | `SintoniaUsers` | UpdateItem | PK: userId |
| Increment rate limit counter | `SintoniaRateLimit` | UpdateItem (atomic ADD) | PK: key |

### Tables

#### 5.1 `SintoniaFeed` — AI-Generated Posts

| Attribute | DynamoDB Type | Description |
|---|---|---|
| `id` **(PK)** | String | UUID v4 of the post — globally unique primary key |
| `userId` | String | Cognito `sub` of the post owner (attribute, not SK) |
| `title` | String | Post title (max 60 chars) |
| `summary` | String | Short summary (max 120 chars) |
| `content` | String | Full Markdown content (600+ words) |
| `tags` | List\<String\> | Content tags |
| `gradient` | List\<String\> | Array of 2 hex colors: `["#FF6B35", "#F7931E"]` |
| `createdAt` | String | ISO 8601 — used as SK in `userId-createdAt-index` GSI |
| `status` | String | `READY` — only valid value (FAILED posts are never saved) |
| `ttl` | Number | Unix timestamp — **set on creation** (`now + 90d`). **Removed** when post is saved. **Restored** (`now + 30d`) when unsaved. DynamoDB auto-deletes expired unsaved posts. |
| `savedAt` | String | ISO 8601 — **set when user saves the post**. Absent when not saved. Used as SK in `userId-savedAt-index` GSI. |

**TTL strategy:**

| Event | `ttl` value | `savedAt` |
|---|---|---|
| Post created by `workerInternal` | `now + 90 days` | absent |
| User saves post (`POST /post/{id}/save`) | **removed** | set to current ISO timestamp |
| User unsaves post (`DELETE /post/{id}/save`) | `now + 30 days` | **removed** |

**GSI `userId-createdAt-index`:**
- PK: `userId` · SK: `createdAt` · Projection: ALL
- Enables paginating the feed in descending date order

**GSI `userId-savedAt-index`** *(new)*:
- PK: `userId` · SK: `savedAt` · Projection: ALL
- Enables `GET /posts/saved` — all saved posts for a user, newest-saved-first
- Only items that have a `savedAt` attribute appear in this index

> **Design decision:** `id` is the simple PK (no Sort Key) on the main table.
> This allows direct `GetItem` by `id` for the `GET /post/:id` endpoint.
> The two GSIs handle user-scoped feed and saved queries.

#### 5.2 `SintoniaRequests` — Generation Request History & Throttle Source

| Attribute | DynamoDB Type | Description |
|---|---|---|
| `id` **(PK)** | String | UUID v4 of the request — also the `requestId` sent in the SQS message body |
| `userId` | String | Who made the request |
| `tags` | List\<String\> | Active tags at the time of the request |
| `sqsMessageId` | String | SQS `MessageId` returned by `SendMessage` — links this record to the queue message |
| `status` | String | `PENDING` → `PROCESSING` → `COMPLETED` \| `FAILED` |
| `createdAt` | String | ISO 8601 |
| `processingAt` | String | ISO 8601 (when the worker started) |
| `completedAt` | String | ISO 8601 (when completed) |
| `failedAt` | String | ISO 8601 (on failure) |
| `postId` | String | ID of the generated post (after COMPLETED) |
| `errorMessage` | String | Error message (after FAILED) |
| `ttl` | Number | Unix timestamp — DynamoDB auto-deletes the item after expiry |

**TTL strategy per status:**

| Status | TTL | Rationale |
|---|---|---|
| `PENDING` | `now + 3 days` | Safety net for messages that were never consumed |
| `PROCESSING` | Overwritten by worker | Worker sets COMPLETED or FAILED TTL |
| `COMPLETED` | `now + 30 days` | Short-term audit trail |
| `FAILED` | `now + 7 days` | Enough time for debugging |

> **DynamoDB Stream: disabled.** SQS is now the trigger mechanism. DynamoDB is used solely
> for request history, status tracking, and the per-user throttle check.

**GSI `userId-status-index`:** (kept — still needed for `countPendingRequests`)
- PK: `userId`
- SK: `status`
- Projection: KEYS_ONLY
- Allows counting PENDING requests per user (generation throttle)

#### 5.3 `SintoniaUsers` — User Profile and Preferences

| Attribute | DynamoDB Type | Description |
|---|---|---|
| `userId` **(PK)** | String | Cognito `sub` — created by the post-confirmation trigger |
| `email` | String | User's email address |
| `description` | String | Free-text profile description — used by AI for tag extraction and content generation |
| `activeTags` | List\<String\> | Tags extracted from description, filtered by user enable/disable |
| `theme` | String | `"dark"` \| `"light"` — user's preferred visual theme. Defaults to `"dark"`. Synced from `PUT /user/preferences` when the user changes theme in Settings. |
| `language` | String | `"en"` \| `"pt-BR"` — user's preferred UI language. Defaults to `"en"`. Synced from `PUT /user/preferences` when the user changes language in Settings. |
| `termsAcceptedVersion` | String | Version string of the Terms of Use the user last accepted (e.g. `"1.1"`). Absent until the user completes first acceptance. |
| `privacyAcceptedVersion` | String | Version string of the Privacy Policy last accepted. |
| `termsAcceptedAt` | String | ISO 8601 — timestamp of the last terms acceptance via `POST /legal/accept`. |
| `createdAt` | String | ISO 8601 |
| `lastActiveAt` | String | ISO 8601 — updated on every PUT /user/profile or PUT /user/preferences |

> **Note on seen posts:** Tracking seen post IDs is **not** implemented as a List in DynamoDB
> (which would grow unboundedly). In Phase 4, this will be implemented via TTL in a
> separate `SintoniaSeenPosts` table with PK: `userId`, SK: `postId` and a 90-day TTL.

#### 5.4 `SintoniaRateLimit` — Fixed-Window Rate Limiting Counters

| Attribute | DynamoDB Type | Description |
|---|---|---|
| `key` **(PK)** | String | Composite key: `{type}#{identifier}#{bucket}` where `bucket = floor(unixTimestamp / windowSeconds)` |
| `count` | Number | Atomic counter — number of requests in the current window |
| `ttl` | Number | Unix timestamp — DynamoDB auto-deletes the item after the window expires |

**Key format examples:**

| Key | Limit | Window | Applied in |
|---|---|---|---|
| `AI_GENERATION#{userId}#{bucket}` | 10 requests | 1 hour | `requestPost.ts` |
| `API_REQUEST#{userId}#{bucket}` | 100 requests | 15 min | `requestPost.ts` |

> **Design:** The time bucket is embedded in the key (`floor(now / windowSeconds)`), so each
> time window is a separate item. No GSI needed — rate checks are always direct `GetItem`/`UpdateItem`
> by the full composite key. TTL ensures automatic cleanup with zero cost.

> **No GSI, no Scan** — the fixed-window strategy is a pure `UpdateItem` with atomic `ADD`.
> A single DynamoDB write handles both the increment and the 429 check in one round-trip.

#### 5.5 `SintoniaLegal` — Legal Documents (Terms of Use & Privacy Policy)

| Attribute | DynamoDB Type | Description |
|---|---|---|
| `typeLanguage` **(PK)** | String | Composite key: `"{type}#{language}"` e.g. `"terms#en"`, `"privacy#pt-BR"` |
| `createdAt` **(SK)** | String | ISO 8601 — creation timestamp. `ScanIndexForward: false, Limit: 1` returns the current active version per language. |
| `type` | String | `"terms"` or `"privacy"` — non-key attribute stored for display |
| `language` | String | `"en"` or `"pt-BR"` — document language |
| `version` | String | Human-readable version label (e.g. `"1.0"`, `"1.1"`). Same across all languages per publish event. |
| `content` | String | Full document content in Markdown in the given language. |
| `updatedAt` | String | ISO 8601 — date shown to the user in `LegalDocModal`. |

**Publishing new terms:** Insert 4 new items (one per type+language combination) with `createdAt = now()` and incremented `version`. No need to update or delete previous rows — they remain as audit history. `getLatestLegalDocument(type, language)` always returns the most recent.

**`getLegalTermsStatus` logic:**
1. Query `SintoniaLegal` for latest `terms` (using `'en'` as canonical version source) → get `version`
2. Query `SintoniaLegal` for latest `privacy` (using `'en'`) → get `version`
3. GetItem from `SintoniaUsers` → read `termsAcceptedVersion` and `privacyAcceptedVersion`
4. `needsAcceptance = (termsVersion !== '' && privacyVersion !== '') && (termsLatest !== termsAccepted || privacyLatest !== privacyAccepted)`

**`getLegalDocument` language fallback:**
- `GET /legal/{type}?lang={en|pt-BR}` — query param selects language (default: `'en'`)
- If the requested language returns `null`, automatically falls back to `'en'`

### Billing Mode

All tables use **`PAY_PER_REQUEST`** — no provisioned capacity, zero cost when idle, automatic scaling on peak load.

---

## 6. Authentication — AWS Cognito

### Complete Authentication Flow

```
[1. SIGNUP]
User fills in email + password
        │
        ▼
Amplify SDK → Cognito User Pool (signUp)
        │
        ▼
Cognito sends a verification email with a 6-digit code
        │
        ▼
User confirms the code (confirmSignUp)
        │
        ▼
Cognito fires Lambda Trigger: PostConfirmation
        │
        ▼
[Lambda: onUserSignup] → PutItem in SintoniaUsers
  { userId, email, activeTags: DEFAULT_TAGS, createdAt }
  → User is redirected to /onboarding to write their description
    and have AI extract their real areas of interest

──────────────────────────────────────────────────────

[2. LOGIN]
User submits email + password
        │
        ▼
Amplify SDK → Cognito (signIn with SRP or USER_PASSWORD_AUTH)
        │
        ▼
Cognito returns 3 tokens:
  ├── idToken     (JWT — contains claims: sub, email, etc.) — validity: 1h
  ├── accessToken (JWT — for Cognito operations)            — validity: 1h
  └── refreshToken (opaque — renews the others)             — validity: 30 days

──────────────────────────────────────────────────────

[3. AUTHENTICATED REQUEST]
Frontend includes: Authorization: Bearer <idToken>
        │
        ▼
API Gateway → Cognito Authorizer
  Validates RS256 JWT signature using Cognito JWKS
  (https://cognito-idp.<region>.amazonaws.com/<userPoolId>/.well-known/jwks.json)
        │
        ▼
API Gateway injects claims into Lambda context:
  event.requestContext.authorizer.claims = {
    sub: "user-uuid",
    email: "user@example.com",
    exp: 1751234567,
    ...
  }
        │
        ▼
Lambda extracts userId = claims.sub
```

### Cognito User Pool Configuration

```yaml
UserPool:
  UserPoolName: syntonia-users-{stage}
  UsernameAttributes: [email]
  AutoVerifiedAttributes: [email]
  EmailVerificationMessage: "Your Syntonia verification code: {####}"
  EmailVerificationSubject: "Confirm your email — Syntonia"
  Policies:
    PasswordPolicy:
      MinimumLength: 8
      RequireUppercase: false
      RequireNumbers: true
      RequireSymbols: false
  LambdaConfig:
    PostConfirmation: !GetAtt OnUserSignupLambdaFunction.Arn

UserPoolClient:
  ClientName: syntonia-web-client
  GenerateSecret: false    # SPA does not use client secret
  ExplicitAuthFlows:
    - ALLOW_USER_SRP_AUTH          # standard secure flow
    - ALLOW_USER_PASSWORD_AUTH     # simplified for development
    - ALLOW_REFRESH_TOKEN_AUTH
  IdTokenValidity: 1
  AccessTokenValidity: 1
  RefreshTokenValidity: 30
  TokenValidityUnits:
    IdToken: hours
    AccessToken: hours
    RefreshToken: days
  PreventUserExistenceErrors: ENABLED  # does not reveal if email exists
```

### Automatic Token Refresh via Amplify SDK

The `aws-amplify v6` manages the token lifecycle automatically:
- When the `idToken` expires (1h), it uses the `refreshToken` to obtain a new pair
- The `fetchAuthSession()` called in `api.ts` always returns a valid token
- No custom refresh code is required

---

## 7. AI Layer — Gemini API

### Model and Configuration

| Aspect | Value |
|---|---|
| **Primary model** | `gemini-1.5-flash` |
| **Fallback model** | `gemini-1.5-pro` |
| **Max output tokens** | ~2048 (sufficient for 600+ word posts) |
| **Temperature** | default (0.9) — creativity without losing coherence |
| **Lambda timeout** | 60s (sufficient for Gemini response) |
| **Retries** | 3x with exponential backoff (1s, 2s, 4s) |

### Prompt Strategy

The prompt enforces **mandatory structured JSON output**. This is more reliable than
trying to parse free text. The `parseGeminiResponse` validates the structure before
any write to the database.

### Generation Pipeline

```
requestPost Lambda
    │ 1. Fetches user.description from DynamoDB
    │ 2. sendGenerationRequest(SQS) → returns sqsMessageId
    │    MessageBody: { requestId, userId, tags, description }
    │ 3. PutItem SintoniaRequests { id: requestId, sqsMessageId, status: PENDING }
    ▼
SQS: GenerationQueue
    │ trigger (batchSize: 1, functionResponseType: ReportBatchItemFailures)
    ▼
workerInternal Lambda
    │
    ├── [1] JSON.parse(record.body) → { requestId, userId, tags, description }
    │
    ├── [2] UpdateItem: SintoniaRequests[requestId] → status: PROCESSING
    │
    ├── [3] callGemini(PRIMARY_MODEL, buildPrompt(tags, description))
    │         │
    │         ├── success → parseGeminiResponse(raw)
    │         │
    │         └── failure → callGemini(FALLBACK_MODEL, ...)
    │
    ├── [4] PutItem: SintoniaFeed { id, userId, title, summary, content, ... }
    │
    ├── [5] UpdateItem: SintoniaRequests[requestId] → status: COMPLETED, postId
    │
    └── success → Lambda returns → SQS auto-deletes the message
                  failure (after 3x) → SQS routes to GenerationDLQ
```

### AI Cost Control

| Metric | Value |
|---|---|
| Input tokens per request | ~400 tokens (prompt) |
| Output tokens per post | ~1,200 tokens (600 words + code) |
| gemini-1.5-flash price (output) | $0.00015 / 1K tokens |
| **Cost per generated post** | **~$0.00018** (~1/5 of a cent) |
| 1,000 posts/month | ~$0.18 |
| 100,000 posts/month | ~$18.00 |

---

## 8. API Contract (REST)

**Production Base URL:** `https://api.syntonia.app/prod`
**Staging Base URL:** `https://api.syntonia.app/dev`

All routes marked with `[AUTH]` require:
```
Authorization: Bearer <Cognito idToken>
```

---

### `GET /health`

Public endpoint for health checks and external monitoring.

**Response 200:**
```json
{ "status": "ok", "timestamp": "2026-07-02T10:00:00Z" }
```

---

### `GET /feed` [AUTH]

Returns the next posts in the user's feed, ordered from most recent to oldest.

**Query params:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 5 | Number of posts. Min: 1, Max: 10 |
| `cursor` | string | null | Pagination token (base64) returned by the previous response |

**Response 200:**
```json
{
  "posts": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "AWS Lambda Cold Start: Real-World Strategies",
      "summary": "How to eliminate cold starts in Node.js functions with Provisioned Concurrency and SnapStart.",
      "tags": ["AWS", "Lambda", "Performance"],
      "gradient": ["#FF6B35", "#F7931E"],
      "createdAt": "2026-07-02T10:00:00Z"
    }
  ],
  "cursor": "eyJpZCI6Inh4eCIsInVzZXJJZCI6Inl5eSJ9",
  "hasMore": true
}
```

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Token missing, expired, or invalid |
| `500 Internal Server Error` | DynamoDB connection error |

---

### `GET /post/:id` [AUTH]

Returns the full content (Markdown) of a specific post. Users can only access their own posts.

**Path params:**
- `id` — UUID of the post

**Response 200:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "AWS Lambda Cold Start: Real-World Strategies",
  "summary": "How to eliminate cold starts in Node.js functions...",
  "content": "## The Cold Start Problem\n\nWhen a Lambda function...\n\n```javascript\n// example code\n```",
  "tags": ["AWS", "Lambda", "Performance"],
  "gradient": ["#FF6B35", "#F7931E"],
  "createdAt": "2026-07-02T10:00:00Z"
}
```

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Invalid token |
| `404 Not Found` | Post does not exist or belongs to another user |
| `500 Internal Server Error` | DynamoDB connection error |

---

### `POST /feed/request` [AUTH]

Requests AI generation of new posts. The frontend calls this endpoint when
the post buffer is about to run out (JIT logic).

**Request body:**
```json
{
  "tags": ["AWS", "React", "TypeScript"],
  "quantity": 3
}
```

**Validations:**
- `tags`: non-empty array, max 20 items
- `quantity`: integer from 1 to 5

**Response 202:**
```json
{
  "requestIds": [
    "req-uuid-1",
    "req-uuid-2",
    "req-uuid-3"
  ],
  "status": "PENDING"
}
```

**Possible errors:**

| Status | When |
|---|---|
| `400 Bad Request` | Empty `tags`, `quantity` out of range, or malformed body |
| `401 Unauthorized` | Invalid token |
| `429 Too Many Requests` | User already has 5 or more pending generations |
| `500 Internal Server Error` | Failed to insert into queue |

---

### `GET /user/preferences` [AUTH]

Returns the user's profile including description, active tags, and persisted UI preferences (theme and language). If the profile does not exist, it is created automatically with defaults. The frontend uses this response to sync all Zustand stores on login.

**Response 200:**
```json
{
  "userId": "cognito-sub-uuid",
  "description": "Backend developer focused on AWS and distributed systems.",
  "activeTags": ["AWS", "distributed systems", "Kubernetes"],
  "theme": "dark",
  "language": "en"
}
```

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Invalid token |
| `500 Internal Server Error` | DynamoDB failure |

---

### `PUT /user/profile` [AUTH]

Saves the user's free-text description and synchronously calls Gemini to extract relevant tags from it. Every description update regenerates the full tag list. Returns the extracted tags so the frontend can display them immediately for the user to review.

**Request body:**
```json
{
  "description": "Backend developer focused on AWS Lambda and Node.js, learning about distributed systems, Kubernetes, and cloud cost optimization."
}
```

**Validations:**
- `description`: string, min 20 chars, max 500 chars

**Response 200:**
```json
{
  "description": "Backend developer focused on AWS Lambda and Node.js...",
  "activeTags": ["AWS", "Node.js", "Kubernetes", "Serverless", "Performance", "Architecture"],
  "updatedAt": "2026-07-02T10:00:00Z"
}
```

**Possible errors:**

| Status | When |
|---|---|
| `400 Bad Request` | Description too short/long or missing |
| `401 Unauthorized` | Invalid token |
| `500 Internal Server Error` | DynamoDB failure or Gemini API error |

---

### `PUT /user/preferences` [AUTH]

Patch endpoint — updates any combination of `activeTags`, `theme`, and `language`. Only provided fields are written; omitted fields are left unchanged. Called from:
- `TagManager` component (activeTags only)
- `SettingsPanel` component (theme only, or language only)

**Request body** (all fields optional — at least one required):
```json
{ "activeTags": ["AWS", "TypeScript"] }
{ "theme": "light" }
{ "language": "pt-BR" }
{ "activeTags": ["AWS"], "theme": "dark", "language": "en" }
```

**Validations:**
- `activeTags`: if provided, min 1 tag, max 20
- `theme`: `"dark"` or `"light"`
- `language`: `"en"` or `"pt-BR"`

**Response 200:** `{}`

**Possible errors:**

| Status | When |
|---|---|
| `400 Bad Request` | Empty tags array or invalid body |
| `401 Unauthorized` | Invalid token |
| `500 Internal Server Error` | DynamoDB failure |

---

### `POST /post/:id/save` [AUTH]

Saves a post — sets `savedAt` to now and removes the `ttl` attribute so the post persists indefinitely.

**Response 200:**
```json
{ "savedAt": "2026-07-02T10:00:00Z" }
```

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Invalid token |
| `404 Not Found` | Post does not exist or belongs to another user |
| `500 Internal Server Error` | DynamoDB failure |

---

### `DELETE /post/:id/save` [AUTH]

Unsaves a post — removes `savedAt` and restores `ttl = now + 30 days`.

**Response 200:** `{}`

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Invalid token |
| `404 Not Found` | Post does not exist or belongs to another user (`POST_NOT_SAVED`) |
| `500 Internal Server Error` | DynamoDB failure |

---

### `POST /post/:id/like` [AUTH]

Likes a post — sets `likedAt` on the post item. This is used as a positive feedback signal by the Gemini prompt during content generation.

**Response 200:**
```json
{ "likedAt": "2026-07-02T10:00:00Z" }
```

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Invalid token |
| `404 Not Found` | Post does not exist or belongs to another user |
| `500 Internal Server Error` | DynamoDB failure |

---

### `DELETE /post/:id/like` [AUTH]

Removes the like from a post — clears `likedAt`.

**Response 200:** `{}`

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Invalid token |
| `404 Not Found` | Post has not been liked by this user (`POST_NOT_LIKED`) |
| `500 Internal Server Error` | DynamoDB failure |

---

### `GET /posts/saved` [AUTH]

Returns all saved posts for the authenticated user, ordered by `savedAt` descending (newest saved first).

**Query params:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 20 | Posts per page. Max: 50 |
| `cursor` | string | null | Pagination cursor from previous response |

**Response 200:**
```json
{
  "posts": [
    {
      "id": "uuid",
      "title": "AWS Lambda Cold Start: Real-World Strategies",
      "summary": "...",
      "tags": ["AWS", "Lambda", "Performance"],
      "gradient": ["#FF6B35", "#F7931E"],
      "createdAt": "2026-07-02T10:00:00Z",
      "savedAt": "2026-07-02T14:30:00Z"
    }
  ],
  "cursor": "base64encodedKey==",
  "hasMore": false
}
```

**Possible errors:**

| Status | When |
|---|---|
| `401 Unauthorized` | Invalid token |
| `500 Internal Server Error` | DynamoDB failure |

---

### `GET /legal/terms-status` [AUTH]

Called on every authenticated session start. Determines whether the user must accept updated Terms of Use or Privacy Policy before continuing.

**Response 200:**
```json
{
  "needsAcceptance": true,
  "termsVersion": "1.1",
  "privacyVersion": "1.0"
}
```

`needsAcceptance: false` when both accepted versions in `SintoniaUsers` match the latest active versions in `SintoniaLegal`.

**Possible errors:**

| Status | Code | When |
|---|---|---|
| `401 Unauthorized` | `UNAUTHENTICATED` | Invalid token |
| `500 Internal Server Error` | `INTERNAL_ERROR` | DynamoDB failure |

---

### `GET /legal/terms` [AUTH]

> **Replaced by `GET /legal/{type}?lang=`** — see below. Both `/legal/terms` and `/legal/privacy` are handled by the same `getLegalDocument` Lambda via path parameter `{type}`.

### `GET /legal/{type}?lang={en|pt-BR}` [AUTH]

Returns the current active document (Terms of Use or Privacy Policy) as Markdown in the requested language. Called by `TermsAcceptanceModal` and `LegalDocModal`.

**Path params:**
- `type` — `"terms"` or `"privacy"`

**Query params:**
- `lang` — `"en"` (default) or `"pt-BR"`. Falls back to `"en"` if the requested language is not available.

**Response 200:**
```json
{
  "typeLanguage": "terms#en",
  "type": "terms",
  "language": "en",
  "version": "1.0",
  "createdAt": "2026-07-05T00:00:00Z",
  "updatedAt": "2026-07-05T00:00:00Z",
  "content": "# Terms of Use\n\n..."
}
```

**Possible errors:**

| Status | Code | When |
|---|---|---|
| `401 Unauthorized` | `UNAUTHENTICATED` | Invalid token |
| `404 Not Found` | `LEGAL_DOCUMENT_NOT_FOUND` | No document found for this type |
| `500 Internal Server Error` | `INTERNAL_ERROR` | DynamoDB failure |

---

### `GET /legal/privacy` [AUTH]

> Same contract as `GET /legal/{type}?lang=` with `type = "privacy"`.

---

### `POST /legal/accept` [AUTH]

Records the user's acceptance of a specific pair of document versions. After success, `GET /legal/terms-status` returns `needsAcceptance: false` for this user.

**Request body:**
```json
{
  "termsVersion": "1.1",
  "privacyVersion": "1.0"
}
```

**Validations:**
- Both fields required
- Versions must match the currently active versions in `SintoniaLegal` — rejects stale versions to prevent accepting an outdated document

**Response 200:**
```json
{ "acceptedAt": "2026-07-03T12:00:00Z" }
```

**Possible errors:**

| Status | Code | When |
|---|---|---|
| `400 Bad Request` | `TERMS_VERSION_MISMATCH` | Sent versions differ from current active versions |
| `400 Bad Request` | `VALIDATION_ERROR` | Missing fields or malformed body |
| `401 Unauthorized` | `UNAUTHENTICATED` | Invalid token |
| `500 Internal Server Error` | `INTERNAL_ERROR` | DynamoDB failure |

---

### Error Response Format

All non-2xx responses follow a standard format. The `code` is a machine-readable identifier the frontend maps to a translated message via `t.errors[code]`. The `message` is in English and intended for debugging only — never displayed to users.

```json
{
  "code": "POST_NOT_FOUND",
  "error": "Not Found",
  "message": "The requested post does not exist or belongs to another user."
}
```

### Error Code Catalog

| Code | HTTP Status | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Token absent, expired, or invalid |
| `POST_NOT_FOUND` | 404 | Post does not exist or belongs to another user |
| `POST_NOT_SAVED` | 404 | Attempting to unsave a post that is not saved |
| `POST_NOT_LIKED` | 404 | Attempting to unlike a post that has not been liked |
| `LEGAL_DOCUMENT_NOT_FOUND` | 404 | No active document found for the requested type |
| `VALIDATION_ERROR` | 400 | Malformed body or invalid field values |
| `TERMS_VERSION_MISMATCH` | 400 | Sent versions don't match current active versions |
| `GENERATION_LIMIT_REACHED` | 429 | User already has 5 or more pending generations |
| `RATE_LIMIT_EXCEEDED` | 429 | General API rate limit exceeded |
| `AI_EXTRACTION_FAILED` | 500 | Gemini failed to extract tags from the description |
| `INTERNAL_ERROR` | 500 | Uncategorised internal error |

---

## 9. Data Models

### TypeScript (frontend)

```typescript
// src/types/domain.ts

/** Free-form string tag — AI extracts any value; no predefined allow-list. */
export type Tag = string;

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'pt-BR';

export interface Post {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly summary: string;
  readonly content?: string;        // Only present after GET /post/:id
  readonly tags: Tag[];
  readonly gradient: readonly [string, string];
  readonly createdAt: string;       // ISO 8601
  readonly savedAt?: string;        // ISO 8601 — present when saved by the user
  readonly likedAt?: string;        // ISO 8601 — present when liked; used as AI feedback signal
}

export interface UserPreferences {
  readonly userId: string;
  readonly description: string | null;
  readonly activeTags: Tag[];
  readonly theme: Theme;
  readonly language: Language;
}

export interface FeedResponse {
  readonly posts: Post[];
  readonly cursor: string | null;
  readonly hasMore: boolean;
}

export interface GenerationResponse {
  readonly requestIds: string[];
  readonly status: 'PENDING';
  // No 'message' field — clean contract
}

export interface LegalDocument {
  readonly typeLanguage: string;       // e.g. 'terms#en', 'privacy#pt-BR'
  readonly type: 'terms' | 'privacy';
  readonly language: 'en' | 'pt-BR';
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly content: string;
}

export type ApiErrorCode =
  | 'UNAUTHENTICATED' | 'POST_NOT_FOUND' | 'POST_NOT_SAVED' | 'POST_NOT_LIKED'
  | 'LEGAL_DOCUMENT_NOT_FOUND' | 'VALIDATION_ERROR' | 'TERMS_VERSION_MISMATCH'
  | 'GENERATION_LIMIT_REACHED' | 'RATE_LIMIT_EXCEEDED' | 'AI_EXTRACTION_FAILED'
  | 'INTERNAL_ERROR' | 'UNKNOWN_ERROR';  // UNKNOWN_ERROR is frontend-only fallback
```

### DynamoDB Item Shapes (JavaScript / backend)

```javascript
// SintoniaFeed item
{
  id: "a1b2c3d4-...",           // String — PK
  userId: "cognito-sub",        // String
  title: "...",                 // String
  summary: "...",               // String
  content: "## ...",            // String (Markdown)
  tags: ["AWS", "Lambda"],      // List<String>
  gradient: ["#FF6B35", "#F7931E"], // List<String>
  createdAt: "2026-07-02T10:00:00Z", // String ISO 8601
  status: "READY",              // String
  ttl: 1759978000,              // Number — set on creation (now+90d), removed when saved
  savedAt: "2026-07-05T...",    // String ISO 8601 — OPTIONAL, present only when saved
}

// SintoniaRequests item
{
  id: "req-uuid",               // String — PK, also sent as requestId in SQS body
  userId: "cognito-sub",
  tags: ["AWS", "Lambda"],
  sqsMessageId: "sqs-abc-123",  // MessageId returned by SQS SendMessage — links both systems
  status: "PENDING",            // PENDING | PROCESSING | COMPLETED | FAILED
  createdAt: "...",
  processingAt: "...",          // optional
  completedAt: "...",           // optional
  failedAt: "...",              // optional
  postId: "...",                // optional — after COMPLETED
  errorMessage: "...",          // optional — after FAILED
  ttl: 1751493600,              // Unix timestamp — DynamoDB auto-delete (3d/30d/7d by status)
}

// SintoniaUsers item
{
  userId: "cognito-sub",        // String — PK
  email: "user@example.com",    // String
  description: "Backend developer focused on AWS...", // String — free-text profile
  activeTags: ["AWS", "Node.js", "Kubernetes"], // List<String> — AI-extracted + user-enabled
  createdAt: "...",
  lastActiveAt: "...",
}

// SintoniaRateLimit item
{
  key: "AI_GENERATION#cognito-sub#482",  // String — PK
  //    └─ type ──┘└─── userId ────┘└─bucket─┘
  //    bucket = floor(unixTimestamp / windowSeconds)
  count: 3,              // Number — atomically incremented
  ttl: 1751234567,       // Number — Unix timestamp for DynamoDB auto-delete
}
```

---

## 10. Content Generation Flow (Just-in-Time)

### Complete Diagram

```
[React Frontend]
      │
      │ useJIT detects: totalPosts - currentIndex <= 2
      │
      ▼
POST /feed/request
  Body: { tags: [...activeTags], quantity: 3 }
  Header: Authorization: Bearer <JWT>
      │
      ▼
[API Gateway]
  Validates JWT → injects claims into event
      │
      ▼
[Lambda: requestPost]
  1. Extracts userId from JWT
  2. Validates body with Zod
  3. Counts user's PENDING requests in DynamoDB
     └── If >= 5 → returns 429
  4. For each of the N requested posts (in parallel):
     a. getUser(userId) → fetches description from DynamoDB
     b. sendGenerationRequest(SQS) → receives sqsMessageId
        MessageBody: { requestId, userId, tags, description }
     c. PutItem SintoniaRequests:
        { id: requestId, sqsMessageId, userId, tags, status: 'PENDING', ttl }
  5. Returns 202 immediately
      │
      ├─────────────────────────────────────────────┐
      ▼ (async — SQS trigger)                       ▼
[SQS: GenerationQueue]                 [DynamoDB: SintoniaRequests]
  batchSize: 1                          (history + throttle source)
  VisibilityTimeout: 120s
  maxReceiveCount: 3 → DLQ
      │
      ▼ (one invocation per message)
[Lambda: workerInternal] (reservedConcurrency: 5)
  1. JSON.parse(record.body) → { requestId, userId, tags, description }
  2. UpdateItem SintoniaRequests[requestId] → status: PROCESSING
  3. getRecentPostsByTags(userId, tags, 30) → recentPosts  ← deduplication context
  4. Tries callGemini(PRIMARY_MODEL, buildPostPrompt(tags, description, recentPosts))
     └── fails? → callGemini(FALLBACK_MODEL, ...)
     └── fails again? → in-process retry with backoff (max 3x)
     └── definitive failure?
           → UpdateItem: status → FAILED
           → throw err → SQS makes message visible → retries
           → after 3 SQS deliveries → routes to GenerationDLQ
  5. parseGeminiResponse(raw) — validates JSON + required fields
  6. PutItem SintoniaFeed:
     { id (new UUID), userId, title, summary, content, tags, gradient,
       createdAt, status: 'READY',
       ttl: now + 90 days }   ← auto-deleted unless user saves the post
  7. UpdateItem SintoniaRequests[requestId]:
     { status: 'COMPLETED', completedAt, postId }
  8. Lambda returns without error → SQS auto-deletes the message
      │
      ▼
[SintoniaFeed — new posts available]
      │
      ▼
[Next GET /feed?cursor=... returns the new posts]
      │
      ▼
[useFeed.ts appends posts to feedStore]
      │
      ▼
[FeedContainer renders new cards — continuous feed]
```

### Error Handling

```
workerInternal — failure arbiter
      │
      ├─► Gemini returns invalid JSON?
      │       └─► Tries fallback model
      │       └─► Definitive failure → status: FAILED → throw → SQS retry
      │
      ├─► Gemini / DynamoDB timeout?
      │       └─► In-process retry with backoff (1s, 2s, 4s)
      │       └─► CloudWatch Alarm: WorkerErrors >= 1
      │
      ├─► Lambda throws (any unhandled error)?
      │       └─► SQS makes message visible after VisibilityTimeout (120s)
      │       └─► Up to 3 SQS-level deliveries total
      │       └─► After 3rd failure → GenerationDLQ (14-day retention)
      │
      └─► Status is already PROCESSING (duplicate SQS delivery on timeout)?
              └─► UpdateItem is idempotent — safely overwrites PROCESSING with PROCESSING
```

---

## 11. Feed Navigation UX Model

### In-Memory State (feedStore)

```
feedStore.posts = [ P1, P2, P3, P4, P5 ]
                             ▲
                  currentIndex = 2 (P3 visible)

  postsRemaining = 5 - 2 = 3  → still fine, no JIT trigger

User scrolls to P4:
  currentIndex = 3
  postsRemaining = 5 - 3 = 2  → TRIGGER: POST /feed/request

API returns P6, P7, P8:
  feedStore.posts = [ P1, P2, P3, P4, P5, P6, P7, P8 ]
                                              ▲
                                   new posts appended

  Feed is continuous — no page reload, no content flash
```

### Snap Scroll (CSS + Framer Motion)

```css
/* FeedContainer — vertical scroll with snap */
.feed-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
}

/* Each card occupies 100vh and "locks" on scroll */
.feed-card {
  height: 100vh;
  scroll-snap-align: start;
  scroll-snap-stop: always; /* forces a stop at each card */
}
```

### X-Axis — Card to Detail Transition

```
Initial state:
  PostCard (100% visible) + PostDetail (off-screen, translateX: 100%)

User drags left (drag > 80px):
  motion.div detects onDragEnd with offset.x < -80
  setExpanded(true)

AnimatePresence renders PostDetail:
  initial: { x: '100%' }    ← enters from the right
  animate: { x: 0 }         ← slides to final position
  transition: spring        ← smooth physics-based animation

User clicks "← back":
  setExpanded(false)
  exit: { x: '100%' }       ← exits to the right
```

---

## 12. Infrastructure as Code

### `backend/serverless.yml` — Complete and annotated

```yaml
service: syntonia-backend

frameworkVersion: '4'

plugins:
  - serverless-esbuild      # TypeScript compilation + bundling (MUST be first)
  - serverless-offline      # Local simulation (npm run dev)

custom:
  esbuild:
    bundle: true
    minify: false
    sourcemap: true
    target: node22
    platform: node
    format: cjs              # CommonJS — most compatible with Lambda Node.js runtime
    external:
      - '@aws-sdk/*'         # Pre-installed on Lambda runtime; do NOT bundle
    packager: npm

  serverless-offline:
    httpPort: 3000
    lambdaPort: 3002

provider:
  name: aws
  runtime: nodejs22.x
  region: sa-east-1          # São Paulo — lowest latency for Brazilian users
  stage: ${opt:stage, 'dev'} # Default: dev. Production: --stage prod

  # Environment variables available to ALL Lambda functions
  environment:
    STAGE: ${self:provider.stage}
    AWS_REGION: sa-east-1
    FEED_TABLE: SintoniaFeed-${self:provider.stage}
    REQUESTS_TABLE: SintoniaRequests-${self:provider.stage}
    USERS_TABLE: SintoniaUsers-${self:provider.stage}
    RATE_LIMIT_TABLE: SintoniaRateLimit-${self:provider.stage}
    LEGAL_TABLE: SintoniaLegal-${self:provider.stage}
    GENERATION_QUEUE_URL: !Ref GenerationQueue
    # Secret read from SSM Parameter Store at deploy time
    GEMINI_API_KEY: ${ssm:/syntonia/${self:provider.stage}/gemini-api-key}
    # LOG_LEVEL: DEBUG | INFO | WARN | ERROR (default: INFO)
    LOG_LEVEL: INFO
    # CORS: '*' by default (no credentials). Restrict in production:
    # CORS_ORIGINS: 'https://syntonia.app,https://dev.syntonia.app'
    CORS_ORIGINS: ${env:CORS_ORIGINS, '*'}

  # IAM: no shared role — each Lambda uses its own least-privilege role
  # (defined in resources: section below, referenced via role: on each function)

  # API Gateway global throttling
  apiGateway:
    throttle:
      burstLimit: 1000
      rateLimit: 500

  # Log retention: 14 days
  logRetentionInDays: 14

functions:

  # ── API Handlers ───────────────────────────────────────────────────

  getFeed:
    handler: src/functions/getFeed.handler
    role: !GetAtt GetFeedLambdaRole.Arn
    timeout: 10
    description: "Returns paginated posts from the user's feed"
    events:
      - http:
          path: feed
          method: get
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  requestPost:
    handler: src/functions/requestPost.handler
    role: !GetAtt RequestPostLambdaRole.Arn
    timeout: 10
    description: "Queues a content generation request (JIT trigger)"
    events:
      - http:
          path: feed/request
          method: post
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  getPost:
    handler: src/functions/getPost.handler
    role: !GetAtt GetPostLambdaRole.Arn
    timeout: 10
    description: "Returns full post by ID (lazy load of Markdown)"
    events:
      - http:
          path: post/{id}
          method: get
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  getPreferences:
    handler: src/functions/getPreferences.handler
    role: !GetAtt GetPreferencesLambdaRole.Arn
    timeout: 10
    description: "Returns active tags and user profile"
    events:
      - http:
          path: user/preferences
          method: get
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  updatePreferences:
    handler: src/functions/updatePreferences.handler
    role: !GetAtt UpdatePreferencesLambdaRole.Arn
    timeout: 10
    description: "Enables/disables individual tags from the user's AI-extracted tag set"
    events:
      - http:
          path: user/preferences
          method: put
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  updateProfile:
    handler: src/functions/updateProfile.handler
    role: !GetAtt UpdateProfileLambdaRole.Arn
    timeout: 29                  # API Gateway REST has a hard 29s max integration timeout
    description: "Saves user description + calls Gemini to extract active tags"
    events:
      - http:
          path: user/profile
          method: put
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  health:
    handler: src/functions/health.handler
    role: !GetAtt HealthLambdaRole.Arn
    timeout: 5
    description: "Public health check endpoint"
    events:
      - http:
          path: health
          method: get
          cors: true

  savePost:
    handler: src/functions/savePost.handler
    role: !GetAtt SavePostLambdaRole.Arn
    timeout: 10
    description: "Saves a post — sets savedAt, removes TTL so post persists indefinitely"
    events:
      - http:
          path: post/{id}/save
          method: post
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  unsavePost:
    handler: src/functions/unsavePost.handler
    role: !GetAtt UnsavePostLambdaRole.Arn
    timeout: 10
    description: "Unsaves a post — removes savedAt, restores TTL to now + 30 days"
    events:
      - http:
          path: post/{id}/save
          method: delete
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  getSavedPosts:
    handler: src/functions/getSavedPosts.handler
    role: !GetAtt GetSavedPostsLambdaRole.Arn
    timeout: 10
    description: "Returns the authenticated user's saved posts via userId-savedAt-index GSI"
    events:
      - http:
          path: posts/saved
          method: get
          cors:
            origin: 'https://syntonia.app,https://dev.syntonia.app,http://localhost:5173'
            headers: ['Content-Type', 'Authorization']
            allowCredentials: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  # ── Async Worker ───────────────────────────────────────────────────

  workerInternal:
    handler: src/functions/workerInternal.handler
    role: !GetAtt WorkerInternalLambdaRole.Arn
    timeout: 60
    reservedConcurrency: 5   # limits unexpected Gemini API spending
    description: "Consumes SQS queue and generates content with Gemini"
    events:
      - sqs:
          arn: !GetAtt GenerationQueue.Arn
          batchSize: 1                         # one post per invocation — isolated failures
          functionResponseType: ReportBatchItemFailures  # only failed messages return to queue

  # ── Cognito Trigger ─────────────────────────────────────────────────

  onUserSignup:
    handler: src/functions/onUserSignup.handler
    role: !GetAtt OnUserSignupLambdaRole.Arn
    timeout: 10
    description: "Creates user profile in DynamoDB after email confirmation"
    # No HTTP event — invoked directly by Cognito

  # ── Legal / Terms ──────────────────────────────────────────────────

  getLegalTermsStatus:
    handler: src/functions/getLegalTermsStatus.handler
    role: !GetAtt GetLegalTermsStatusLambdaRole.Arn
    timeout: 5
    description: "Returns whether user needs to accept updated terms"
    events:
      - http:
          path: /legal/terms-status
          method: get
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  getLegalDocument:
    handler: src/functions/getLegalDocument.handler
    role: !GetAtt GetLegalDocumentLambdaRole.Arn
    timeout: 5
    description: "Returns the active legal document (terms or privacy) from SintoniaLegal"
    events:
      - http:
          path: /legal/{type}
          method: get
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

  acceptLegalTerms:
    handler: src/functions/acceptLegalTerms.handler
    role: !GetAtt AcceptLegalTermsLambdaRole.Arn
    timeout: 5
    description: "Records user acceptance of current terms and privacy policy versions"
    events:
      - http:
          path: /legal/accept
          method: post
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer

resources:
  Resources:

    # ── IAM Roles (per Lambda — least privilege) ───────────────────────
    #
    # Each Lambda has its own IAM role with only the permissions it needs.
    # All roles include the minimum CloudWatch Logs permissions for Lambda to write logs.
    # SSM access is only on roles that need GEMINI_API_KEY at runtime.
    #
    # Naming convention: {FunctionName}LambdaRole
    # Referenced in functions: section via role: !GetAtt {Name}LambdaRole.Arn

    # Shared helper: CloudWatch Logs policy (all Lambdas need this)
    # Inlined into each role rather than shared to maintain full isolation.

    HealthLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-health-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Logs
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*

    GetFeedLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-getFeed-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:Query]
                  Resource:
                    - !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}/index/userId-createdAt-index'

    GetPostLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-getPost-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:GetItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}'

    SavePostLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-savePost-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:GetItem, dynamodb:UpdateItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}'

    UnsavePostLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-unsavePost-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:GetItem, dynamodb:UpdateItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}'

    GetSavedPostsLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-getSavedPosts-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:Query]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}/index/userId-savedAt-index'

    GetPreferencesLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-getPreferences-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:GetItem, dynamodb:PutItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaUsers-${self:provider.stage}'

    UpdatePreferencesLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-updatePreferences-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:UpdateItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaUsers-${self:provider.stage}'

    UpdateProfileLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-updateProfile-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:UpdateItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaUsers-${self:provider.stage}'
                - Effect: Allow
                  Action: [ssm:GetParameter]
                  Resource: !Sub 'arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/syntonia/${self:provider.stage}/*'

    RequestPostLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-requestPost-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:GetItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaUsers-${self:provider.stage}'
                - Effect: Allow
                  Action: [dynamodb:PutItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaRequests-${self:provider.stage}'
                - Effect: Allow
                  Action: [dynamodb:Query]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaRequests-${self:provider.stage}/index/userId-status-index'
                - Effect: Allow
                  Action: [dynamodb:UpdateItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaRateLimit-${self:provider.stage}'
                - Effect: Allow
                  Action: [sqs:SendMessage]
                  Resource: !GetAtt GenerationQueue.Arn
                - Effect: Allow
                  Action: [ssm:GetParameter]
                  Resource: !Sub 'arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/syntonia/${self:provider.stage}/*'

    WorkerInternalLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-workerInternal-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:Query]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}/index/userId-createdAt-index'
                - Effect: Allow
                  Action: [dynamodb:PutItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}'
                - Effect: Allow
                  Action: [dynamodb:UpdateItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaRequests-${self:provider.stage}'
                - Effect: Allow
                  Action: [sqs:ReceiveMessage, sqs:DeleteMessage, sqs:GetQueueAttributes]
                  Resource: !GetAtt GenerationQueue.Arn
                - Effect: Allow
                  Action: [ssm:GetParameter]
                  Resource: !Sub 'arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/syntonia/${self:provider.stage}/*'

    OnUserSignupLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-onUserSignup-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:PutItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaUsers-${self:provider.stage}'

    GetLegalTermsStatusLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-getLegalTermsStatus-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:Query]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaLegal-${self:provider.stage}'
                - Effect: Allow
                  Action: [dynamodb:GetItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaUsers-${self:provider.stage}'

    GetLegalDocumentLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-getLegalDocument-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:Query]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaLegal-${self:provider.stage}'

    AcceptLegalTermsLambdaRole:
      Type: AWS::IAM::Role
      Properties:
        RoleName: syntonia-acceptLegalTerms-${self:provider.stage}
        AssumeRolePolicyDocument:
          Statement:
            - Effect: Allow
              Principal: { Service: lambda.amazonaws.com }
              Action: sts:AssumeRole
        Policies:
          - PolicyName: Policy
            PolicyDocument:
              Statement:
                - Effect: Allow
                  Action: [logs:CreateLogGroup, logs:CreateLogStream, logs:PutLogEvents]
                  Resource: arn:aws:logs:*:*:*
                - Effect: Allow
                  Action: [dynamodb:Query]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaLegal-${self:provider.stage}'
                - Effect: Allow
                  Action: [dynamodb:UpdateItem]
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaUsers-${self:provider.stage}'

    # ── Cognito ────────────────────────────────────────────────────────

    CognitoUserPool:
      Type: AWS::Cognito::UserPool
      Properties:
        UserPoolName: syntonia-users-${self:provider.stage}
        UsernameAttributes: [email]
        AutoVerifiedAttributes: [email]
        EmailVerificationMessage: "Your Syntonia verification code: {####}"
        EmailVerificationSubject: "Confirm your email — Syntonia"
        Policies:
          PasswordPolicy:
            MinimumLength: 8
            RequireUppercase: false
            RequireNumbers: true
            RequireSymbols: false
        LambdaConfig:
          PostConfirmation: !GetAtt OnUserSignupLambdaFunction.Arn

    # Permission for Cognito to invoke the Lambda
    CognitoLambdaPermission:
      Type: AWS::Lambda::Permission
      Properties:
        Action: lambda:InvokeFunction
        FunctionName: !GetAtt OnUserSignupLambdaFunction.Arn
        Principal: cognito-idp.amazonaws.com
        SourceArn: !GetAtt CognitoUserPool.Arn

    CognitoUserPoolClient:
      Type: AWS::Cognito::UserPoolClient
      Properties:
        ClientName: syntonia-web-client
        UserPoolId: !Ref CognitoUserPool
        GenerateSecret: false
        ExplicitAuthFlows:
          - ALLOW_USER_SRP_AUTH
          - ALLOW_USER_PASSWORD_AUTH
          - ALLOW_REFRESH_TOKEN_AUTH
        PreventUserExistenceErrors: ENABLED
        IdTokenValidity: 1
        AccessTokenValidity: 1
        RefreshTokenValidity: 30
        TokenValidityUnits:
          IdToken: hours
          AccessToken: hours
          RefreshToken: days

    ApiGatewayAuthorizer:
      Type: AWS::ApiGateway::Authorizer
      Properties:
        Name: SyntoniaCognitoAuthorizer
        Type: COGNITO_USER_POOLS
        IdentitySource: method.request.header.Authorization
        RestApiId: !Ref ApiGatewayRestApi
        ProviderARNs:
          - !GetAtt CognitoUserPool.Arn

    # ── DynamoDB Tables ────────────────────────────────────────────────

    SintoniaFeedTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: SintoniaFeed-${self:provider.stage}
        BillingMode: PAY_PER_REQUEST
        # StreamSpecification intentionally omitted — streams are not needed on this table
        # TTL enabled — posts auto-expire 90 days after creation unless saved by the user
        TimeToLiveSpecification:
          AttributeName: ttl
          Enabled: true
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
          - AttributeName: userId
            AttributeType: S
          - AttributeName: createdAt
            AttributeType: S
          - AttributeName: savedAt
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH            # simple PK — allows GetItem by id
        GlobalSecondaryIndexes:
          - IndexName: userId-createdAt-index
            KeySchema:
              - AttributeName: userId
                KeyType: HASH
              - AttributeName: createdAt
                KeyType: RANGE
            Projection:
              ProjectionType: ALL
          - IndexName: userId-savedAt-index
            KeySchema:
              - AttributeName: userId
                KeyType: HASH
              - AttributeName: savedAt
                KeyType: RANGE
            Projection:
              ProjectionType: ALL

    SintoniaRequestsTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: SintoniaRequests-${self:provider.stage}
        BillingMode: PAY_PER_REQUEST
        # No StreamSpecification — SQS is the trigger mechanism now.
        # DynamoDB is used for request history, status tracking, and throttle check.
        # TTL auto-deletes expired requests: PENDING 3d, COMPLETED 30d, FAILED 7d.
        TimeToLiveSpecification:
          AttributeName: ttl
          Enabled: true
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
          - AttributeName: userId
            AttributeType: S
          - AttributeName: status
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH
        GlobalSecondaryIndexes:
          - IndexName: userId-status-index
            KeySchema:
              - AttributeName: userId
                KeyType: HASH
              - AttributeName: status
                KeyType: RANGE
            Projection:
              ProjectionType: KEYS_ONLY  # only COUNT needed

    SintoniaUsersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: SintoniaUsers-${self:provider.stage}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - AttributeName: userId
            AttributeType: S
        KeySchema:
          - AttributeName: userId
            KeyType: HASH

    SintoniaRateLimitTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: SintoniaRateLimit-${self:provider.stage}
        BillingMode: PAY_PER_REQUEST
        # No GSI needed — all access is direct GetItem/UpdateItem by composite key.
        # TTL auto-deletes expired windows at zero write cost.
        TimeToLiveSpecification:
          AttributeName: ttl
          Enabled: true
        AttributeDefinitions:
          - AttributeName: key
            AttributeType: S
        KeySchema:
          - AttributeName: key
            KeyType: HASH

    SintoniaLegalTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: SintoniaLegal-${self:provider.stage}
        BillingMode: PAY_PER_REQUEST
        # No TTL — legal documents are permanent records.
        # PK: typeLanguage (e.g. 'terms#en', 'privacy#pt-BR')
        # SK: createdAt (ISO 8601)
        # Query: typeLanguage = :pk, ScanIndexForward: false, Limit: 1 → active doc per language
        AttributeDefinitions:
          - AttributeName: typeLanguage
            AttributeType: S
          - AttributeName: createdAt
            AttributeType: S
        KeySchema:
          - AttributeName: typeLanguage
            KeyType: HASH
          - AttributeName: createdAt
            KeyType: RANGE

    # ── SQS Queues ────────────────────────────────────────────────────

    GenerationQueue:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: syntonia-generation-${self:provider.stage}
        VisibilityTimeout: 120        # Must be >= Lambda timeout (60s). 120s gives buffer.
        MessageRetentionPeriod: 86400 # 24 hours — messages not processed in 24h are discarded
        RedrivePolicy:
          deadLetterTargetArn: !GetAtt GenerationDLQ.Arn
          maxReceiveCount: 3          # After 3 failed deliveries → move to DLQ

    GenerationDLQ:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: syntonia-generation-dlq-${self:provider.stage}
        MessageRetentionPeriod: 1209600  # 14 days — time to inspect and replay failed messages

    # ── CloudWatch Alarms ──────────────────────────────────────────────
    WorkerErrorAlarm:
      Type: AWS::CloudWatch::Alarm
      Properties:
        AlarmName: syntonia-worker-errors-${self:provider.stage}
        AlarmDescription: "workerInternal failed to generate content"
        MetricName: Errors
        Namespace: AWS/Lambda
        Dimensions:
          - Name: FunctionName
            Value: syntonia-backend-${self:provider.stage}-workerInternal
        Statistic: Sum
        Period: 300        # 5 minutes
        EvaluationPeriods: 1
        Threshold: 3       # alarm if >= 3 errors in 5 min
        ComparisonOperator: GreaterThanOrEqualToThreshold
        TreatMissingData: notBreaching

    ApiHighLatencyAlarm:
      Type: AWS::CloudWatch::Alarm
      Properties:
        AlarmName: syntonia-api-latency-${self:provider.stage}
        AlarmDescription: "getFeed latency above 3s"
        MetricName: Duration
        Namespace: AWS/Lambda
        Dimensions:
          - Name: FunctionName
            Value: syntonia-backend-${self:provider.stage}-getFeed
        Statistic: p95
        Period: 60
        EvaluationPeriods: 3
        Threshold: 3000    # 3s in ms
        ComparisonOperator: GreaterThanThreshold
        TreatMissingData: notBreaching

    DLQMessageAlarm:
      Type: AWS::CloudWatch::Alarm
      Properties:
        AlarmName: syntonia-dlq-messages-${self:provider.stage}
        AlarmDescription: "Messages arrived in GenerationDLQ — permanent generation failure"
        MetricName: ApproximateNumberOfMessagesVisible
        Namespace: AWS/SQS
        Dimensions:
          - Name: QueueName
            Value: !GetAtt GenerationDLQ.QueueName
        Statistic: Sum
        Period: 60
        EvaluationPeriods: 1
        Threshold: 1        # alarm on the very first message in DLQ
        ComparisonOperator: GreaterThanOrEqualToThreshold
        TreatMissingData: notBreaching

  Outputs:
    UserPoolId:
      Value: !Ref CognitoUserPool
      Export:
        Name: syntonia-user-pool-id-${self:provider.stage}
    UserPoolClientId:
      Value: !Ref CognitoUserPoolClient
      Export:
        Name: syntonia-user-pool-client-id-${self:provider.stage}
    ApiGatewayUrl:
      Value: !Sub https://${ApiGatewayRestApi}.execute-api.${self:provider.region}.amazonaws.com/${self:provider.stage}
      Export:
        Name: syntonia-api-url-${self:provider.stage}
    FeedTableName:
      Value: !Ref SintoniaFeedTable
      Export:
        Name: syntonia-feed-table-${self:provider.stage}
    GenerationQueueUrl:
      Value: !Ref GenerationQueue
      Export:
        Name: syntonia-generation-queue-url-${self:provider.stage}
    GenerationDLQUrl:
      Value: !Ref GenerationDLQ
      Export:
        Name: syntonia-generation-dlq-url-${self:provider.stage}

plugins:
  - serverless-esbuild
  - serverless-offline
```

---

## 13. Project Directory Structure

```
syntonia-app/
│
├── ARCHITECTURE.md                    # This document
│
├── .github/
│   └── workflows/
│       ├── deploy-backend.yml         # Backend CI/CD (GitHub Actions)
│       └── deploy-frontend.yml        # Optional (Amplify handles this automatically)
│
├── frontend/                          # React SPA
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── index.html
│   ├── amplify.yml                    # Amplify Hosting build spec (monorepo)
│   ├── .env.local                     # Local variables (NEVER committed)
│   ├── .env.example                   # Variable template (committed)
│   ├── .gitignore
│   └── src/
│       ├── main.tsx                   # Entry point — calls Amplify.configure(), renders App
│       ├── App.tsx                    # Router + RequireAuth + server tag sync on login
│       ├── components/
│       │   ├── FeedContainer.tsx      # Infinite scroll + IntersectionObserver
│       │   ├── PostCard.tsx           # Summary card + horizontal drag
│       │   ├── PostDetail.tsx         # Markdown renderer (lazy)
│       │   ├── TagSelector.tsx        # AI-extracted tag toggles (used in Onboarding + Profile)
│       │   ├── EmptyFeedScreen.tsx    # Shown when feed is empty — prompt to configure tags
│       │   └── LoadingSkeleton.tsx    # Skeleton during generation
│       ├── hooks/
│       │   ├── useFeed.ts             # Feed fetch and pagination
│       │   ├── useJIT.ts              # Just-in-time generation trigger
│       │   └── useAuth.ts             # Amplify Auth wrapper
│       ├── pages/
│       │   ├── FeedPage.tsx           # Feed + empty state (EmptyFeedScreen)
│       │   ├── SavedGridPage.tsx       # Grid of saved posts with unsave button
│       │   ├── SavedFeedPage.tsx       # Snap-scroll feed view of saved posts
│       │   ├── LoginPage.tsx
│       │   ├── SignupPage.tsx         # Cognito signUp + confirmSignUp flow
│       │   ├── OnboardingPage.tsx     # Post-signup: description input → AI tag extraction → confirm
│       │   └── ProfilePage.tsx        # Tabs: Profile (desc + tags) | Settings (theme + language)
│       ├── services/
│       │   ├── amplify.ts             # Amplify configuration
│       │   └── api.ts                 # HTTP client + JWT injection
│       ├── store/
│       │   ├── feedStore.ts           # Zustand: in-memory posts + isPostExpanded lock
│       │   ├── savedStore.ts          # Zustand: saved post ids (persisted)
│       │   ├── preferencesStore.ts    # Zustand: theme + language (persisted — syntonia-preferences)
│       │   └── userStore.ts           # Zustand: description, extractedTags, activeTags (persisted)
│       └── types/
│           └── index.ts               # Post, Tag, Theme, Language, UserPreferencesLocal + AVAILABLE_TAGS
│
└── backend/                           # Serverless Framework + TypeScript
    ├── package.json                   # TypeScript, serverless-esbuild, @types/aws-lambda
    ├── tsconfig.json                  # strict: true, target: ES2022, module: NodeNext
    ├── serverless.yml                 # Complete IaC — all tables, functions, queues, Cognito
    ├── .env.local                     # GEMINI_API_KEY for local dev (NEVER committed)
    ├── .env.example                   # Variable template (committed)
    ├── .gitignore
    ├── scripts/
    │   └── seed-legal.ts              # PutItem: Terms of Use + Privacy Policy v1.0 into SintoniaLegal
    └── src/
        ├── functions/                 # 17 Lambda handlers (.ts)
        │   ├── getFeed.ts             # GET /feed
        │   ├── requestPost.ts         # POST /feed/request
        │   ├── getPost.ts             # GET /post/{id}
        │   ├── savePost.ts            # POST /post/{id}/save
        │   ├── unsavePost.ts          # DELETE /post/{id}/save
        │   ├── likePost.ts            # POST /post/{id}/like
        │   ├── unlikePost.ts          # DELETE /post/{id}/like
        │   ├── getSavedPosts.ts       # GET /posts/saved
        │   ├── getPreferences.ts      # GET /user/preferences (upsert fallback + returns theme/language)
        │   ├── updatePreferences.ts   # PUT /user/preferences (patch: activeTags? + theme? + language?)
        │   ├── updateProfile.ts       # PUT /user/profile (description → Gemini tag extraction)
        │   ├── health.ts              # GET /health (public, no auth)
        │   ├── workerInternal.ts      # SQS trigger → Gemini → DynamoDB (reservedConcurrency: 5)
        │   ├── onUserSignup.ts        # Cognito Post-Confirmation Trigger
        │   ├── getLegalTermsStatus.ts # GET /legal/terms-status
        │   ├── getLegalDocument.ts    # GET /legal/{type}?lang= (with language fallback)
        │   └── acceptLegalTerms.ts    # POST /legal/accept
        └── shared/                    # Reusable TypeScript modules (domain subfolders)
            ├── core/
            │   ├── types/             # 11 type files + index.ts barrel
            │   ├── env.ts             # ALL process.env access
            │   ├── tables.ts          # DynamoDB table name constants
            │   ├── default-tags.ts    # DEFAULT_TAGS + DEFAULT_DESCRIPTION
            │   └── logger.ts          # createLogger() — structured JSON logger
            ├── http/
            │   ├── auth.ts            # getUserId(), getUserEmail(), AuthError
            │   ├── response.ts        # HTTP helpers + CORS via CORS_ORIGINS env var
            │   ├── validators.ts      # Zod schemas + validate()
            │   └── rateLimit.ts       # checkRateLimit() + RateLimitError
            ├── db/
            │   └── index.ts           # All DynamoDB operations
            ├── ai/
            │   └── gemini.ts          # generatePost(), extractTagsFromDescription()
            └── queue/
                └── sqs.ts             # sendGenerationRequest()
```

### Auxiliary Configuration Files

**`frontend/.gitignore`**
```
node_modules/
dist/
.env.local
.env.*.local
*.log
.DS_Store
```

**`backend/.gitignore`**
```
node_modules/
.serverless/
.env.local
.env.*.local
*.log
.DS_Store
```

**`frontend/tailwind.config.ts`**
```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      typography: {
        invert: {
          css: {
            '--tw-prose-body': 'rgb(209 213 219)',
            '--tw-prose-headings': 'rgb(255 255 255)',
            '--tw-prose-code': 'rgb(167 243 208)',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config;
```

---

## 14. Local Development Setup

### Prerequisites

```bash
node >= 22.x
npm >= 10.x
AWS CLI configured (aws configure)
AWS account with permissions for DynamoDB, Lambda, Cognito, SSM
```

### 1. Clone and install dependencies

```bash
git clone https://github.com/<your-org>/syntonia-app.git
cd syntonia-app

# Frontend
cd frontend && npm install

# Backend
cd ../backend && npm install
```

### 2. Configure environment variables

```bash
# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with real values

# Backend — for local dev with serverless-offline
cp backend/.env.example backend/.env.local
# Edit backend/.env.local with your real GEMINI_API_KEY
```

### 3. Start the backend locally (serverless-offline)

```bash
cd backend
npm run dev
# API available at: http://localhost:3000
```

The `serverless-offline` plugin simulates API Gateway + Lambda locally.
DynamoDB is **not** simulated locally — it uses the real AWS table (stage: dev).

To use local DynamoDB (optional):
```bash
# Install plugin
npm install --save-dev serverless-dynamodb-local

# Initialize
npx serverless dynamodb install

# Run with local DynamoDB
npx serverless offline start --stage dev
```

### 4. Start the frontend locally

```bash
cd frontend
npm run dev
# App available at: http://localhost:5173
```

### 5. Deploy the backend to AWS (stage: dev)

```bash
# First, create the secret in SSM (one-time setup)
aws ssm put-parameter \
  --name "/syntonia/dev/gemini-api-key" \
  --value "AIzaSy..." \
  --type SecureString \
  --region sa-east-1

# Deploy
cd backend
npm run deploy:dev
```

### 6. Deploy the backend to production

```bash
# Create production secret (one-time setup)
aws ssm put-parameter \
  --name "/syntonia/prod/gemini-api-key" \
  --value "AIzaSy..." \
  --type SecureString \
  --region sa-east-1

# Deploy
npm run deploy:prod
```

### 7. Update frontend variables after deploy

After `sls deploy`, retrieve the CloudFormation Outputs:
```bash
aws cloudformation describe-stacks \
  --stack-name syntonia-backend-dev \
  --query 'Stacks[0].Outputs' \
  --region sa-east-1
```

Copy `UserPoolId`, `UserPoolClientId` and `ApiGatewayUrl` to:
- `frontend/.env.local` (development)
- Amplify Console → Environment Variables (production)

---

## 15. Environments & CI/CD

### Environments

| Environment | Git Branch | Backend Stage | Frontend URL |
|---|---|---|---|
| **Production** | `main` | `prod` | `https://syntonia.app` |
| **Staging** | `development` | `dev` | `https://development.syntonia.app` |

### CI/CD — Frontend (Amplify Hosting)

Amplify monitors branches automatically. On `git push origin main`,
Amplify detects the change and runs the build + deploy without manual intervention.

```yaml
# frontend/amplify.yml
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
    appRoot: frontend
```

**Required Rewrites in Amplify Console** (for SPA routing to work):
```
Source:    </^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>
Target:    /index.html
Type:      200 (Rewrite)
```

### CI/CD — Backend (GitHub Actions)

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend

on:
  push:
    branches: [main, dev]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: backend

      - name: Determine stage
        id: stage
        run: |
          if [ "${{ github.ref }}" = "refs/heads/main" ]; then
            echo "stage=prod" >> $GITHUB_OUTPUT
          else
            echo "stage=dev" >> $GITHUB_OUTPUT
          fi

      - name: Deploy to AWS
        run: npx serverless deploy --stage ${{ steps.stage.outputs.stage }}
        working-directory: backend
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_DEFAULT_REGION: sa-east-1
```

### IAM Policy for the CI/CD user

Create an IAM user `syntonia-deploy` with the following minimum policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "apigateway:*",
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "cognito-idp:CreateUserPool",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:UpdateUserPool",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRole",
        "iam:PassRole",
        "s3:CreateBucket",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "logs:CreateLogGroup",
        "logs:DescribeLogGroups",
        "logs:DeleteLogGroup",
        "logs:PutRetentionPolicy",
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "*"
    }
  ]
}
```

### Secrets Management

```
AWS SSM Parameter Store (KMS encrypted):
├── /syntonia/prod/gemini-api-key   (SecureString)
└── /syntonia/dev/gemini-api-key    (SecureString)

GitHub Secrets (repository):
├── AWS_ACCESS_KEY_ID               (syntonia-deploy user)
└── AWS_SECRET_ACCESS_KEY           (syntonia-deploy user)

Amplify Console → Environment Variables:
├── [main branch]
│   ├── VITE_API_URL = https://xxx.execute-api.sa-east-1.amazonaws.com/prod
│   ├── VITE_COGNITO_USER_POOL_ID = sa-east-1_XXXXXXXXX
│   ├── VITE_COGNITO_CLIENT_ID = xxxxxxxxxxxxxxxx
│   └── VITE_AWS_REGION = sa-east-1
└── [dev branch]
    ├── VITE_API_URL = https://xxx.execute-api.sa-east-1.amazonaws.com/dev
    ├── VITE_COGNITO_USER_POOL_ID = sa-east-1_YYYYYYYYY  (separate pool)
    ├── VITE_COGNITO_CLIENT_ID = yyyyyyyyyyyyyyyy
    └── VITE_AWS_REGION = sa-east-1
```

---

## 16. Monitoring & Observability

### CloudWatch Log Groups

Created automatically by the Serverless Framework:

```
/aws/lambda/syntonia-backend-{stage}-getFeed
/aws/lambda/syntonia-backend-{stage}-requestPost
/aws/lambda/syntonia-backend-{stage}-workerInternal
/aws/lambda/syntonia-backend-{stage}-getPost
/aws/lambda/syntonia-backend-{stage}-savePost
/aws/lambda/syntonia-backend-{stage}-unsavePost
/aws/lambda/syntonia-backend-{stage}-likePost
/aws/lambda/syntonia-backend-{stage}-unlikePost
/aws/lambda/syntonia-backend-{stage}-getSavedPosts
/aws/lambda/syntonia-backend-{stage}-getPreferences
/aws/lambda/syntonia-backend-{stage}-updatePreferences
/aws/lambda/syntonia-backend-{stage}-updateProfile
/aws/lambda/syntonia-backend-{stage}-health
/aws/lambda/syntonia-backend-{stage}-onUserSignup
/aws/lambda/syntonia-backend-{stage}-getLegalTermsStatus
/aws/lambda/syntonia-backend-{stage}-getLegalDocument
/aws/lambda/syntonia-backend-{stage}-acceptLegalTerms
```

Retention configured at **14 days** via `logRetentionInDays` in `serverless.yml`.

### CloudWatch Alarms (defined in serverless.yml)

| Alarm | Metric | Threshold | Period |
|---|---|---|---|
| `WorkerErrorAlarm` | Lambda Errors (workerInternal) | >= 3 errors | 5 min |
| `ApiHighLatencyAlarm` | Lambda Duration p95 (getFeed) | > 3000ms | 1 min (x3) |
| `DLQMessageAlarm` | SQS ApproximateNumberOfMessagesVisible (DLQ) | >= 1 message | 1 min |

> The `DLQMessageAlarm` is the most critical alert — it fires the moment any message reaches
> the Dead Letter Queue, meaning a post failed to generate after all 3 SQS-level retries.

### Structured Log Patterns

All handlers use `createLogger` from `src/shared/core/logger.ts`. Each log entry is a single JSON line on stdout — CloudWatch Logs Insights compatible. See `backend/AGENTS.md §4b` for the full logger API.

```json
{
  "level": "INFO",
  "timestamp": "2026-07-05T14:00:00.000Z",
  "message": "Feed query completed",
  "fn": "getFeed",
  "stage": "dev",
  "requestId": "abc-123",
  "userId": "cognito-sub",
  "count": 5,
  "durationMs": 142
}
```

**CloudWatch Logs Insights queries:**
```
# All logs for a specific request
fields @timestamp, level, message, fn, userId, durationMs
| filter requestId = "abc-123"
| sort @timestamp asc

# Worker errors
fields @timestamp, message, fn
| filter level = "ERROR"
| sort @timestamp desc
| limit 20
```

### Key Business Metrics to Monitor

| Metric | How to measure |
|---|---|
| Posts generated per day | CloudWatch Logs Insights on workerInternal |
| Generation success rate | (COMPLETED / total requests) via DynamoDB Scan |
| Daily active users | CloudWatch Metrics from Cognito (DAU) |
| Feed latency (P95) | CloudWatch → Lambda → Duration → p95 |
| Gemini cost per day | Post count × $0.00018 |

---

## 17. Cost Model

### Estimate for 1,000 active users/month

Assumes: 5 sessions/user/month × 20 posts/session = 100 posts viewed per user.
Generated posts: 10% new posts per user = ~10 new posts/user/month = 10,000 posts/month total.
Saved posts actions: ~15 saves + ~5 unsaves per user/month = ~20,000 save/unsave calls total.

| Service | Billing unit | Volume/month | Estimated cost |
|---|---|---|---|
| **Amplify Hosting** | Build min + GB transferred | 500 min + 10 GB | ~$1.00 |
| **API Gateway** | HTTP requests | ~520,000 req | ~$1.82 |
| **Lambda** | GB-second | ~620,000 invocations × 128MB × 0.5s | ~$0.26 |
| **DynamoDB** | WCU + RCU (PAY_PER_REQUEST) | ~2.1M WCU + 6.2M RCU | ~$2.90 |
| **DynamoDB Streams** | Not used (disabled on all tables) | — | **$0.00** |
| **DynamoDB TTL** | Deletes by TTL | ~10,000 expired posts/month | **FREE** |
| **SQS (GenerationQueue + DLQ)** | Messages sent | ~10,000 messages | ~$0.004 |
| **Cognito User Pools** | MAUs | 1,000 MAUs | **FREE** (free tier: 50,000) |
| **Gemini 1.5 Flash** | Output tokens | 10,000 posts × 1,200 tokens | ~$1.80 |
| **CloudWatch Logs** | GB ingested + stored | ~1 GB | ~$0.50 |
| **SSM Parameter Store** | Standard parameters | 4 parameters | **FREE** |
| **IAM** | — | — | **FREE** |
| **Total** | | | **~$8.28/month** |

> The 3 new Saved Posts Lambdas (`savePost`, `unsavePost`, `getSavedPosts`) add ~20,000 invocations/month — roughly **+$0.22** total across Lambda + DynamoDB + API Gateway.

### Cost Scaling

| Active users/month | Generated posts/month | Estimated cost/month |
|---|---|---|
| 100 | 1,000 | ~$1.50 |
| 1,000 | 10,000 | ~$8.30 |
| 5,000 | 50,000 | ~$33.00 |
| 10,000 | 100,000 | ~$62.00 |
| 50,000 | 500,000 | ~$285.00 |

> The largest cost variable is the **Gemini API** (~60% of total).
> DynamoDB PAY_PER_REQUEST ensures zero fixed cost during idle periods.
> DynamoDB TTL auto-deletes unsaved posts for free — no cleanup Lambda needed.

---

## 18. Security Checklist

### API & Authentication
- [x] All data routes protected by Cognito JWT (API Gateway Authorizer)
- [x] `userId` **always** extracted from the token — never accepted from the request body
- [x] API Gateway throttling: 1000 req/s burst, 500 req/s steady
- [x] CORS controlled via `CORS_ORIGINS` environment variable — default `'*'` (wildcard, no credentials). To restrict in production: `CORS_ORIGINS=https://syntonia.app,...` in `serverless.yml`. No URLs hardcoded in source code.
- [x] `PreventUserExistenceErrors: ENABLED` on Cognito Client — does not reveal if email exists
- [x] `GenerateSecret: false` on Cognito Client — SPA does not use client secret

### Secrets & Configuration
- [x] `GEMINI_API_KEY` stored in SSM Parameter Store as `SecureString` (KMS encrypted)
- [x] `.env.local` listed in `.gitignore` on both projects
- [x] `VITE_*` variables are public by design — **no secrets reach the frontend**
- [x] CI/CD IAM user with minimum privilege policy (only what is needed)

### Data & Database
- [x] All Lambda functions have individual IAM roles with least-privilege permissions (17 separate `AWS::IAM::Role` resources in `serverless.yml`)
- [x] `getPost` verifies `post.userId === userId` — users can only access their own posts
- [x] `requestPost` checks PENDING requests to prevent abuse (429 if >= 5)
- [x] Zod schema validation on all Lambda inputs
- [ ] **Phase 2 improvement:** Consider stricter IAM scoping for individual Lambda operations (e.g. `health` has no DynamoDB access — already done)

### Rate Limiting (SintoniaRateLimit)
- [x] `AI_GENERATION#{userId}` — max 10 AI generation requests per hour per user
- [x] `API_REQUEST#{userId}` — max 100 general API requests per 15 min per user
- [x] Fixed-window counter uses atomic DynamoDB `ADD` — no race conditions
- [x] TTL auto-expires counters — zero maintenance, zero cost for cleanup
- [x] Rate limit check runs **before** any expensive operation (DynamoDB query, SQS send)
- [x] `RateLimitError` maps to `429 Too Many Requests` with a descriptive message
- [x] Cognito handles rate limiting for auth flows (login, signup, password reset) natively

### Worker & AI
- [x] `workerInternal` has `reservedConcurrency: 5` — limits unexpected Gemini spending
- [x] `batchSize: 1` — each Lambda invocation processes exactly one SQS message, ensuring isolated failures
- [x] `ReportBatchItemFailures` — only the specific failed message is returned to the queue, not the entire batch
- [x] SQS `VisibilityTimeout: 120s` — greater than Lambda timeout (60s), prevents duplicate processing
- [x] SQS `maxReceiveCount: 3` — after 3 failed deliveries, message goes to DLQ automatically
- [x] `GenerationDLQ` retains failed messages for 14 days — full visibility into permanent failures
- [x] `DLQMessageAlarm` fires on the first DLQ message — immediate alert on permanent failures
- [x] `PROCESSING` status on DynamoDB record prevents logical double-processing on visibility timeout retry
- [x] AI-returned JSON validated **before** saving to the database
- [x] `updateProfile` timeout set to 29s — aligned with API Gateway's hard 29s integration limit

### Frontend
- [x] Amplify Hosting serves via HTTPS by default with TLS 1.2+
- [x] Cognito tokens managed by the Amplify SDK with automatic refresh
- [x] `userStore` persisted in localStorage **without** containing tokens or sensitive data

---

## 19. Roadmap & Phases

### Phase 1 — MVP (4–6 weeks)

**Backend:**
- [ ] Repository setup + folder structure
- [ ] `sls deploy --stage dev` — create DynamoDB tables and User Pool
- [ ] Implement `onUserSignup` (Cognito trigger) — uses `DEFAULT_TAGS` from `constants.js`
- [ ] Implement `getFeed` + `requestPost` (with description in SQS payload) + `workerInternal` (with description in prompt, sets `ttl = now+90d`)
- [ ] Implement `getPreferences` (with upsert fallback) + `updatePreferences` (tag toggle)
- [ ] Implement `updateProfile` (description → Gemini tag extraction → save)
- [ ] Implement `getPost` + `health`
- [ ] Implement `savePost` + `unsavePost` + `getSavedPosts`
- [ ] Create SSM secrets (dev + prod)

**Frontend:**
- [ ] Scaffold with Vite + TypeScript + Tailwind
- [ ] Configure Amplify SDK (`amplify.ts`)
- [ ] Implement `App.tsx` — router, `RequireAuth`, server sync on login (`GET /user/preferences` → Zustand `description` + `activeTags`)
- [ ] Implement `LoginPage` + `SignupPage` (Cognito signUp + confirmSignUp)
- [ ] Implement `OnboardingPage` — description textarea → `PUT /user/profile` → show extracted tags → confirm → `/feed`
- [ ] Implement `ProfilePage` — two tabs: Profile (desc + tag toggles) + Settings (theme + language)
- [ ] Implement `FeedPage` with `FeedContainer` + `PostCard` (basic Y-scroll)
- [ ] Implement `EmptyFeedScreen` with reload button and link to `/profile`
- [ ] Implement `useFeed` + `feedStore`
- [ ] Implement `SavedGridPage` + `SavedFeedPage` + `savedStore` + `useSavedPosts`
- [ ] Implement `usePreferencesStore` (theme + language, persisted) + CSS variable theme system
- [ ] Connect to real backend (`api.ts`)

**Deploy:**
- [ ] Connect repository to Amplify Hosting
- [ ] Configure environment variables in Amplify Console
- [ ] GitHub Actions CI/CD for backend
- [ ] Test full flow: signup → onboarding (description → AI tags) → feed → JIT generation → save post → saved grid

---

### Phase 2 — Full Feed (2–3 weeks)
- [ ] Horizontal swipe (`PostCard` → `PostDetail`) with Framer Motion
- [ ] `PostDetail` with ReactMarkdown + rehype-highlight
- [ ] `TagSelector` on `ProfilePage` (shows AI-extracted tags with enable/disable toggles)
- [ ] `useJIT` hook for automatic generation
- [ ] `LoadingSkeleton` during generation
- [ ] Network error handling on frontend (retry, toasts)
- [ ] Custom domain on Amplify (`syntonia.app`)

---

### Phase 3 — Quality & UX (2 weeks)
- [ ] Snap scroll animations (CSS `scroll-snap` + Framer Motion)
- [ ] PWA manifest + service worker (installable on mobile)
- [ ] CloudWatch Dashboard with business metrics
- [ ] Load testing on `GET /feed` endpoint

---

### Phase 4 — Scale & Features (future)
- [ ] `SintoniaSeenPosts` table (PK: userId, SK: postId, TTL: 90 days) — prevents repetition
- [ ] EventBridge scheduled Lambda — pre-warms the feed at 6am/6pm
- [ ] Post sharing (`/post/:id` without authentication for public deep link)
- [ ] **Multi-language content generation** — pass `language` from `usePreferencesStore` to `PUT /user/profile` → backend includes language in Gemini prompt → posts generated in user's preferred language; requires `language` field in `SintoniaUsers` DynamoDB table and `updateProfile` Lambda update
- [ ] i18n: `useT()` hook + translations object (EN/PT-BR) covering all UI strings — backend `language` field already stored
- [ ] Mermaid.js support for diagrams in posts
- [ ] Engagement analytics (posts viewed, reading time) via CloudWatch custom metrics
