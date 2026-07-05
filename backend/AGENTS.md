# AGENTS.md — Syntonia Backend

> **MANDATORY:** Read this file completely before writing a single line of code. No exceptions.

---

## §1 — AI Agent Premise

Every AI agent working on this backend must follow this exact sequence:

1. **Read AGENTS.md** (this file) in full.
2. **Read the relevant sections of `../ARCHITECTURE.md`** (§4–§8, §12, §13).
3. **Map the files** relevant to the task using §3 of this document.
4. **Plan** — write out what you will create/modify before touching any file.
5. **Implement** — follow every rule in this document without exception.
6. **Typecheck** — `npm run build` → zero errors before finishing.
7. **Update AGENTS.md** — if you add a function, handler, or shared module, document it here.

**There are no exceptions to this flow.**

---

## §2 — Stack

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 22.x | Lambda runtime |
| **TypeScript** | 5.7.x | Strict mode — zero `any`, full type safety |
| **Serverless Framework** | v4 | IaC + deployment |
| **serverless-esbuild** | 1.50.x | TypeScript compilation + fast Lambda bundling (CommonJS output) |
| **serverless-offline** | 13.x | Local API Gateway + Lambda simulation |
| **@google/generative-ai** | 0.15.x | Gemini SDK |
| **@aws-sdk/client-dynamodb** | 3.600.x | DynamoDB client |
| **@aws-sdk/lib-dynamodb** | 3.600.x | DocumentClient |
| **@aws-sdk/client-sqs** | 3.600.x | SQS client |
| **zod** | 3.23.x | Input schema validation |
| **uuid** | 9.x | UUID v4 generation |

**Node version:** 22.x | **Package manager:** npm

**Key principle:** Zero real calls to external services in tests. All DynamoDB/SQS/Gemini calls go through the shared module functions, making them easy to mock.

---

## §3 — Directory Structure

```
backend/
├── package.json              # Dependencies + scripts
├── tsconfig.json             # strict: true, target ES2022, module NodeNext
├── serverless.yml            # Complete IaC — all AWS resources + functions
├── .env.local                # Local dev secrets (NEVER committed)
├── .env.example              # Template (committed)
├── .gitignore
├── scripts/
│   └── seed-legal.ts         # Seeds SintoniaLegal table with v1.0 Terms + Privacy docs
└── src/
    ├── functions/            # 15 Lambda handlers
    │   ├── getFeed.ts               # GET /feed
    │   ├── requestPost.ts           # POST /feed/request
    │   ├── getPost.ts               # GET /post/{id}
    │   ├── savePost.ts              # POST /post/{id}/save
    │   ├── unsavePost.ts            # DELETE /post/{id}/save
    │   ├── getSavedPosts.ts         # GET /posts/saved
    │   ├── getPreferences.ts        # GET /user/preferences
    │   ├── updatePreferences.ts     # PUT /user/preferences (patch)
    │   ├── updateProfile.ts         # PUT /user/profile
    │   ├── health.ts                # GET /health (public)
    │   ├── workerInternal.ts        # SQS → Gemini → DynamoDB
    │   ├── onUserSignup.ts          # Cognito Post-Confirmation Trigger
    │   ├── getLegalTermsStatus.ts   # GET /legal/terms-status
    │   ├── getLegalDocument.ts      # GET /legal/{type}
    │   └── acceptLegalTerms.ts      # POST /legal/accept
    └── shared/               # Reusable modules — organized by domain
        ├── core/
        │   ├── types/            # One file per type/interface (see §4c)
        │   ├── env.ts            # ALL environment variables — single source of truth
        │   ├── tables.ts         # Tables — DynamoDB table names (reads from env.ts)
        │   ├── default-tags.ts   # DEFAULT_TAGS + DEFAULT_DESCRIPTION
        │   └── logger.ts         # createLogger(), Logger interface, LogLevel
        ├── http/
        │   ├── auth.ts           # getUserId(), getUserEmail(), AuthError
        │   ├── response.ts       # ok(), badRequest(), notFound(), serverError() + CORS
        │   ├── validators.ts     # Zod schemas, validate(), ValidationError
        │   └── rateLimit.ts      # checkRateLimit(), RateLimitError
        ├── db/
        │   └── index.ts          # All DynamoDB operations (feed, users, requests, legal)
        ├── ai/
        │   └── gemini.ts         # generatePost(), extractTagsFromDescription(), GeminiError
        └── queue/
            └── sqs.ts            # sendGenerationRequest() → GenerationQueue
```

---

## §4 — TypeScript Rules

These rules are enforced by `tsconfig.json`. **Never relax them.**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "useUnknownInCatchVariables": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "allowJs": false,
    "checkJs": false,
    "suppressExcessPropertyErrors": false,
    "suppressImplicitAnyIndexErrors": false,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "scripts"]
}
```

> `noEmit: true` because `tsc` is used only for type-checking. esbuild handles the actual compilation and bundling at deploy time.

**Critical rules:**

1. **No `any`** — use `unknown` + type guards.
2. **`import type` for all type-only imports.**
3. **Explicit return types on all exported functions.**
4. **No non-null assertions (`!`)** — use optional chaining or type guards.
5. **`as const` for literal arrays** — `['AWS', 'TypeScript'] as const`.
6. **Never access `process.env.X` directly in handlers** — use `Tables` from `constants.ts`; for other env vars, read at module level with a guard.
7. **File extension in imports**: use `.js` in import paths even for `.ts` source files (required by `module: NodeNext`).

```typescript
// ✓ correct
import { getUserId } from '../shared/http/auth.js';
import type { UserRecord } from '../shared/core/types.js';

// ✗ wrong — missing .js extension
import { getUserId } from '../shared/http/auth';
```

---

## §4b — Structured Logger (src/shared/core/logger.ts)

Every Lambda handler MUST use `createLogger` from `src/shared/core/logger.ts`. Plain `console.log` is forbidden in handlers — use the structured logger instead.

### Usage pattern

```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createLogger } from '../shared/core/logger.js';

export const handler = async (
  event: APIGatewayProxyEvent,
  ctx: Context,              // ← ALWAYS include Context — gives requestId + remainingMs
): Promise<APIGatewayProxyResult> => {
  const log = createLogger('myFunction', ctx);
  const stop = log.timer();  // optional: measure total handler duration

  try {
    const userId = getUserId(event);
    log.info('Handler started', { userId });

    // child logger scopes extra fields to every subsequent entry
    const reqLog = log.child({ userId, postId: 'abc' });
    reqLog.debug('About to query DynamoDB');

    const result = await doWork();
    stop('Handler completed', { resultCount: result.length });   // logs durationMs automatically

    return ok(event, result);
  } catch (err) {
    log.error('Handler failed', err);   // serializes full Error with stack trace
    return serverError(event, err);
  }
};
```

### API

| Method | When to use |
|---|---|
| `log.debug(msg, extra?)` | Low-level detail (DynamoDB params, intermediate values). Suppressed in prod when `LOG_LEVEL=INFO`. |
| `log.info(msg, extra?)` | Normal operations: request received, result returned, important decisions. |
| `log.warn(msg, extra?)` | Non-fatal unexpected events: fallback used, upsert triggered, access denied. |
| `log.error(msg, err?, extra?)` | Exceptions and failures. Serializes the full error including `stack` as an array. |
| `log.timer()` | Returns a function `stop(label, extra?)` that adds `durationMs` to the entry on call. |
| `log.child(extra)` | Creates a child logger that merges `extra` into every entry. Use for request-scoped context. |

### Output format

Every entry is a single JSON line to stdout/stderr:

```json
{
  "level": "INFO",
  "timestamp": "2026-07-05T14:00:00.000Z",
  "message": "Feed query completed",
  "fn": "getFeed",
  "stage": "dev",
  "requestId": "abc-123",
  "remainingMs": 9850,
  "memoryMb": 512,
  "userId": "cognito-sub",
  "count": 5,
  "hasMore": true,
  "durationMs": 142
}
```

CloudWatch Logs Insights query to find all logs for a request:
```
fields @timestamp, level, message, fn, userId, durationMs
| filter requestId = "abc-123"
| sort @timestamp asc
```

### Log level control

Set `LOG_LEVEL` environment variable:
- `DEBUG` — all entries (use in `.env.local` for verbose local debugging)
- `INFO` — default in production (operational events only)
- `WARN` — warnings + errors only
- `ERROR` — errors only

### Rules

1. **All handlers MUST add `ctx: Context` as second parameter** — required to capture `requestId` and `remainingMs`.
2. **Always call `createLogger` at the top of the handler** before any business logic.
3. **Use `log.child({ userId })` early** so all subsequent entries include `userId`.
4. **Use `log.timer()`** on any operation with meaningful latency (Gemini, DynamoDB queries).
5. **Never log sensitive data** — no passwords, tokens, or full request bodies.

---

## §5 — Naming Conventions

| Category | Convention | Example |
|---|---|---|
| Handler files | `camelCase.ts` | `getFeed.ts` |
| Shared module files | `camelCase.ts` | `rateLimit.ts` |
| Exported functions | `camelCase` | `getFeedByUser` |
| Exported classes | `PascalCase` | `AuthError` |
| Types/Interfaces | `PascalCase` | `UserRecord`, `LegalDocument` |
| Constants | `SCREAMING_SNAKE_CASE` | `AVAILABLE_TAGS` |
| Lambda handler export | always `handler` | `export const handler = async ...` |

---

## §6 — Lambda Handler Pattern

Every handler follows this exact structure:

```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AuthError, getUserId } from '../shared/http/auth.js';
import { RateLimitError } from '../shared/http/rateLimit.js';
import { ok, unauthorized, badRequest, tooManyRequests, serverError } from '../shared/http/response.js';
import { ValidationError, validate, someSchema } from '../shared/http/validators.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = getUserId(event);  // ALWAYS first for authenticated routes

    const body = JSON.parse(event.body ?? '{}') as unknown;
    const { field } = validate(someSchema, body);

    // ... business logic

    return ok(event, { result: field });
  } catch (err) {
    if (err instanceof AuthError) return unauthorized(event);
    if (err instanceof ValidationError) return badRequest(event, err.message);
    if (err instanceof RateLimitError) return tooManyRequests(event, err.message, 'RATE_LIMIT_EXCEEDED');
    return serverError(event, err);
  }
};
```

**Rules:**
- `getUserId(event)` is ALWAYS the FIRST call in authenticated handlers.
- `userId` is ALWAYS extracted from the JWT — NEVER from `event.body` or query/path params.
- All handlers export exactly one symbol: `handler`.
- No floating promises — `await` everything.
- `health.ts` is the only handler without `getUserId` (public route).
- `onUserSignup.ts` never throws — it wraps all logic in try/catch that logs and swallows.

---

## §7 — Error Response Contract

All non-2xx responses MUST follow this exact format:

```json
{ "code": "POST_NOT_FOUND", "error": "Not Found", "message": "English description for debugging." }
```

The `code` field maps to `ApiErrorCode` in `src/shared/core/types.ts`. The frontend maps `code` → translated user-facing message via `t.errors[code]`. The `message` is for debugging/logs only — never shown to users.

### ApiErrorCode values

| Code | HTTP | Thrown by | When |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | All authenticated handlers | Token absent, expired, or invalid |
| `POST_NOT_FOUND` | 404 | `getPost`, `savePost` | Post not found or belongs to another user |
| `POST_NOT_SAVED` | 404 | `unsavePost` | Post exists but is not in the user's saved list |
| `LEGAL_DOCUMENT_NOT_FOUND` | 404 | `getLegalDocument`, `acceptLegalTerms` | No active document in SintoniaLegal for the requested type |
| `VALIDATION_ERROR` | 400 | All handlers with body validation | Zod schema validation failed |
| `TERMS_VERSION_MISMATCH` | 400 | `acceptLegalTerms` | Body versions ≠ current active versions in SintoniaLegal |
| `GENERATION_LIMIT_REACHED` | 429 | `requestPost` | User has ≥ 5 PENDING generation requests |
| `RATE_LIMIT_EXCEEDED` | 429 | `requestPost` | AI or API rate limit window exceeded |
| `AI_EXTRACTION_FAILED` | 500 | `updateProfile` | Gemini failed to extract tags after primary + fallback attempts |
| `INTERNAL_ERROR` | 500 | All handlers (catch-all) | Uncategorised server error |
| `UNKNOWN_ERROR` | — | Frontend-only fallback | Never returned by backend — reserved for unrecognised codes |

> **`getLegalTermsStatus` edge case:** when no documents exist in `SintoniaLegal`, returns `{ needsAcceptance: false, termsVersion: '', privacyVersion: '' }` — does NOT return `LEGAL_DOCUMENT_NOT_FOUND`. See §16.

> **`UNKNOWN_ERROR`** is a frontend-only fallback. The backend never emits this code.

### Response helpers (src/shared/http/response.ts)

```typescript
ok(event, body)                                         // 200 — data only, never a "message" field
created(event, body)                                    // 201
accepted(event, body)                                   // 202
unauthorized(event)                                     // 401 — code: UNAUTHENTICATED
badRequest(event, message, code?)                       // 400 — default code: VALIDATION_ERROR
notFound(event, message, code?)                         // 404 — default code: POST_NOT_FOUND
tooManyRequests(event, message, code?)                  // 429 — default code: RATE_LIMIT_EXCEEDED
serverError(event, err, code?: ApiErrorCode)            // 500 — default code: INTERNAL_ERROR, logs error
```

**`serverError` with optional code** — use when the failure has a specific code:
```typescript
return serverError(event, err);                         // → INTERNAL_ERROR
return serverError(event, err, 'AI_EXTRACTION_FAILED'); // → AI_EXTRACTION_FAILED
```

The `serverError` signature in `response.ts`:
```typescript
export const serverError = (
  event: APIGatewayEvent,
  err: unknown,
  code: ApiErrorCode = 'INTERNAL_ERROR',
) => {
  console.error('[SERVER ERROR]', err);
  return build(500, { code, error: 'Internal Server Error', message: 'Internal error. Please try again.' }, event);
};
```

### Success response rules

- **NEVER include a `message` field** in success responses.
- Return only the data the frontend needs.
- `DELETE` endpoints return `200 {}` (empty object).
- `POST /feed/request` returns `202 { requestIds, status }` — no `message`.

---

## §8 — DynamoDB Operations (src/shared/db/index.ts)

### Tables

| Constant | Table name pattern | Purpose |
|---|---|---|
| `Tables.FEED` | `SintoniaFeed-{stage}` | AI-generated posts |
| `Tables.REQUESTS` | `SintoniaRequests-{stage}` | Generation request history + throttle |
| `Tables.USERS` | `SintoniaUsers-{stage}` | User profiles, preferences, terms acceptance |
| `Tables.RATE_LIMIT` | `SintoniaRateLimit-{stage}` | Fixed-window rate limit counters |
| `Tables.LEGAL` | `SintoniaLegal-{stage}` | Terms and Privacy Policy documents |

**Always use `Tables.X` — never hardcode table names.**

### Key operations

```typescript
// Feed
getFeedByUser(userId, limit?, cursor?)   → { items: Post[], cursor: string | null }
getPostById(postId)                      → Post | null
savePost(post)                           → void
markPostSaved(postId, userId)            → void   // SET savedAt, REMOVE ttl — ConditionExpression: userId = :uid
markPostUnsaved(postId, userId)          → void   // REMOVE savedAt, SET ttl = now+30d — ConditionExpression: userId = :uid
getSavedByUser(userId, limit?, cursor?)  → { items: Post[], cursor: string | null }

// Users
getUser(userId)                          → UserRecord | null
saveUser(user)                           → void   // PutItem (upsert)
updateUserProfile(userId, desc, tags)    → void
updateUserPreferences(userId, patch)     → void   // patch: { activeTags?, theme?, language? }
acceptUserTerms(userId, termsV, privV)   → void

// Requests
saveRequest(request)                     → void
updateRequestStatus(id, status, extra?)  → void
countPendingRequests(userId)             → number

// Legal
getLatestLegalDocument(type)             → LegalDocument | null   // ScanIndexForward: false, Limit: 1
putLegalDocument(doc)                    → void

// Deduplication context
getRecentPostsByTags(userId, tags, limit?) → Array<{ title: string; summary: string }>
// Queries userId-createdAt-index with FilterExpression on tags array
// Returns only title + summary (ProjectionExpression) — content not needed
// Used by workerInternal before calling generatePost()
```

### DynamoDB access rules

1. **No raw `AttributeValue` format** — always use `DynamoDBDocumentClient` (already configured in `db.ts`).
2. **Cursor pagination** — cursors are base64-encoded `LastEvaluatedKey` JSON. Pass opaquely — never parse in handlers.
3. **TTL** — always Unix timestamp (seconds since epoch): `Math.floor(Date.now() / 1000) + seconds`.
4. **ConditionExpression** on `markPostSaved`/`markPostUnsaved` — always verify `userId = :uid` to prevent cross-user access. Catch `ConditionalCheckFailedException` from `@aws-sdk/client-dynamodb` and map to appropriate 404.
5. **Reserved words** — use `ExpressionAttributeNames` for DynamoDB reserved words (`type`, `status`, `language`, `description`, `name`, `ttl`).

---

## §9 — Input Validation (src/shared/http/validators.ts)

Always validate request bodies before touching DynamoDB or SQS. Use `validate(schema, data)` which throws `ValidationError` on failure (caught in handler → returns `400`).

```typescript
const body = JSON.parse(event.body ?? '{}') as unknown;
const { tags, quantity } = validate(feedRequestSchema, body);
```

### Schemas

| Schema | Used by | Key constraints |
|---|---|---|
| `feedRequestSchema` | `requestPost.ts` | `tags`: array 1–20 strings; `quantity`: int 1–5, default 3 |
| `updatePreferencesSchema` | `updatePreferences.ts` | Patch — at least one of `activeTags`, `theme`, `language` required |
| `updateProfileSchema` | `updateProfile.ts` | `description`: string min 20, max 500 chars |
| `acceptLegalTermsSchema` | `acceptLegalTerms.ts` | `termsVersion`: string min 1; `privacyVersion`: string min 1 |

---

## §10 — Rate Limiting (src/shared/http/rateLimit.ts)

DynamoDB-backed fixed-window counter. `checkRateLimit` throws `RateLimitError` if exceeded.

```typescript
// Check BEFORE expensive operations (cheapest first)
await checkRateLimit(`API_REQUEST#${userId}`, { max: 100, windowSeconds: 900 });   // 15 min window
await checkRateLimit(`AI_GENERATION#${userId}`, { max: 10, windowSeconds: 3600 }); // 1 hour window
```

**Key format: `{type}#{userId}#{bucket}`** where `bucket = Math.floor(now / windowSeconds)`.

**Rate limit error mapping:**
- `RateLimitError` from `checkRateLimit` → `tooManyRequests(event, err.message, 'RATE_LIMIT_EXCEEDED')`
- Pending count ≥ 5 in `requestPost` → `tooManyRequests(event, message, 'GENERATION_LIMIT_REACHED')`

---

## §11 — requestPost Handler (most complex)

`POST /feed/request` — triggers JIT content generation.

```
1. getUserId(event)
2. checkRateLimit(`API_REQUEST#${userId}`, { max: 100, windowSeconds: 900 })
   → RateLimitError → 429 RATE_LIMIT_EXCEEDED
3. checkRateLimit(`AI_GENERATION#${userId}`, { max: 10, windowSeconds: 3600 })
   → RateLimitError → 429 RATE_LIMIT_EXCEEDED
4. validate(feedRequestSchema, body) → { tags, quantity }
   → ValidationError → 400 VALIDATION_ERROR
5. countPendingRequests(userId)
   → if >= 5: return 429 GENERATION_LIMIT_REACHED
6. getUser(userId) → description (may be null — that's OK, Gemini prompt works without it)
7. For each of the `quantity` posts in parallel:
   a. requestId = uuidv4()
   b. sqsMessageId = sendGenerationRequest({ requestId, userId, tags, description })
   c. saveRequest({ id: requestId, userId, tags, sqsMessageId,
                    status: 'PENDING', createdAt: now,
                    ttl: Math.floor(Date.now() / 1000) + 259_200 })  // 3 days
8. return 202 { requestIds: [...], status: 'PENDING' }
   (NO "message" field — clean contract)
```

**Why description goes into SQS:** The Gemini prompt is richer with the user's profile description. Including it in the SQS payload avoids an extra DynamoDB read in `workerInternal`.

---

## §12 — updateProfile Handler

`PUT /user/profile` — description save + AI tag extraction.

```
1. getUserId(event)
2. validate(updateProfileSchema, body) → { description }
   → ValidationError → 400 VALIDATION_ERROR
3. extractTagsFromDescription(description) — synchronous Gemini call (≤ 29s)
   → GeminiError → 500 AI_EXTRACTION_FAILED
4. updateUserProfile(userId, description, activeTags)
5. return ok(event, { description, activeTags, updatedAt: new Date().toISOString() })
```

**Timeout: 29s** (not the default 10s) — aligned with API Gateway's hard 29s integration timeout.

Error mapping in catch:
```typescript
if (err instanceof AuthError) return unauthorized(event);
if (err instanceof ValidationError) return badRequest(event, err.message);
if (err instanceof GeminiError) return serverError(event, err, 'AI_EXTRACTION_FAILED');
return serverError(event, err);
```

---

## §13 — getPost / savePost / unsavePost Handler Details

**`getPost.ts` — `GET /post/{id}`:**
```
1. getUserId(event)
2. postId = event.pathParameters?.['id']
   → if null/undefined: notFound(event, '...', 'POST_NOT_FOUND')
3. post = getPostById(postId)
   → if null: notFound(event, 'Post not found', 'POST_NOT_FOUND')
4. if (post.userId !== userId): notFound(event, 'Post not found', 'POST_NOT_FOUND')
   (same error for privacy — never reveal a post belongs to another user)
5. return ok(event, post)
```

**`savePost.ts` — `POST /post/{id}/save`:**
```
1. getUserId(event)
2. postId = event.pathParameters?.['id']
3. markPostSaved(postId, userId)
   → ConditionExpression: 'userId = :uid'
   → ConditionalCheckFailedException → notFound(event, '...', 'POST_NOT_FOUND')
4. return ok(event, { savedAt: new Date().toISOString() })
```

**`unsavePost.ts` — `DELETE /post/{id}/save`:**
```
1. getUserId(event)
2. postId = event.pathParameters?.['id']
3. markPostUnsaved(postId, userId)
   → ConditionExpression: 'userId = :uid'
   → ConditionalCheckFailedException → notFound(event, '...', 'POST_NOT_SAVED')
4. return ok(event, {})   ← empty object — DELETE returns 200 {}
```

> **Catching ConditionalCheckFailedException:** import from `@aws-sdk/client-dynamodb`:
> ```typescript
> import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
> // in catch: if (err instanceof ConditionalCheckFailedException) return notFound(event, '...', code);
> ```

---

## §14 — AI Layer (src/shared/ai/gemini.ts)

**Primary model:** `gemini-1.5-flash` | **Fallback:** `gemini-1.5-pro`

```typescript
generatePost({ tags, description, recentPosts })    → GeneratedPost   // used by workerInternal
extractTagsFromDescription(description)             → Tag[]           // used by updateProfile
```

**`recentPosts`** is an array of `{ title, summary }` for the last 30 posts the user received within the active tags. It is injected into the Gemini prompt so the model avoids repeating topics.

The prompt section added when `recentPosts.length > 0`:
```
Recent posts already generated for this user on these tags (DO NOT repeat these topics or close variations):
1. "AWS Lambda Cold Start Optimization" — How to eliminate cold starts...
2. "TypeScript Generic Constraints" — Advanced conditional types...
...

The article MUST be substantially different from any topic listed above.
```

Both functions try the primary model first; on failure automatically retry with the fallback model. `GeminiError` is thrown if both fail.

**`GEMINI_API_KEY`** — read from `process.env['GEMINI_API_KEY']`:
- Local dev: `.env.local`
- Production: SSM Parameter Store `/syntonia/{stage}/gemini-api-key` (SecureString, KMS-encrypted)

If the key is absent, `callGemini` throws `GeminiError('GEMINI_API_KEY not configured')`.

**Tag extraction contract:** filters to only `AVAILABLE_TAGS`. Hallucinated tags are silently dropped. If 0 valid tags remain after filtering, throws `GeminiError`.

**Post generation contract:** validates JSON structure before returning. Required fields: `title`, `summary`, `content`, `tags`, `gradient`. `gradient` must be `[hexColor, hexColor]`.

---

## §15 — Auth (src/shared/http/auth.ts)

```typescript
getUserId(event)    → string   // throws AuthError if JWT has no sub claim
getUserEmail(event) → string   // returns '' if email claim missing (non-throwing)
```

**The JWT is validated by API Gateway before the Lambda ever runs.** `getUserId` only extracts the `sub` claim from `event.requestContext.authorizer.claims`.

**Security rule:** `userId` MUST always come from `getUserId(event)`. NEVER accept userId from request body, path params, or query params.

---

## §16 — SintoniaLegal Table

Stores versioned legal documents (Terms of Use, Privacy Policy).

| Attribute | Type | Description |
|---|---|---|
| `type` (PK) | String | `"terms"` or `"privacy"` |
| `createdAt` (SK) | String | ISO 8601 — newest item = currently active |
| `version` | String | Human-readable: `"1.0"`, `"1.1"` |
| `content` | String | Full Markdown document |
| `updatedAt` | String | ISO 8601 — displayed to users in the UI |

**Active document** = most recent item per type. Always query with `ScanIndexForward: false, Limit: 1`.

**Publishing new terms:** `npm run seed:legal` (or a targeted `PutItem`). No migration needed — old rows are retained as audit trail.

### `getLegalTermsStatus` logic

```typescript
const [termsDoc, privacyDoc, user] = await Promise.all([
  getLatestLegalDocument('terms'),
  getLatestLegalDocument('privacy'),
  getUser(userId),
]);

// Edge case: if no documents have been published yet → needsAcceptance: false
// The app only blocks when docs exist AND user hasn't accepted the current version
const termsVersion = termsDoc?.version ?? '';
const privacyVersion = privacyDoc?.version ?? '';

const needsAcceptance =
  termsVersion !== '' &&
  privacyVersion !== '' &&
  (user?.termsAcceptedVersion !== termsVersion ||
   user?.privacyAcceptedVersion !== privacyVersion);

return ok(event, { needsAcceptance, termsVersion, privacyVersion });
```

### `acceptLegalTerms` logic

```
1. validate(acceptLegalTermsSchema, body) → { termsVersion, privacyVersion }
2. [termsDoc, privacyDoc] = await Promise.all([getLatestLegalDocument('terms'), getLatestLegalDocument('privacy')])
3. if (!termsDoc || !privacyDoc) → notFound(event, '...', 'LEGAL_DOCUMENT_NOT_FOUND')
4. if (termsVersion !== termsDoc.version || privacyVersion !== privacyDoc.version)
   → badRequest(event, '...', 'TERMS_VERSION_MISMATCH')
5. acceptUserTerms(userId, termsVersion, privacyVersion)
6. return ok(event, { acceptedAt: new Date().toISOString() })
```

---

## §17 — workerInternal (SQS Trigger)

```
SQS record body: { requestId, userId, tags, description }
  │
  ├─ UpdateItem: SintoniaRequests → status: PROCESSING, processingAt
  │
  ├─ getRecentPostsByTags(userId, tags, 30) → recentPosts   ← deduplication context
  │
  ├─ OUTER LOOP (max 3 in-process attempts, exponential backoff: 1s, 2s, 4s)
  │   │
  │   ├─ generatePost({ tags, description, recentPosts })     ← passes dedup context
  │   │   ├─ callGemini(PRIMARY_MODEL)  → success
  │   │   └─ callGemini(PRIMARY_MODEL)  → fail → callGemini(FALLBACK_MODEL) → success/fail
  │   │
  │   ├─ success:
  │   │   ├─ PutItem: SintoniaFeed { id: uuidv4(), ttl: now+7_776_000, status: 'READY', ... }
  │   │   ├─ UpdateItem: SintoniaRequests → COMPLETED, postId, completedAt, ttl: now+2_592_000
  │   │   └─ return → SQS auto-deletes the message
  │   │
  │   └─ failure (attempt < 3): sleep(1000 × 2^attempt) → retry
  │
  └─ ALL 3 in-process attempts failed:
      ├─ UpdateItem: SintoniaRequests → FAILED, errorMessage, failedAt, ttl: now+604_800
      └─ throw err → SQS makes message visible after VisibilityTimeout (120s)
                   → up to 3 total SQS-level deliveries (maxReceiveCount: 3)
                   → after 3rd failure → GenerationDLQ (14-day retention)
```

**Maximum Gemini calls per SQS message: 3 outer attempts × 2 models = 6 calls worst-case.**

**Key constraints:**
- `reservedConcurrency: 5` — limits concurrent Gemini API spend
- `batchSize: 1` — one record per invocation; isolated failures
- `VisibilityTimeout: 120s` — must be > Lambda timeout (60s); prevents duplicate processing
- `functionResponseType: ReportBatchItemFailures` — only the failed message returns to queue

---

## §18 — onUserSignup (Cognito Trigger)

Called by Cognito's `PostConfirmation` trigger after email verification.

```typescript
const userId = event.request.userAttributes['sub'] as string;
const email = event.request.userAttributes['email'] as string;

try {
  const user: UserRecord = {
    userId,
    email,
    activeTags: DEFAULT_TAGS,        // ['AWS', 'TypeScript', 'React']
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    // theme and language NOT stored at signup — getPreferences returns defaults
  };
  await saveUser(user);
  console.log(`[onUserSignup] Profile created for ${userId}`);
} catch (err) {
  // NEVER throw — a thrown error blocks the Cognito signup entirely
  console.error(`[onUserSignup] Failed to create profile for ${userId}:`, err);
}

return event;  // MUST return the event intact
```

**Fallback:** If this Lambda fails silently, `getPreferences` recreates the profile on first login.

---

## §19 — getPreferences Upsert Fallback

`getPreferences` is the only handler that creates a user record when it is missing. This handles the case where `onUserSignup` failed silently.

```typescript
let user = await getUser(userId);

if (!user) {
  console.warn(`[getPreferences] Profile missing for ${userId} — recreating with defaults`);
  user = {
    userId,
    email: getUserEmail(event),
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
  theme: user.theme ?? 'dark',      // default if not yet stored
  language: user.language ?? 'en',  // default if not yet stored
});
```

> **`theme` and `language` are NOT stored at signup.** They are written to DynamoDB only when the user first changes them via `PUT /user/preferences`. Until then, `getPreferences` returns the hardcoded defaults.

---

## §20 — Environment Variables

All environment variables are centralised in `src/shared/core/env.ts`. **Never access `process.env` directly anywhere else.**

### Local development (.env.local — NEVER committed)

```bash
GEMINI_API_KEY=AIzaSy...
FEED_TABLE=SintoniaFeed-dev
REQUESTS_TABLE=SintoniaRequests-dev
USERS_TABLE=SintoniaUsers-dev
RATE_LIMIT_TABLE=SintoniaRateLimit-dev
LEGAL_TABLE=SintoniaLegal-dev
GENERATION_QUEUE_URL=https://sqs.sa-east-1.amazonaws.com/123456789012/syntonia-generation-dev
STAGE=dev
CORS_ORIGINS=*
```

### Variable reference

| Variable | Default | Description |
|---|---|---|
| `AWS_REGION` | `sa-east-1` | AWS region for DynamoDB and SQS clients |
| `STAGE` | `dev` | Deployment stage — injected by serverless.yml |
| `LOG_LEVEL` | `INFO` | Logger minimum level: `DEBUG` | `INFO` | `WARN` | `ERROR` |
| `FEED_TABLE` | `SintoniaFeed-dev` | DynamoDB table name |
| `REQUESTS_TABLE` | `SintoniaRequests-dev` | DynamoDB table name |
| `USERS_TABLE` | `SintoniaUsers-dev` | DynamoDB table name |
| `RATE_LIMIT_TABLE` | `SintoniaRateLimit-dev` | DynamoDB table name |
| `LEGAL_TABLE` | `SintoniaLegal-dev` | DynamoDB table name |
| `GENERATION_QUEUE_URL` | `''` | SQS queue URL — set by `!Ref GenerationQueue` at deploy |
| `GEMINI_API_KEY` | `''` | Gemini API key — from SSM in production |
| `CORS_ORIGINS` | `'*'` | Allowed CORS origins. `'*'` = any origin. Comma-separated list to restrict. |

### CORS behaviour

| `CORS_ORIGINS` | Response header | Credentials |
|---|---|---|
| `*` (default) | `Access-Control-Allow-Origin: *` | Not sent (browsers forbid credentials with `*`) |
| comma-separated list | Echoes the matching origin | `Access-Control-Allow-Credentials: true` |

To restrict in production, override in `serverless.yml`:
```yaml
CORS_ORIGINS: 'https://syntonia.app,https://dev.syntonia.app'
```

### Accessing env vars in code

```typescript
// ✓ Always import from env.ts
import { GEMINI_API_KEY, CORS_ORIGINS, STAGE } from '../shared/core/env.js';
import { Tables } from '../shared/core/tables.js';  // wraps table name vars

// ✗ Never — process.env is only allowed in src/shared/core/env.ts
const key = process.env['GEMINI_API_KEY'];
```

---

## §21 — Serverless Framework & Build

### IAM — per-Lambda CloudFormation roles

Each Lambda has its own `AWS::IAM::Role` defined in `resources:` with only the permissions it needs. No shared role.

```yaml
# Pattern for each function:
functions:
  getFeed:
    role: !GetAtt GetFeedLambdaRole.Arn   # reference its dedicated role
    ...

resources:
  Resources:
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
                  Resource: !Sub 'arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/SintoniaFeed-${self:provider.stage}/index/userId-createdAt-index'
```

All 15 role definitions are in ARCHITECTURE.md §12. The pattern is identical for each — only the `PolicyDocument` statements differ.

**Every role includes `logs:*` statements.** Without these, the Lambda function silently discards all log output.

### serverless.yml key config (plugins + esbuild)

```yaml
service: syntonia-backend

plugins:
  - serverless-esbuild      # MUST be first — handles TypeScript compilation
  - serverless-offline      # Local simulation

custom:
  esbuild:
    bundle: true
    minify: false
    sourcemap: true
    target: node22
    platform: node
    format: cjs              # CommonJS — most compatible with Lambda Node.js runtime
    external:
      - '@aws-sdk/*'         # Pre-installed on Lambda; DO NOT bundle
    packager: npm

  serverless-offline:
    httpPort: 3000
    lambdaPort: 3002
```

**Why `format: cjs` not `esm`:** CommonJS is the default and most compatible format for Lambda. ESM requires `"type": "module"` in `package.json` or `.mjs` extension — adds complexity without benefit.

**Why `@aws-sdk/*` is external:** The Lambda runtime pre-installs AWS SDK v3. Bundling it increases cold start time and deployment package size unnecessarily.

### Scripts

```bash
npm run dev           # serverless offline --stage dev (local, port 3000)
npm run build         # tsc --noEmit (type check only — esbuild bundles at deploy)
npm run deploy:dev    # serverless deploy --stage dev
npm run deploy:prod   # serverless deploy --stage prod
npm run seed:legal    # tsx scripts/seed-legal.ts — inserts Terms + Privacy v1.0
npm run logs:worker   # serverless logs -f workerInternal --tail
```

---

## §22 — Security Rules

1. **`userId` from JWT only** — NEVER from body/path/query.
2. **`getPost` and `savePost`** — always verify `post.userId === userId` before allowing access; return `POST_NOT_FOUND` if mismatch (do not reveal existence).
3. **`unsavePost`** — catch `ConditionalCheckFailedException`; return `POST_NOT_SAVED`.
4. **Rate limiting** — check BEFORE expensive operations (SQS send, DynamoDB query).
5. **Input validation** — call `validate(schema, body)` BEFORE touching any AWS service.
6. **No secrets in code** — `GEMINI_API_KEY` from SSM or `.env.local`. Never in source files.
7. **CORS** — controlled via `CORS_ORIGINS` env var (default: `*` — allow any origin). No URLs are hardcoded. To restrict in production, set `CORS_ORIGINS=https://your-domain.com,...` in `.env.local` or `serverless.yml`. See §20.
8. **`onUserSignup`** — never throw (would block Cognito signup). Always catch + log.
9. **`acceptLegalTerms`** — validate that body versions match active SintoniaLegal versions before writing.

---

## §23 — Adding a New Lambda Function

1. Create `src/functions/{functionName}.ts` following the handler pattern in §6.
2. Add entry to `serverless.yml` under `functions:` with `handler`, `timeout`, `description`, and `events`.
3. If it needs a new DynamoDB operation, add it to `src/shared/db/index.ts` (see §24).
4. If it needs new input validation, add schema to `src/shared/http/validators.ts` (see §9).
5. If it returns a new error code, add to `ApiErrorCode` in `src/shared/core/types.ts` AND to the table in §7.
6. Update §3 directory tree in this file.
7. Run `npm run build` → zero TypeScript errors.

---

## §24 — Adding a New DynamoDB Operation

1. Add the function to `src/shared/db/index.ts` with explicit TypeScript return types.
2. Use `Tables.X` for the table name — never hardcode.
3. Use `DynamoDBDocumentClient` (the `db` export) — never the raw `DynamoDBClient`.
4. For `UpdateExpression` with reserved words (e.g., `type`, `status`, `language`, `description`), use `ExpressionAttributeNames`.
5. For cursor pagination: encode `LastEvaluatedKey` as `Buffer.from(JSON.stringify(key)).toString('base64')`; decode as `JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))`.
6. Add the new function signature to §8.

---

## §25 — Monitoring & Structured Logs

All handlers use structured console logs:

```typescript
console.log(`[functionName] message`);
console.warn(`[functionName] warning message`);
console.error(`[functionName] error message`, err);
```

CloudWatch log groups (auto-created by Serverless Framework):

```
/aws/lambda/syntonia-backend-{stage}-getFeed
/aws/lambda/syntonia-backend-{stage}-requestPost
/aws/lambda/syntonia-backend-{stage}-workerInternal
/aws/lambda/syntonia-backend-{stage}-getPost
/aws/lambda/syntonia-backend-{stage}-savePost
/aws/lambda/syntonia-backend-{stage}-unsavePost
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

Retention: **14 days** — configured in `serverless.yml` under `provider`:
```yaml
provider:
  logRetentionInDays: 14
```

**CloudWatch Alarms** (defined in serverless.yml):
- `WorkerErrorAlarm` — `workerInternal` Lambda errors ≥ 3 in 5 min window
- `ApiHighLatencyAlarm` — `getFeed` p95 duration > 3000ms
- `DLQMessageAlarm` — any message visible in `GenerationDLQ` (fires immediately — most critical)

---

## §26 — seed-legal.ts (scripts/seed-legal.ts)

The seed script inserts the initial Terms of Use and Privacy Policy documents into the `SintoniaLegal` table. Must be run once after first deploy.

```typescript
// scripts/seed-legal.ts
// Usage: npx tsx scripts/seed-legal.ts [stage]
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const stage = process.argv[2] ?? 'dev';
const TABLE = `SintoniaLegal-${stage}`;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const now = new Date().toISOString();

const documents = [
  {
    type: 'terms',
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    content: `# Terms of Use\n\n...`,  // full Markdown
  },
  {
    type: 'privacy',
    version: '1.0',
    createdAt: now,
    updatedAt: now,
    content: `# Privacy Policy\n\n...`,  // full Markdown
  },
];

for (const doc of documents) {
  await client.send(new PutCommand({ TableName: TABLE, Item: doc }));
  console.log(`[seed-legal] Seeded ${doc.type} v${doc.version} into ${TABLE}`);
}
```

**Running:**
```bash
npm run seed:legal              # targets dev stage
npx tsx scripts/seed-legal.ts prod   # explicit stage
```

**Content:** Use the Markdown content from `frontend/src/mocks/data/legal.ts` as a starting point. Update before production launch with real legal text.

**Publishing new terms:** Insert a new item (PutItem). The previous version remains in the table as audit history. `getLatestLegalDocument` always returns the most recent.

---

## §27 — Local Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local — fill in dev stage values; GEMINI_API_KEY can be blank initially

npm run dev
# API available at http://localhost:3000
# No AWS credentials needed for serverless-offline
# DynamoDB calls will fail until real AWS or DynamoDB Local is configured
```

**Testing individual Lambdas:**
```bash
# Invoke workerInternal (SQS trigger — doesn't auto-run with serverless-offline)
npx serverless invoke local -f workerInternal --stage dev \
  --data '{"Records":[{"body":"{\"requestId\":\"r-1\",\"userId\":\"u-1\",\"tags\":[\"AWS\"],\"description\":null}"}]}'
```

**DynamoDB Local** (optional — for full offline testing without AWS):
```bash
npm install --save-dev serverless-dynamodb
# Add to plugins in serverless.yml; configure under custom.dynamodb
# npm run dev then also starts a local DynamoDB instance
```

---

## §28 — Deployment

```bash
# Prerequisites: AWS credentials configured + SSM parameter created
aws ssm put-parameter \
  --name "/syntonia/dev/gemini-api-key" \
  --value "AIzaSy..." \
  --type SecureString \
  --region sa-east-1

npm run deploy:dev

# After first deploy — seed legal documents
npm run seed:legal

# Get output values for frontend configuration
npx serverless info --stage dev
```

**Outputs from serverless.yml** → set in `frontend/.env.local` and Amplify Console:
- `ServiceEndpoint` → `VITE_API_URL`
- `UserPoolId` → `VITE_COGNITO_USER_POOL_ID`
- `UserPoolClientId` → `VITE_COGNITO_CLIENT_ID`

---

## §29 — Data Model Quick Reference

### SintoniaFeed (post TTL lifecycle)

| Event | `ttl` value | `savedAt` |
|---|---|---|
| Created by workerInternal | `now + 7_776_000` (90 days) | absent |
| User saves (`POST /post/:id/save`) | **removed** | set to current ISO timestamp |
| User unsaves (`DELETE /post/:id/save`) | `now + 2_592_000` (30 days) | **removed** |

### SintoniaUsers (key fields + defaults)

| Field | Type | Set at | Default when absent |
|---|---|---|---|
| `activeTags` | `Tag[]` | `onUserSignup` / `updateProfile` | `DEFAULT_TAGS` via upsert fallback |
| `theme` | `'dark' \| 'light'` | `updatePreferences` | `'dark'` returned by `getPreferences` |
| `language` | `'en' \| 'pt-BR'` | `updatePreferences` | `'en'` returned by `getPreferences` |
| `termsAcceptedVersion` | string | `acceptLegalTerms` | absent = no acceptance recorded |
| `privacyAcceptedVersion` | string | `acceptLegalTerms` | absent = no acceptance recorded |
| `termsAcceptedAt` | ISO 8601 | `acceptLegalTerms` | absent until first acceptance |

> **`theme` and `language` are NOT stored at signup.** `getPreferences` returns `user.theme ?? 'dark'` — written to DynamoDB only when user changes them in Settings.

### SintoniaRequests (status lifecycle + TTL)

```
PENDING → PROCESSING → COMPLETED
                     ↘ FAILED → (SQS retry) → (DLQ after 3 SQS attempts)
```

TTL by status (Unix seconds added to `Math.floor(Date.now() / 1000)`):

| Status | TTL seconds | Rationale |
|---|---|---|
| PENDING | `+ 259_200` (3 days) | Safety net for unconsumed messages |
| COMPLETED | `+ 2_592_000` (30 days) | Short-term audit trail |
| FAILED | `+ 604_800` (7 days) | Debugging window |

### SintoniaLegal (active document query)

```typescript
// Always use this pattern — never query by version
await getLatestLegalDocument('terms');   // most recent Terms of Use
await getLatestLegalDocument('privacy'); // most recent Privacy Policy
```

---

## §30 — Handler → Endpoint Quick Reference

| Handler file | Method | Path | Auth | Returns |
|---|---|---|---|---|
| `getFeed.ts` | GET | `/feed` | ✓ | `{ posts, cursor, hasMore }` |
| `requestPost.ts` | POST | `/feed/request` | ✓ | `202 { requestIds, status }` |
| `getPost.ts` | GET | `/post/{id}` | ✓ | Full `Post` object |
| `savePost.ts` | POST | `/post/{id}/save` | ✓ | `{ savedAt }` |
| `unsavePost.ts` | DELETE | `/post/{id}/save` | ✓ | `{}` |
| `getSavedPosts.ts` | GET | `/posts/saved` | ✓ | `{ posts, cursor, hasMore }` |
| `getPreferences.ts` | GET | `/user/preferences` | ✓ | `{ userId, description, activeTags, availableTags, theme, language }` |
| `updatePreferences.ts` | PUT | `/user/preferences` | ✓ | `{}` |
| `updateProfile.ts` | PUT | `/user/profile` | ✓ | `{ description, activeTags, updatedAt }` |
| `health.ts` | GET | `/health` | ✗ | `{ status, timestamp, stage }` |
| `workerInternal.ts` | SQS | — | — | void (SQS trigger) |
| `onUserSignup.ts` | Cognito | — | — | event (Cognito PostConfirmation trigger) |
| `getLegalTermsStatus.ts` | GET | `/legal/terms-status` | ✓ | `{ needsAcceptance, termsVersion, privacyVersion }` |
| `getLegalDocument.ts` | GET | `/legal/{type}` | ✓ | `{ type, version, updatedAt, content, createdAt }` |
| `acceptLegalTerms.ts` | POST | `/legal/accept` | ✓ | `{ acceptedAt }` |

---

## §31 — ARCHITECTURE.md Reference

The master architecture document lives at `../ARCHITECTURE.md`. The backend-relevant sections:

| Section | Content |
|---|---|
| **§4** | Full backend stack, all handler implementations, shared module TypeScript code |
| **§5** | DynamoDB table schemas, GSIs, TTL strategies, full access patterns table |
| **§6** | Cognito authentication flow, JWT validation, token refresh |
| **§7** | Gemini model config, prompt strategy, cost estimates |
| **§8** | REST API contract — all 14 endpoints with request/response shapes and error codes |
| **§9** | TypeScript data models |
| **§10** | JIT content generation complete flow diagram |
| **§12** | Full `serverless.yml` IaC |
| **§18** | Security checklist |

**When in doubt about an endpoint contract, response format, or data shape — the ARCHITECTURE.md §8 is the source of truth.**
