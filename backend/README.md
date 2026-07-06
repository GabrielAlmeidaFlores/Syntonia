# Syntonia Backend

Serverless REST API powering the Syntonia feed. 17 Lambda functions behind AWS API Gateway, backed by DynamoDB and SQS, with Google Gemini for AI content generation.

→ [Root README](../README.md) · [Architecture reference](../ARCHITECTURE.md)

## Stack

| | |
|---|---|
| Runtime | Node.js 20.x (Lambda) / Node.js 22 (local dev) |
| Language | TypeScript 5.7 — strict mode, zero `any` |
| Framework | Serverless Framework v3 + serverless-esbuild (CommonJS output) |
| Database | DynamoDB (PAY_PER_REQUEST) |
| Queue | SQS — JIT content generation pipeline |
| Auth | Cognito JWT validated by API Gateway (COGNITO_USER_POOLS authorizer) |
| AI | Google Gemini 2.5 Flash / Pro via `@google/generative-ai` |

## Prerequisites

- Node.js 22+
- npm
- AWS CLI configured with a named profile and permissions for Lambda, DynamoDB, SQS, Cognito, SSM, CloudWatch
- Gemini API key stored in SSM: `/syntonia/{stage}/gemini-api-key` (SecureString)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in dev values
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Local API at port 3000 via serverless-offline |
| `npm run build` | TypeScript type-check only (`tsc --noEmit`) |
| `npm run deploy:dev` | Deploy to AWS dev stage |
| `npm run deploy:prod` | Deploy to AWS prod stage |
| `npm run seed:legal` | Seed Terms + Privacy Policy into SintoniaLegal table |
| `npm run logs:worker` | Tail workerInternal Lambda logs in real time |

## AWS infrastructure

All resources are defined in `serverless.yml` and provisioned via CloudFormation on deploy. After deploying, run `npx serverless@3 info --stage <stage>` to retrieve output values (API endpoint, Cognito IDs, Queue URL).

### Region & stages

| | |
|---|---|
| Region | `sa-east-1` (São Paulo) |
| Stages | `dev` (default) · `prod` |
| CloudFormation stack | `syntonia-backend-{stage}` |

### API Gateway

- REST API provisioned by Serverless Framework
- **Authorizer:** `SyntoniaCognitoAuthorizer` — type `COGNITO_USER_POOLS`, reads `Authorization` header
- All endpoints authenticated via Cognito JWT except `GET /health`
- CORS enabled on all endpoints

### Cognito User Pool

| Property | Value |
|---|---|
| Pool name | `syntonia-users-{stage}` |
| Username attribute | Email |
| Auto-verified attribute | Email |
| Password policy | Min 8 chars · requires numbers · uppercase/symbols not required |
| Token validity | IdToken 1h · AccessToken 1h · RefreshToken 30d |
| Auth flows | `USER_SRP_AUTH` · `USER_PASSWORD_AUTH` · `REFRESH_TOKEN_AUTH` |
| Client secret | None (public SPA client) |
| PostConfirmation trigger | `onUserSignup` Lambda — creates user profile in DynamoDB |

User Pool ID and Client ID are available in the CloudFormation stack outputs after deploy.

### Lambda functions

| Function | Timeout | Trigger | Description |
|---|---|---|---|
| `health` | 5s | HTTP GET /health | Public health check |
| `getFeed` | 10s | HTTP GET /feed | Paginated post feed |
| `requestPost` | 10s | HTTP POST /feed/request | Enqueue JIT generation |
| `getPost` | 10s | HTTP GET /post/{id} | Single post |
| `savePost` | 10s | HTTP POST /post/{id}/save | Save post |
| `unsavePost` | 10s | HTTP DELETE /post/{id}/save | Unsave post |
| `likePost` | 10s | HTTP POST /post/{id}/like | Like post |
| `unlikePost` | 10s | HTTP DELETE /post/{id}/like | Unlike post |
| `getSavedPosts` | 10s | HTTP GET /posts/saved | User's saved posts |
| `getPreferences` | 10s | HTTP GET /user/preferences | Get profile + tags |
| `updatePreferences` | 10s | HTTP PUT /user/preferences | Update theme/language/tags |
| `updateProfile` | 29s | HTTP PUT /user/profile | Description → Gemini tag extraction |
| `getLegalTermsStatus` | 5s | HTTP GET /legal/terms-status | Terms acceptance check |
| `getLegalDocument` | 5s | HTTP GET /legal/{type} | Fetch terms/privacy doc |
| `acceptLegalTerms` | 5s | HTTP POST /legal/accept | Accept current terms |
| `workerInternal` | 60s | SQS `GenerationQueue` (batchSize: 1) | Gemini post generation |
| `onUserSignup` | 10s | Cognito PostConfirmation trigger | Create user profile |

- Each Lambda has its own dedicated IAM role with least-privilege permissions
- Log retention: 14 days across all functions

### DynamoDB tables

All tables use `PAY_PER_REQUEST` billing.

**`SintoniaFeed-{stage}`** — AI-generated posts

| Key | Type | Notes |
|---|---|---|
| `id` (PK) | String | UUID v4 |
| TTL field | `ttl` | Unix timestamp — posts expire after 90 days; removed when saved |

GSIs:
- `userId-createdAt-index` — PK: `userId`, SK: `createdAt` · used by `getFeed` and `workerInternal`
- `userId-savedAt-index` — PK: `userId`, SK: `savedAt` · used by `getSavedPosts`

**`SintoniaUsers-{stage}`** — User profiles and preferences

| Key | Type | Notes |
|---|---|---|
| `userId` (PK) | String | Cognito `sub` claim |

Key fields: `email`, `description`, `activeTags`, `theme`, `language`, `termsAcceptedVersion`, `privacyAcceptedVersion`.

**`SintoniaRequests-{stage}`** — Generation request tracking and throttle

| Key | Type | Notes |
|---|---|---|
| `id` (PK) | String | UUID v4 |
| TTL field | `ttl` | Auto-expiry per status |

GSI:
- `userId-status-index` — PK: `userId`, SK: `status` · used to count pending requests for throttling

**`SintoniaRateLimit-{stage}`** — Fixed-window rate limit counters

| Key | Type | Notes |
|---|---|---|
| `key` (PK) | String | `{type}#{userId}#{window_bucket}` |
| TTL field | `ttl` | Auto-expiry after window closes |

**`SintoniaLegal-{stage}`** — Terms of Use and Privacy Policy documents

| Key | Type | Notes |
|---|---|---|
| `typeLanguage` (PK) | String | `"terms#en"` · `"terms#pt-BR"` · `"privacy#en"` · `"privacy#pt-BR"` |
| `createdAt` (SK) | String | ISO 8601 — newest item = active version |

### SQS queues

**`syntonia-generation-{stage}`** — Main generation queue

| Property | Value |
|---|---|
| VisibilityTimeout | 120s (must exceed workerInternal timeout of 60s) |
| MessageRetentionPeriod | 86400s (1 day) |
| Dead-letter queue | `syntonia-generation-dlq-{stage}` |
| maxReceiveCount | 3 — message moved to DLQ after 3 failed attempts |

**`syntonia-generation-dlq-{stage}`** — Dead-letter queue

| Property | Value |
|---|---|
| MessageRetentionPeriod | 1209600s (14 days) |

### SSM Parameter Store

| Parameter | Type | Description |
|---|---|---|
| `/syntonia/{stage}/gemini-api-key` | SecureString (KMS) | Google Gemini API key |

Create before first deploy:

```bash
aws ssm put-parameter \
  --name "/syntonia/dev/gemini-api-key" \
  --value "AIzaSy..." \
  --type SecureString \
  --region sa-east-1 \
  --profile <your-aws-profile>
```

### CloudWatch Alarms

| Alarm | Condition |
|---|---|
| `syntonia-worker-errors-{stage}` | workerInternal errors ≥ 3 in 5 minutes |
| `syntonia-dlq-messages-{stage}` | Any message visible in GenerationDLQ |
| `syntonia-api-latency-{stage}` | getFeed p95 latency > 3000ms |

## Environment variables

All variables are centralised in `src/shared/core/env.ts`. Never access `process.env` directly elsewhere.

| Variable | Source (production) | Description |
|---|---|---|
| `GEMINI_API_KEY` | SSM `/syntonia/{stage}/gemini-api-key` | Gemini API key |
| `FEED_TABLE` | serverless.yml | DynamoDB table name |
| `REQUESTS_TABLE` | serverless.yml | DynamoDB table name |
| `USERS_TABLE` | serverless.yml | DynamoDB table name |
| `RATE_LIMIT_TABLE` | serverless.yml | DynamoDB table name |
| `LEGAL_TABLE` | serverless.yml | DynamoDB table name |
| `GENERATION_QUEUE_URL` | serverless.yml (`!Ref GenerationQueue`) | SQS queue URL |
| `STAGE` | serverless.yml | Deployment stage |
| `CORS_ORIGINS` | serverless.yml | Allowed CORS origins (default: `*`) |

## API endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/feed` | ✓ | Paginated post feed (`?limit`, `?cursor`, `?after`) |
| POST | `/feed/request` | ✓ | Trigger JIT post generation |
| GET | `/post/{id}` | ✓ | Single post by ID |
| POST | `/post/{id}/save` | ✓ | Save a post |
| DELETE | `/post/{id}/save` | ✓ | Unsave a post |
| POST | `/post/{id}/like` | ✓ | Like a post |
| DELETE | `/post/{id}/like` | ✓ | Unlike a post |
| GET | `/posts/saved` | ✓ | User's saved posts (paginated) |
| GET | `/user/preferences` | ✓ | User profile, active tags, theme, language |
| PUT | `/user/preferences` | ✓ | Update theme / language / active tags |
| PUT | `/user/profile` | ✓ | Update description → Gemini tag extraction |
| GET | `/legal/terms-status` | ✓ | Whether user needs to accept updated terms |
| GET | `/legal/{type}` | ✓ | Fetch `terms` or `privacy` document (`?lang=`) |
| POST | `/legal/accept` | ✓ | Accept current terms and privacy versions |

## Project structure

```
src/
├── functions/    17 Lambda handlers (kebab-case, one file per endpoint)
└── shared/
    ├── core/     Types, env, logger, default values
    ├── db/       All DynamoDB operations (single file)
    ├── http/     Auth extraction, response builders, Zod validators, rate limiter
    ├── ai/       Gemini client — generatePost(), extractTagsFromDescription()
    └── queue/    SQS message dispatch — sendGenerationRequest()
```
