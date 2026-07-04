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
| **AWS Lambda** | All business logic (11 functions + 1 Cognito trigger) |
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

> **Status:** Fully mocked frontend (Phase 1 complete). No real API calls leave the browser — MSW (Mock Service Worker) intercepts every `fetch` request and returns deterministic mock data. When the real backend is ready, set `VITE_API_URL` in Amplify Console and remove the MSW initialisation from `main.tsx`. No component changes needed.

### Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.3.x | UI framework |
| **TypeScript** | 5.7.x | Strict mode — zero `any`, full type safety |
| **Vite** | 6.x | Build tool + dev server |
| **Tailwind CSS** | 3.4.x | Utility-first styling with CSS variable tokens |
| **Zustand** | 5.x | Global state — 7 stores (auth, feed, saved, user, preferences, terms, toast) |
| **React Router** | 6.28.x | Client-side routing — lazy-loaded pages |
| **Framer Motion** | 11.x | Snap-scroll, swipe transitions, stagger animations |
| **react-markdown** | 9.x | Renders Markdown post content |
| **rehype-highlight** | 7.x | Syntax highlighting in code blocks |
| **remark-gfm** | latest | GitHub Flavored Markdown support |
| **highlight.js** | 11.x | Syntax highlight themes |
| **MSW** | 2.x | Mock Service Worker — intercepts all API calls in development |
| **Radix UI** | various | Accessible headless primitives (Tooltip) |
| **CVA** | 0.7.x | Class Variance Authority — component variant system |
| **clsx + tailwind-merge** | latest | Class name merging via `cn()` |
| **Lucide React** | 0.469.x | Icon set |

**Node version:** 22.15.0 | **Package manager:** yarn 1.22.22

### Route Structure

```
/                     → RootRedirect → /auth/login | /onboarding | /feed
/auth/login           → MockCognitoPage (mock auth — no real Cognito in dev)
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

All pages are `React.lazy` — wrapped in `withSuspense()` which renders a `Spinner` as fallback.

### Application Entry Points

**`src/main.tsx`**
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

In production: remove MSW init from `main.tsx`, set `VITE_API_URL` → all requests go to real API Gateway. Zero other changes needed.

### Key Page Flows

**`MockCognitoPage`** (`/auth/login`)
- Click "Continue with Cognito" → `POST /auth/callback` (MSW) → returns mock user + token
- Sets auth store, syncs description + activeTags to user store
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
- `useSavedPosts` loads `GET /posts/saved` on mount
- 2-column grid with stagger animation on load
- Each `SavedPostCard`: tap → opens `ExpandedOverlay` (full-screen portal, swipe right to close)
- Unsave button → `ConfirmModal` → `DELETE /post/:id/save`

**`SavedFeedPage`** (`/saved/feed?start=postId`)
- Reuses the same `PostCard` component with `detailVariant="expand"`
- Scrolls to `?start=postId` on mount
- No JIT generation — fixed list of saved posts

**`PostPage`** (`/post/:id`)
- Deep link for sharing — `GET /post/:id` on mount
- Full Markdown rendering with syntax highlighting

### State Management

| Store | Key state | Persisted | localStorage key |
|---|---|---|---|
| `useAuthStore` | `user`, `isAuthenticated`, `login()`, `logout()` | No | — |
| `useFeedStore` | `posts[]`, `currentIndex`, `cursor`, `isLoading`, `isPostExpanded` | No | — |
| `useSavedStore` | `savedIds` (Set), `posts[]`, `isSaved()` | Yes | `syntonia-saved` |
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
├── Branch: main   → production (syntonia.app)
├── Branch: dev    → staging (dev.syntonia.app)
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

## 4. Backend — AWS Lambda + Serverless Framework

### Full Stack

```
Node.js 22.x (AWS Lambda runtime)
├── Serverless Framework v4
├── serverless-offline            — Simulates API Gateway + Lambda locally
├── @google/generative-ai         — Official Gemini SDK
├── @aws-sdk/client-dynamodb      — AWS SDK v3
├── @aws-sdk/lib-dynamodb         — DocumentClient (simplifies operations)
├── @aws-sdk/client-sqs           — SQS client for sending generation requests
├── zod                           — Input schema validation
└── uuid                          — Unique ID generation
```

**`backend/package.json`**
```json
{
  "name": "syntonia-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "serverless offline --stage dev",
    "deploy:dev": "serverless deploy --stage dev",
    "deploy:prod": "serverless deploy --stage prod",
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
    "serverless": "^4.0.0",
    "serverless-offline": "^13.0.0"
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
GENERATION_QUEUE_URL=https://sqs.sa-east-1.amazonaws.com/123456789/syntonia-generation-dev
STAGE=dev
```

### Lambda Functions

| Function | Trigger | Timeout | Concurrency | Description |
|---|---|---|---|---|
| `getFeed` | GET /feed | 10s | Default | Returns paginated posts via GSI |
| `requestPost` | POST /feed/request | 10s | Default | Sends to SQS + persists request to DynamoDB |
| `workerInternal` | SQS (GenerationQueue) | 60s | 5 (reserved) | Calls Gemini, saves post with 90-day TTL |
| `getPost` | GET /post/{id} | 10s | Default | Returns a full post by ID |
| `savePost` | POST /post/{id}/save | 10s | Default | Sets `savedAt`, removes `ttl` — post persists forever |
| `unsavePost` | DELETE /post/{id}/save | 10s | Default | Removes `savedAt`, restores `ttl = now + 30d` |
| `getSavedPosts` | GET /posts/saved | 10s | Default | Returns saved posts via `userId-savedAt-index` GSI |
| `getPreferences` | GET /user/preferences | 10s | Default | Returns user profile, description, active tags, theme, and language |
| `updatePreferences` | PUT /user/preferences | 10s | Default | Patch endpoint — accepts any combination of `activeTags`, `theme`, `language` |
| `updateProfile` | PUT /user/profile | 29s | Default | Saves description + calls Gemini to extract tags |
| `health` | GET /health | 5s | Default | Public health check (no auth) |
| `onUserSignup` | Cognito Post-Confirmation | 10s | Default | Creates user profile in DynamoDB after signup |
| `getLegalTermsStatus` | GET /legal/terms-status | 5s | Default | Compares user's accepted versions with the latest active versions in `SintoniaLegal` |
| `getLegalDocument` | GET /legal/terms, GET /legal/privacy | 5s | Default | Queries `SintoniaLegal` with `ScanIndexForward: false, Limit: 1` to return the active document |
| `acceptLegalTerms` | POST /legal/accept | 5s | Default | Validates sent versions match active versions; writes `termsAcceptedVersion`, `privacyAcceptedVersion`, `termsAcceptedAt` to `SintoniaUsers` |

### Shared Modules Implementation

**`src/shared/db.js`**
```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand,
         UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'sa-east-1' });
export const db = DynamoDBDocumentClient.from(client);

export const Tables = {
  FEED: process.env.FEED_TABLE,
  REQUESTS: process.env.REQUESTS_TABLE,
  USERS: process.env.USERS_TABLE,
  RATE_LIMIT: process.env.RATE_LIMIT_TABLE,
};

// ── Feed ──────────────────────────────────────────────────────────────

export const getFeedByUser = async (userId, limit = 5, cursor = null) => {
  const params = {
    TableName: Tables.FEED,
    IndexName: 'userId-createdAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false, // descending — most recent posts first
    Limit: limit,
  };
  if (cursor) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  }
  const result = await db.send(new QueryCommand(params));
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return { items: result.Items, cursor: nextCursor };
};

export const getPostById = async (postId) => {
  const result = await db.send(new GetCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
  }));
  return result.Item ?? null;
};

export const savePost = async (post) => {
  return db.send(new PutCommand({ TableName: Tables.FEED, Item: post }));
};

export const markPostSaved = async (postId, userId) => {
  const savedAt = new Date().toISOString();
  return db.send(new UpdateCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
    ConditionExpression: 'userId = :uid',
    UpdateExpression: 'SET savedAt = :s REMOVE #ttl',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: { ':s': savedAt, ':uid': userId },
  }));
};

export const markPostUnsaved = async (postId, userId) => {
  const ttl = Math.floor(Date.now() / 1000) + 2592000; // now + 30 days
  return db.send(new UpdateCommand({
    TableName: Tables.FEED,
    Key: { id: postId },
    ConditionExpression: 'userId = :uid',
    UpdateExpression: 'REMOVE savedAt SET #ttl = :t',
    ExpressionAttributeNames: { '#ttl': 'ttl' },
    ExpressionAttributeValues: { ':t': ttl, ':uid': userId },
  }));
};

export const getSavedByUser = async (userId, limit = 20, cursor = null) => {
  const params = {
    TableName: Tables.FEED,
    IndexName: 'userId-savedAt-index',
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false, // newest saved first
    Limit: limit,
  };
  if (cursor) {
    params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  }
  const result = await db.send(new QueryCommand(params));
  const nextCursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return { items: result.Items, cursor: nextCursor };
};

// ── Requests ─────────────────────────────────────────────────────────

export const saveRequest = async (request) => {
  return db.send(new PutCommand({ TableName: Tables.REQUESTS, Item: request }));
};

export const updateRequestStatus = async (id, status, extra = {}) => {
  const updateExpressions = ['#s = :s'];
  const names = { '#s': 'status' };
  const values = { ':s': status };

  Object.entries(extra).forEach(([k, v]) => {
    updateExpressions.push(`#${k} = :${k}`);
    names[`#${k}`] = k;
    values[`:${k}`] = v;
  });

  return db.send(new UpdateCommand({
    TableName: Tables.REQUESTS,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
};

export const countPendingRequests = async (userId) => {
  const result = await db.send(new QueryCommand({
    TableName: Tables.REQUESTS,
    IndexName: 'userId-status-index',
    KeyConditionExpression: 'userId = :uid AND #s = :s',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':uid': userId, ':s': 'PENDING' },
    Select: 'COUNT',
  }));
  return result.Count ?? 0;
};

// ── Users ─────────────────────────────────────────────────────────────

export const getUser = async (userId) => {
  const result = await db.send(new GetCommand({
    TableName: Tables.USERS,
    Key: { userId },
  }));
  return result.Item ?? null;
};

export const saveUser = async (user) => {
  return db.send(new PutCommand({ TableName: Tables.USERS, Item: user }));
};

export const updateUserTags = async (userId, activeTags) => {
  return db.send(new UpdateCommand({
    TableName: Tables.USERS,
    Key: { userId },
    UpdateExpression: 'SET activeTags = :t, lastActiveAt = :d',
    ExpressionAttributeValues: {
      ':t': activeTags,
      ':d': new Date().toISOString(),
    },
  }));
};

export const updateUserProfile = async (userId, description, activeTags) => {
  // Saves the free-text description + AI-extracted tags in a single write
  return db.send(new UpdateCommand({
    TableName: Tables.USERS,
    Key: { userId },
    UpdateExpression: 'SET #desc = :d, activeTags = :t, lastActiveAt = :ts',
    ExpressionAttributeNames: { '#desc': 'description' },
    ExpressionAttributeValues: {
      ':d': description,
      ':t': activeTags,
      ':ts': new Date().toISOString(),
    },
  }));
};
```

**`src/shared/gemini.js`**
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AVAILABLE_TAGS } from './constants.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-pro';

// ── Post generation ───────────────────────────────────────────────────

export const generatePost = async ({ tags, description = null }) => {
  let raw;

  // Try with the primary model first
  try {
    raw = await callGemini(PRIMARY_MODEL, buildPrompt(tags, description));
  } catch (primaryErr) {
    console.warn('Primary model failed, trying fallback:', primaryErr.message);
    raw = await callGemini(FALLBACK_MODEL, buildPrompt(tags, description));
  }

  return parseGeminiResponse(raw);
};

const buildPrompt = (tags, description = null) => `
You are generating a technical article for a developer.
${description ? `Developer profile: "${description}"\n` : ''}
Active areas of interest: ${tags.join(', ')}.

Generate a UNIQUE, dense, and original technical article about a specific and advanced subtopic
within these areas of interest.

Respond EXCLUSIVELY with a valid JSON object (no markdown, no explanations outside the JSON):

{
  "title": "Precise and technical title (max 60 characters)",
  "summary": "One sentence explaining the practical value of the article (max 120 characters)",
  "content": "## Title\\n\\nFull content in Markdown with at least 600 words, including real and functional code blocks.",
  "tags": ["tag1", "tag2"],
  "gradient": ["#hexcolor1", "#hexcolor2"]
}

Mandatory rules:
1. Content must have at least 600 words
2. Include at least one real, functional, commented code block
3. Avoid introductory topics — assume the reader is already a professional
4. The gradient must be coherent with the theme (e.g.: AWS = orange/yellow, Docker = blue, etc.)
5. Do not include any text before or after the JSON
`;

// ── Tag extraction from description ──────────────────────────────────

/**
 * Uses Gemini to extract relevant tags from the user's profile description.
 * Only returns tags from AVAILABLE_TAGS — guarantees compatibility with the
 * generation prompt and DynamoDB storage.
 *
 * @param {string} description - User's free-text profile description
 * @returns {Promise<string[]>} Array of matched tags from AVAILABLE_TAGS
 */
export const extractTagsFromDescription = async (description) => {
  let raw;

  try {
    raw = await callGemini(PRIMARY_MODEL, buildTagExtractionPrompt(description));
  } catch (primaryErr) {
    console.warn('Primary model failed for tag extraction, trying fallback:', primaryErr.message);
    raw = await callGemini(FALLBACK_MODEL, buildTagExtractionPrompt(description));
  }

  // Parse and validate extracted tags
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const extracted = JSON.parse(cleaned);

  if (!Array.isArray(extracted)) throw new Error('Expected a JSON array of tags');

  // Filter to only valid AVAILABLE_TAGS — prevents hallucinated or invalid tags
  const validTags = extracted.filter((t) => AVAILABLE_TAGS.includes(t));

  if (validTags.length === 0) {
    throw new Error('No valid tags could be extracted from the description');
  }

  return validTags;
};

const buildTagExtractionPrompt = (description) => `
Given this developer profile description:
"${description}"

From the following list of available tags, extract the 5 to 10 most relevant ones
that match the developer's background and learning interests:

Available tags: ${AVAILABLE_TAGS.join(', ')}

Rules:
1. Only return tags from the provided list — do not invent new ones
2. Return between 5 and 10 tags
3. Order by relevance (most relevant first)
4. Respond ONLY with a valid JSON array of strings

Example response: ["AWS", "TypeScript", "Node.js", "Performance", "Serverless"]
`;

// ── Shared utilities ──────────────────────────────────────────────────

const callGemini = async (modelName, prompt) => {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  return result.response.text();
};

const parseGeminiResponse = (raw) => {
  // Remove possible code delimiters the model may add
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned); // throws SyntaxError if invalid

  const required = ['title', 'summary', 'content', 'tags', 'gradient'];
  for (const field of required) {
    if (!parsed[field]) throw new Error(`Missing required field: ${field}`);
  }

  if (!Array.isArray(parsed.gradient) || parsed.gradient.length !== 2) {
    throw new Error('gradient must be an array of 2 hex colors');
  }

  return parsed;
};
```

**`src/shared/auth.js`**
```javascript
// Extracts the userId (Cognito sub) from the API Gateway event context.
// The JWT has already been validated by API Gateway before reaching the Lambda.
export const getUserId = (event) => {
  const claims = event.requestContext?.authorizer?.claims;
  if (!claims?.sub) {
    throw new AuthError('Invalid or missing token');
  }
  return claims.sub;
};

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}
```

**`src/shared/response.js`**
```javascript
// Helpers for standardized HTTP responses from the API.
const ALLOWED_ORIGINS = [
  'https://syntonia.app',
  'https://www.syntonia.app',
  'https://dev.syntonia.app',
  'http://localhost:5173', // local development
];

const getCorsHeaders = (event) => {
  const origin = event?.headers?.origin ?? event?.headers?.Origin ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };
};

export const ok = (event, body) => ({
  statusCode: 200,
  headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
  body: JSON.stringify(body),
});

export const created = (event, body) => ({
  statusCode: 201,
  headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
  body: JSON.stringify(body),
});

export const accepted = (event, body) => ({
  statusCode: 202,
  headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
  body: JSON.stringify(body),
});

export const badRequest = (event, message) => ({
  statusCode: 400,
  headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
  body: JSON.stringify({ error: 'Bad Request', message }),
});

export const unauthorized = (event) => ({
  statusCode: 401,
  headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
  body: JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing token' }),
});

export const notFound = (event, message = 'Resource not found') => ({
  statusCode: 404,
  headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
  body: JSON.stringify({ error: 'Not Found', message }),
});

export const tooManyRequests = (event, message = 'Too many requests. Please wait.') => ({
  statusCode: 429,
  headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
  body: JSON.stringify({ error: 'Too Many Requests', message }),
});

export const serverError = (event, err) => {
  console.error('[SERVER ERROR]', err);
  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(event) },
    body: JSON.stringify({ error: 'Internal Server Error', message: 'Internal error. Please try again.' }),
  };
};
```

**`src/shared/validators.js`**
```javascript
import { z } from 'zod';

export const feedRequestSchema = z.object({
  tags: z.array(z.string().min(1)).min(1).max(20),
  quantity: z.number().int().min(1).max(5).default(3),
});

export const updatePreferencesSchema = z.object({
  activeTags: z.array(z.string().min(1)).min(1, 'Select at least 1 tag').max(20),
});

export const updateProfileSchema = z.object({
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(500, 'Description must be at most 500 characters'),
});

export const validate = (schema, data) => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.errors.map((e) => e.message).join('; ');
    throw new ValidationError(message);
  }
  return result.data;
};

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

**`src/shared/constants.js`**
```javascript
export const AVAILABLE_TAGS = [
  'AWS', 'React', 'TypeScript', 'Node.js', 'Python',
  'Docker', 'Kubernetes', 'Linux', 'DynamoDB', 'PostgreSQL',
  'Redis', 'GraphQL', 'Rust', 'Go', 'CI/CD',
  'Terraform', 'Serverless', 'Security', 'Performance', 'Architecture',
];

// Default tags applied to new users at signup.
// Users are redirected to /onboarding to replace these with their real interests.
export const DEFAULT_TAGS = ['AWS', 'TypeScript', 'React'];
```

**`src/shared/sqs.js`**
```javascript
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const client = new SQSClient({ region: process.env.AWS_REGION ?? 'sa-east-1' });

/**
 * Sends a generation request to the SQS queue.
 * The message body contains everything the workerInternal Lambda needs
 * to process the request without an extra DynamoDB read (Option A).
 *
 * @returns {Promise<string>} The SQS MessageId — stored in DynamoDB as sqsMessageId
 */
export const sendGenerationRequest = async ({ requestId, userId, tags, description }) => {
  const result = await client.send(new SendMessageCommand({
    QueueUrl: process.env.GENERATION_QUEUE_URL,
    // description is included so workerInternal can enrich the Gemini prompt
    // without an extra DynamoDB read
    MessageBody: JSON.stringify({ requestId, userId, tags, description }),
  }));
  return result.MessageId;
};
```

**`src/shared/rateLimit.js`**
```javascript
import { db, Tables } from './db.js';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Fixed-window rate limiter backed by DynamoDB.
 *
 * Key format: "{type}#{identifier}"
 *   e.g. "AI_GENERATION#cognito-sub-uuid"
 *        "API_REQUEST#cognito-sub-uuid"
 *
 * Strategy:
 *   - The window is identified by flooring the current Unix timestamp
 *     to the nearest windowSeconds bucket.
 *   - The DynamoDB key includes the bucket, so each window is a separate item.
 *   - Atomic ADD increments the counter. No read-before-write needed.
 *   - TTL is set to windowEnd + 60s to guarantee eventual cleanup.
 */
export const checkRateLimit = async (key, { max, windowSeconds }) => {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds); // current time bucket
  const windowKey = `${key}#${bucket}`;
  const windowEnd = (bucket + 1) * windowSeconds;

  const result = await db.send(new UpdateCommand({
    TableName: Tables.RATE_LIMIT,
    Key: { key: windowKey },
    UpdateExpression: 'ADD #count :one SET #ttl = if_not_exists(#ttl, :expiry)',
    ExpressionAttributeNames: {
      '#count': 'count',
      '#ttl': 'ttl',
    },
    ExpressionAttributeValues: {
      ':one': 1,
      ':expiry': windowEnd + 60, // 60s grace after window ends
    },
    ReturnValues: 'ALL_NEW',
  }));

  const count = result.Attributes?.count ?? 1;

  if (count > max) {
    throw new RateLimitError(
      `Rate limit exceeded: ${key} — ${count}/${max} requests in ${windowSeconds}s window`
    );
  }
};

export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}
```

### Lambda Handler Implementations

**`src/functions/getFeed.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { getFeedByUser } from '../shared/db.js';
import { ok, unauthorized, serverError } from '../shared/response.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const limit = Math.min(Number(event.queryStringParameters?.limit ?? 5), 10);
    const cursor = event.queryStringParameters?.cursor ?? null;

    const { items, cursor: nextCursor } = await getFeedByUser(userId, limit, cursor);

    return ok(event, {
      posts: items,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/requestPost.js`**
```javascript
import { v4 as uuidv4 } from 'uuid';
import { getUserId, AuthError } from '../shared/auth.js';
import { saveRequest, countPendingRequests, getUser } from '../shared/db.js';
import { sendGenerationRequest } from '../shared/sqs.js';
import { checkRateLimit, RateLimitError } from '../shared/rateLimit.js';
import { accepted, badRequest, unauthorized, tooManyRequests, serverError } from '../shared/response.js';
import { validate, feedRequestSchema, ValidationError } from '../shared/validators.js';

const MAX_PENDING_PER_USER = 5;

// Rate limit: max 10 AI generation requests per hour per user
const AI_RATE_LIMIT = { max: 10, windowSeconds: 3600 };

// Rate limit: max 100 general API requests per 15 minutes per user
const API_RATE_LIMIT = { max: 100, windowSeconds: 900 };

export const handler = async (event) => {
  try {
    const userId = getUserId(event);

    // General API rate limit — checked first (cheapest check)
    await checkRateLimit(`API_REQUEST#${userId}`, API_RATE_LIMIT);

    // AI generation rate limit — checked before the PENDING count query
    await checkRateLimit(`AI_GENERATION#${userId}`, AI_RATE_LIMIT);

    const body = JSON.parse(event.body ?? '{}');
    const { tags, quantity } = validate(feedRequestSchema, body);

    // Prevent a user from accumulating too many pending requests
    const pendingCount = await countPendingRequests(userId);
    if (pendingCount >= MAX_PENDING_PER_USER) {
      return tooManyRequests(event, `Please wait: you have ${pendingCount} generations in progress.`);
    }

    // Fetch user profile to include description in the generation context.
    // The description enriches the Gemini prompt for more relevant content.
    const user = await getUser(userId);
    const description = user?.description ?? null;

    // Create N requests in parallel:
    // 1. Send to SQS first → get MessageId
    // 2. Persist to DynamoDB with sqsMessageId linked — provides audit trail + throttle source
    const requests = await Promise.all(
      Array.from({ length: quantity }, async () => {
        const requestId = uuidv4();

        // Include description in SQS message — worker uses it to enrich the generation prompt
        const sqsMessageId = await sendGenerationRequest({ requestId, userId, tags, description });

        const request = {
          id: requestId,
          userId,
          tags,
          sqsMessageId,          // links this DynamoDB record to the SQS message
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 259200, // safety net: auto-delete after 3 days
        };

        await saveRequest(request);
        return request;
      })
    );

    return accepted(event, {
      requestIds: requests.map((r) => r.id),
      status: 'PENDING',
      message: `${quantity} post(s) being generated.`,
    });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    if (err instanceof RateLimitError) return tooManyRequests(event, err.message);
    if (err instanceof ValidationError) return badRequest(event, err.message);
    return serverError(event, err);
  }
};
```

**`src/functions/workerInternal.js`**
```javascript
import { v4 as uuidv4 } from 'uuid';
import { generatePost } from '../shared/gemini.js';
import { savePost, updateRequestStatus } from '../shared/db.js';

const MAX_RETRIES = 3;

export const handler = async (event) => {
  // SQS trigger — batchSize: 1 guarantees exactly one record per invocation.
  // Clean JSON body — no DynamoDB typed format to parse.
  for (const record of event.Records) {
    const { requestId, userId, tags, description } = JSON.parse(record.body);

    console.log(`[workerInternal] Processing request ${requestId} for user ${userId}`);

    // Mark as PROCESSING to prevent double-processing on visibility timeout retry
    await updateRequestStatus(requestId, 'PROCESSING', {
      processingAt: new Date().toISOString(),
    });

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        const postData = await generatePost({ tags, description });

        const post = {
          id: uuidv4(),
          userId,
          title: postData.title,
          summary: postData.summary,
          content: postData.content,
          tags: postData.tags,
          gradient: postData.gradient,
          createdAt: new Date().toISOString(),
          status: 'READY',
          ttl: Math.floor(Date.now() / 1000) + 7776000, // 90 days — removed when post is saved
        };

        await savePost(post);
        await updateRequestStatus(requestId, 'COMPLETED', {
          completedAt: new Date().toISOString(),
          postId: post.id,
          ttl: Math.floor(Date.now() / 1000) + 2592000, // retain for 30 days then auto-delete
        });

        console.log(`[workerInternal] Post ${post.id} created successfully`);
        break; // success — SQS auto-deletes the message on Lambda return
      } catch (err) {
        attempt++;
        console.error(`[workerInternal] Attempt ${attempt} failed:`, err.message);

        if (attempt >= MAX_RETRIES) {
          await updateRequestStatus(requestId, 'FAILED', {
            failedAt: new Date().toISOString(),
            errorMessage: err.message,
            ttl: Math.floor(Date.now() / 1000) + 604800, // retain for 7 days then auto-delete
          });
          // Throwing causes SQS to make the message visible again for retry.
          // After maxReceiveCount (3) retries, SQS routes it to the DLQ.
          throw err;
        }

        // Exponential backoff before next in-process retry
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
};
```

**`src/functions/getPost.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { getPostById } from '../shared/db.js';
import { ok, unauthorized, notFound, serverError } from '../shared/response.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.id;

    if (!postId) return notFound(event);

    const post = await getPostById(postId);

    if (!post) return notFound(event, 'Post not found');

    // Ensure the user can only access their own posts
    if (post.userId !== userId) return notFound(event, 'Post not found');

    return ok(event, post);
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/getPreferences.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { getUser, saveUser } from '../shared/db.js';
import { ok, unauthorized, serverError } from '../shared/response.js';
import { AVAILABLE_TAGS, DEFAULT_TAGS } from '../shared/constants.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const claims = event.requestContext?.authorizer?.claims;
    let user = await getUser(userId);

    if (!user) {
      // onUserSignup may have failed silently (DynamoDB was unavailable at signup time).
      // Recreate the profile now with default tags so the user experience is never broken.
      // The user will be redirected to /onboarding to set their real tags.
      console.warn(`[getPreferences] Profile missing for ${userId} — recreating with defaults`);
      user = {
        userId,
        email: claims?.email ?? '',
        activeTags: DEFAULT_TAGS,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      };
      await saveUser(user);
    }

    return ok(event, {
      userId: user.userId,
      description: user.description ?? null,
      activeTags: user.activeTags,
      availableTags: AVAILABLE_TAGS,
    });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/updatePreferences.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { updateUserTags } from '../shared/db.js';
import { ok, badRequest, unauthorized, serverError } from '../shared/response.js';
import { validate, updatePreferencesSchema, ValidationError } from '../shared/validators.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}');
    const { activeTags } = validate(updatePreferencesSchema, body);

    await updateUserTags(userId, activeTags);

    return ok(event, {
      activeTags,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    if (err instanceof ValidationError) return badRequest(event, err.message);
    return serverError(event, err);
  }
};
```

**`src/functions/updateProfile.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { updateUserProfile } from '../shared/db.js';
import { extractTagsFromDescription } from '../shared/gemini.js';
import { ok, badRequest, unauthorized, serverError } from '../shared/response.js';
import { validate, updateProfileSchema, ValidationError } from '../shared/validators.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body ?? '{}');
    const { description } = validate(updateProfileSchema, body);

    // Call Gemini synchronously to extract relevant tags from the description.
    // Only returns tags from AVAILABLE_TAGS — guaranteed to be valid for generation.
    const activeTags = await extractTagsFromDescription(description);

    // Persist description + AI-extracted tags in a single DynamoDB write
    await updateUserProfile(userId, description, activeTags);

    console.log(`[updateProfile] Extracted ${activeTags.length} tags for user ${userId}: ${activeTags.join(', ')}`);

    return ok(event, {
      description,
      activeTags,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    if (err instanceof ValidationError) return badRequest(event, err.message);
    return serverError(event, err);
  }
};
```

**`src/functions/onUserSignup.js`** — Cognito Post-Confirmation Trigger
```javascript
// Executed automatically by Cognito when a user confirms their email.
// Creates the user profile in DynamoDB with default tags.
// The user will be redirected to /onboarding to set their real interests.
import { saveUser } from '../shared/db.js';
import { DEFAULT_TAGS } from '../shared/constants.js';

export const handler = async (event) => {
  // event.request.userAttributes.sub = Cognito sub (our userId)
  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;

  try {
    const user = {
      userId,
      email,
      activeTags: DEFAULT_TAGS,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };

    await saveUser(user);
    console.log(`[onUserSignup] Profile created for ${userId} (${email})`);
  } catch (err) {
    // Log the error but do NOT rethrow — if we throw here, Cognito will
    // block the user's signup entirely.
    // If saveUser fails, getPreferences has an upsert fallback that recreates the profile.
    console.error(`[onUserSignup] Failed to create profile for ${userId}:`, err.message);
  }

  // Required: return the event intact so Cognito continues the confirmation flow
  return event;
};
```

**`src/functions/health.js`**
```javascript
// Public health check endpoint — no authentication required.
// Used by external monitors (UptimeRobot, Pingdom, etc.) and AWS Route 53 health checks.
import { ok } from '../shared/response.js';

export const handler = async (event) => {
  return ok(event, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    stage: process.env.STAGE ?? 'unknown',
  });
};
```

**`src/functions/savePost.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { markPostSaved } from '../shared/db.js';
import { ok, unauthorized, notFound, serverError } from '../shared/response.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.id;
    if (!postId) return notFound(event);

    await markPostSaved(postId, userId);

    return ok(event, {
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/unsavePost.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { markPostUnsaved } from '../shared/db.js';
import { ok, unauthorized, notFound, serverError } from '../shared/response.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const postId = event.pathParameters?.id;
    if (!postId) return notFound(event);

    await markPostUnsaved(postId, userId);

    return ok(event, { message: 'Post unsaved. TTL restored to 30 days.' });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    return serverError(event, err);
  }
};
```

**`src/functions/getSavedPosts.js`**
```javascript
import { getUserId, AuthError } from '../shared/auth.js';
import { getSavedByUser } from '../shared/db.js';
import { ok, unauthorized, serverError } from '../shared/response.js';

export const handler = async (event) => {
  try {
    const userId = getUserId(event);
    const limit = Math.min(Number(event.queryStringParameters?.limit ?? 20), 50);
    const cursor = event.queryStringParameters?.cursor ?? null;

    const { items, cursor: nextCursor } = await getSavedByUser(userId, limit, cursor);

    return ok(event, {
      posts: items,
      cursor: nextCursor,
      hasMore: nextCursor !== null,
    });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
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
| `AI_GENERATION#{userId}#{bucket}` | 10 requests | 1 hour | `requestPost.js` |
| `API_REQUEST#{userId}#{bucket}` | 100 requests | 15 min | `requestPost.js` |

> **Design:** The time bucket is embedded in the key (`floor(now / windowSeconds)`), so each
> time window is a separate item. No GSI needed — rate checks are always direct `GetItem`/`UpdateItem`
> by the full composite key. TTL ensures automatic cleanup with zero cost.

> **No GSI, no Scan** — the fixed-window strategy is a pure `UpdateItem` with atomic `ADD`.
> A single DynamoDB write handles both the increment and the 429 check in one round-trip.

#### 5.5 `SintoniaLegal` — Legal Documents (Terms of Use & Privacy Policy)

| Attribute | DynamoDB Type | Description |
|---|---|---|
| `type` **(PK)** | String | `"terms"` or `"privacy"` |
| `createdAt` **(SK)** | String | ISO 8601 — creation timestamp. Sort key enables natural ordering: `ScanIndexForward: false, Limit: 1` returns the current active version. |
| `version` | String | Human-readable version label (e.g. `"1.0"`, `"1.1"`). Used by the frontend in `GET /user/preferences` response comparison and displayed in the UI. |
| `content` | String | Full document content in Markdown. Served directly by `GET /legal/terms` and `GET /legal/privacy`. |
| `updatedAt` | String | ISO 8601 — date shown to the user in `LegalDocModal`. |

**Publishing a new version:** Insert a new item with `createdAt = now()` and the new `version` and `content`. No need to update or delete the previous row — the Lambda always queries with `ScanIndexForward: false, Limit: 1` to get the most recent. Old versions are retained for audit purposes.

**`getLegalTermsStatus` logic:**
1. Query `SintoniaLegal` for latest `terms` → get `version`
2. Query `SintoniaLegal` for latest `privacy` → get `version`
3. GetItem from `SintoniaUsers` → read `termsAcceptedVersion` and `privacyAcceptedVersion`
4. `needsAcceptance = termsLatest !== termsAcceptedVersion || privacyLatest !== privacyAcceptedVersion`

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
  "description": "Backend developer focused on AWS and distributed systems, learning Kubernetes and performance optimization.",
  "activeTags": ["AWS", "Node.js", "Kubernetes", "Performance", "Serverless"],
  "availableTags": [
    "AWS", "React", "TypeScript", "Node.js", "Python",
    "Docker", "Kubernetes", "Linux", "DynamoDB", "PostgreSQL",
    "Redis", "GraphQL", "Rust", "Go", "CI/CD",
    "Terraform", "Serverless", "Security", "Performance", "Architecture"
  ],
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
| `404 Not Found` | Post does not exist or belongs to another user |
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

Returns the current active Terms of Use document as Markdown. Called by `TermsAcceptanceModal` (blocking modal at login) and `LegalDocModal` (Legal tab in Profile).

**Response 200:**
```json
{
  "type": "terms",
  "version": "1.1",
  "updatedAt": "2026-06-01T00:00:00Z",
  "content": "## Terms of Use\n\n..."
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

Returns the current active Privacy Policy document. Same contract as `GET /legal/terms` with `"type": "privacy"`.

**Response 200:**
```json
{
  "type": "privacy",
  "version": "1.0",
  "updatedAt": "2026-06-01T00:00:00Z",
  "content": "## Privacy Policy\n\n..."
}
```

**Possible errors:** same as `GET /legal/terms`.

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
// src/types/index.ts

export interface Post {
  id: string;
  title: string;
  summary: string;
  content?: string;         // Only present after GET /post/:id
  tags: string[];
  gradient: [string, string];
  createdAt: string;        // ISO 8601
  savedAt?: string;         // ISO 8601 — present when the post is saved by the user
}

export interface SavedPostsResponse {
  posts: Post[];
  cursor: string | null;
  hasMore: boolean;
}

export interface UserPreferences {
  userId: string;
  description: string | null;   // Free-text profile description
  activeTags: string[];         // AI-extracted tags the user has enabled
  availableTags: string[];      // Full list of possible tags (AVAILABLE_TAGS)
}

export interface FeedResponse {
  posts: Post[];
  cursor: string | null;
  hasMore: boolean;
}

export interface GenerationResponse {
  requestIds: string[];
  status: 'PENDING';
  message: string;
}

export const AVAILABLE_TAGS = [
  'AWS', 'React', 'TypeScript', 'Node.js', 'Python',
  'Docker', 'Kubernetes', 'Linux', 'DynamoDB', 'PostgreSQL',
  'Redis', 'GraphQL', 'Rust', 'Go', 'CI/CD',
  'Terraform', 'Serverless', 'Security', 'Performance', 'Architecture',
] as const;

export type Tag = typeof AVAILABLE_TAGS[number];

/** Visual theme applied to the application. Persisted in syntonia-preferences. */
export type Theme = 'dark' | 'light';

/** UI language. Persisted in syntonia-preferences. Drives Gemini prompt language in production. */
export type Language = 'en' | 'pt-BR';

/** Client-only preferences stored in usePreferencesStore (localStorage: syntonia-preferences). */
export interface UserPreferencesLocal {
  readonly theme: Theme;
  readonly language: Language;
}
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
  3. Tries callGemini(PRIMARY_MODEL, buildPrompt(tags, description))
     └── fails? → callGemini(FALLBACK_MODEL)
     └── fails again? → in-process retry with backoff (max 3x)
     └── definitive failure?
           → UpdateItem: status → FAILED
           → throw err → SQS makes message visible → retries
           → after 3 SQS deliveries → routes to GenerationDLQ
  4. parseGeminiResponse(raw) — validates JSON + required fields
  5. PutItem SintoniaFeed:
     { id (new UUID), userId, title, summary, content, tags, gradient,
       createdAt, status: 'READY',
       ttl: now + 90 days }   ← auto-deleted unless user saves the post
  6. UpdateItem SintoniaRequests[requestId]:
     { status: 'COMPLETED', completedAt, postId }
  7. Lambda returns without error → SQS auto-deletes the message
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

provider:
  name: aws
  runtime: nodejs22.x
  region: sa-east-1          # São Paulo — lowest latency for Brazilian users
  stage: ${opt:stage, 'dev'} # Default: dev. Production: --stage prod

  # Environment variables available to ALL Lambda functions
  environment:
    STAGE: ${self:provider.stage}
    FEED_TABLE: SintoniaFeed-${self:provider.stage}
    REQUESTS_TABLE: SintoniaRequests-${self:provider.stage}
    USERS_TABLE: SintoniaUsers-${self:provider.stage}
    GENERATION_QUEUE_URL: !Ref GenerationQueue
    RATE_LIMIT_TABLE: SintoniaRateLimit-${self:provider.stage}
    # Secret read from SSM Parameter Store at deploy time
    GEMINI_API_KEY: ${ssm:/syntonia/${self:provider.stage}/gemini-api-key}

  # Shared IAM role across all Lambda functions (least privilege)
  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - dynamodb:PutItem
            - dynamodb:GetItem
            - dynamodb:UpdateItem
            - dynamodb:Query
          Resource:
            - arn:aws:dynamodb:${self:provider.region}:*:table/SintoniaFeed-${self:provider.stage}
            - arn:aws:dynamodb:${self:provider.region}:*:table/SintoniaFeed-${self:provider.stage}/index/*
            - arn:aws:dynamodb:${self:provider.region}:*:table/SintoniaRequests-${self:provider.stage}
            - arn:aws:dynamodb:${self:provider.region}:*:table/SintoniaRequests-${self:provider.stage}/index/*
            - arn:aws:dynamodb:${self:provider.region}:*:table/SintoniaUsers-${self:provider.stage}
            - arn:aws:dynamodb:${self:provider.region}:*:table/SintoniaRateLimit-${self:provider.stage}
        - Effect: Allow
          Action:
            - ssm:GetParameter
          Resource:
            - arn:aws:ssm:${self:provider.region}:*:parameter/syntonia/${self:provider.stage}/*
        # Note: Cognito invokes onUserSignup via AWS::Lambda::Permission (Resource Policy),
        # not via IAM role. No lambda:InvokeFunction permission needed here.
        - Effect: Allow
          Action:
            - sqs:SendMessage           # requestPost sends generation requests
          Resource:
            - !GetAtt GenerationQueue.Arn
        - Effect: Allow
          Action:
            - sqs:ReceiveMessage        # workerInternal consumes messages
            - sqs:DeleteMessage
            - sqs:GetQueueAttributes
          Resource:
            - !GetAtt GenerationQueue.Arn

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
    timeout: 5
    description: "Public health check endpoint"
    events:
      - http:
          path: health
          method: get
          cors: true

  savePost:
    handler: src/functions/savePost.handler
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
    timeout: 10
    description: "Creates user profile in DynamoDB after email confirmation"
    # No HTTP event — invoked directly by Cognito

resources:
  Resources:

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
└── backend/                           # Serverless Framework
    ├── package.json
    ├── serverless.yml                 # Complete IaC
    ├── .env.local                     # GEMINI_API_KEY for local dev (NEVER committed)
    ├── .env.example                   # Variable template (committed)
    ├── .gitignore
    └── src/
        ├── functions/
        │   ├── getFeed.js             # GET /feed
        │   ├── requestPost.js         # POST /feed/request (fetches description for SQS payload)
        │   ├── getPost.js             # GET /post/{id}
        │   ├── savePost.js            # POST /post/{id}/save
        │   ├── unsavePost.js          # DELETE /post/{id}/save
        │   ├── getSavedPosts.js       # GET /posts/saved
        │   ├── getPreferences.js      # GET /user/preferences (with upsert fallback)
        │   ├── updatePreferences.js   # PUT /user/preferences (tag enable/disable)
        │   ├── updateProfile.js       # PUT /user/profile (description → AI tag extraction)
        │   ├── health.js              # GET /health (public)
        │   ├── workerInternal.js      # SQS trigger → Gemini → DynamoDB
        │   └── onUserSignup.js        # Cognito Post-Confirmation Trigger
        └── shared/
            ├── db.js                  # DynamoDB client + all operations
            ├── gemini.js              # Gemini client + prompt builder + parser
            ├── sqs.js                 # SQS client + sendGenerationRequest
            ├── rateLimit.js           # Fixed-window rate limiter (DynamoDB-backed)
            ├── auth.js                # userId extraction from JWT
            ├── response.js            # HTTP response helpers + CORS
            ├── validators.js          # Zod schemas
            └── constants.js           # AVAILABLE_TAGS and other constants
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
| **Staging** | `dev` | `dev` | `https://dev.syntonia.app` |

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
/aws/lambda/syntonia-backend-{stage}-getPreferences
/aws/lambda/syntonia-backend-{stage}-updatePreferences
/aws/lambda/syntonia-backend-{stage}-updateProfile
/aws/lambda/syntonia-backend-{stage}-health
/aws/lambda/syntonia-backend-{stage}-onUserSignup
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

All handlers follow a structured logging convention:

```javascript
// Success
console.log(`[workerInternal] Post ${post.id} created successfully`);

// Captured error
console.error(`[workerInternal] Attempt ${attempt} failed:`, err.message);

// serverError helper logs automatically
console.error('[SERVER ERROR]', err);
```

**CloudWatch Logs Insights queries:**
```
# Posts generated per hour
fields @timestamp, @message
| filter @message like /Post .+ created successfully/
| stats count() as postsCreated by bin(1h)

# Worker errors
fields @timestamp, @message
| filter @message like /Attempt .+ failed/
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
- [x] CORS explicitly configured for allowed domains only (no `*`)
- [x] `PreventUserExistenceErrors: ENABLED` on Cognito Client — does not reveal if email exists
- [x] `GenerateSecret: false` on Cognito Client — SPA does not use client secret

### Secrets & Configuration
- [x] `GEMINI_API_KEY` stored in SSM Parameter Store as `SecureString` (KMS encrypted)
- [x] `.env.local` listed in `.gitignore` on both projects
- [x] `VITE_*` variables are public by design — **no secrets reach the frontend**
- [x] CI/CD IAM user with minimum privilege policy (only what is needed)

### Data & Database
- [x] All Lambda functions share a single IAM role scoped to only the DynamoDB tables and SQS resources they collectively need
- [x] `getPost` verifies `post.userId === userId` — users can only access their own posts
- [x] `requestPost` checks PENDING requests to prevent abuse (429 if >= 5)
- [x] Zod schema validation on all Lambda inputs
- [ ] **Phase 2 improvement:** Consider per-function IAM roles to enforce least-privilege at the individual Lambda level (e.g., `health` and `getFeed` should not have `sqs:SendMessage`)

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
