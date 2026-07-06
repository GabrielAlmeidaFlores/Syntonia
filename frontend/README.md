# Syntonia Frontend

React SPA delivering the Syntonia feed — vertical snap-scroll, AI-generated articles, dark/light themes, EN/PT-BR i18n. Zero real API calls in development; MSW intercepts everything.

→ [Root README](../README.md) · [Architecture reference](../ARCHITECTURE.md)

## Stack

| | |
|---|---|
| Framework | React 18 · Vite 6 |
| Language | TypeScript 5.7 — strict mode, zero `any` |
| Styling | Tailwind CSS 3.4 · Radix UI (headless primitives) · CVA (variant system) |
| State | Zustand 5 (with localStorage persistence) |
| Routing | React Router 6 |
| Auth | AWS Amplify 6 — Cognito User Pool |
| Animation | Framer Motion 11 |
| Markdown | react-markdown + rehype-highlight + highlight.js |
| Mocking | MSW 2 (dev mode only) |

## Prerequisites

- Node.js 22+
- Yarn 1.22

## Setup

```bash
yarn install
cp .env.example .env.local   # fill in values — see Environment variables below
```

## Running locally

```bash
# Development — all API calls intercepted by MSW (no backend or AWS account needed)
yarn dev

# Development — pointing at the deployed backend (real Cognito auth + real API)
yarn dev --mode production
```

## Scripts

| Script | Description |
|---|---|
| `yarn dev` | Dev server at port 5173 (MSW mock mode) |
| `yarn build` | Type-check + production build → `dist/` |
| `yarn typecheck` | TypeScript type-check only (`tsc --noEmit`) |
| `yarn lint` | ESLint — zero warnings required (`--max-warnings 0`) |
| `yarn format` | Prettier auto-format |

## AWS infrastructure

### Cognito (authentication)

The app authenticates via AWS Cognito using the Amplify SDK (`@aws-amplify/auth`). Cognito is configured at app boot in `src/lib/cognito.ts` using the environment variables below.

| Property | Value |
|---|---|
| Region | `sa-east-1` |
| Client secret | None (public SPA client) |
| Auth flows | SRP + USER_PASSWORD_AUTH + REFRESH_TOKEN |
| Token validity | IdToken 1h · AccessToken 1h · RefreshToken 30d |

User Pool ID and Client ID are retrieved from the backend CloudFormation stack outputs after deploy (`npx serverless@3 info --stage <stage>`).

The Cognito JWT (`idToken`) is attached as the `Authorization` header on every API request. API Gateway validates it before the Lambda runs — no auth logic exists inside the handlers.

**Sign-up flow:**
`signUp()` → Cognito sends a 6-digit verification email → `confirmSignUp()` → Cognito fires `PostConfirmation` trigger → `onUserSignup` Lambda creates user profile in DynamoDB → auto sign-in.

### API Gateway

The API base URL is injected via `VITE_API_URL` at build time. All requests go through `src/services/api.ts`, which automatically attaches the Cognito token from the auth store.

| Property | Value |
|---|---|
| Auth | Cognito JWT via `Authorization` header |
| CORS | `*` (configurable via `CORS_ORIGINS` on the backend) |

### AWS Amplify (hosting)

The frontend is hosted on AWS Amplify. The build configuration is defined in `amplify.yml` at the repository root: `yarn install` + `yarn build` → publishes `dist/`.

**Manual deploy:**

```bash
# 1. Build
yarn build

# 2. Create deployment + get upload URL
aws amplify create-deployment \
  --app-id <amplify-app-id> --branch-name <branch> --region sa-east-1

# 3. Zip and upload
cd dist && zip -r ../dist.zip . && cd .. && \
curl -X PUT -H "Content-Type: application/zip" \
  --data-binary @dist.zip "<zipUploadUrl>"

# 4. Start deployment
aws amplify start-deployment \
  --app-id <amplify-app-id> --branch-name <branch> --job-id <jobId>
```

## Environment variables (`.env.local`)

| Variable | Description | Required in `yarn dev` |
|---|---|---|
| `VITE_API_URL` | API Gateway base URL | No (MSW intercepts) |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | No (MSW intercepts) |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID | No (MSW intercepts) |
| `VITE_AWS_REGION` | AWS region | No (MSW intercepts) |

All variables are required when running `yarn dev --mode production` or deploying to Amplify. Values are obtained from the backend stack outputs after deploy.

> `VITE_MODE` is Vite's built-in `MODE` variable — `"development"` in `yarn dev`, `"production"` in `yarn build` and `yarn dev --mode production`. It controls whether MSW starts and which auth path is used (mock vs real Cognito).

## Project structure

```
src/
├── app/          Root component — theme sync, terms check, max-width layout
├── features/     One folder per page
│   ├── auth/        Login, sign-up, confirm, forgot/reset password
│   ├── onboarding/  First-run description + tag confirmation
│   ├── feed/        Snap-scroll feed, post cards, post detail
│   ├── saved/       Saved posts grid + saved feed
│   ├── profile/     Profile, tag manager, settings, legal tab
│   └── post/        Deep-link single post view (/post/:id)
├── components/
│   ├── ui/       Design system — Button, Input, Badge, Card, Modal, Toast, ...
│   └── shared/   Cross-feature screens — EmptyFeedScreen, FeedInitialLoading, Spinner
├── hooks/        useFeed, useJIT, useSavedPosts, useTranslation, useSnapNavigation, ...
├── stores/       Zustand stores — auth, feed, user, preferences, history, saved, liked, toast, terms
├── mocks/        MSW handlers + fixture data (used in yarn dev only)
├── lib/          env.ts, cache.ts, i18n.ts, utils.ts, constants.ts, cognito.ts
├── services/     api.ts — central HTTP client (attaches JWT, maps error codes)
├── styles/       globals.css — Tailwind base + CSS variable design tokens
└── types/        Post, Tag, ApiErrorCode, UserProfile, FeedResponse, ...
```
