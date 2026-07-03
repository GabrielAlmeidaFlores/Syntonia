import type { Tag } from "@/types";

export const MOCK_POSTS = [
  {
    id: "post-001",
    userId: "user-mock-001",
    title: "Lambda Cold Start: Real Strategies",
    summary:
      "Eliminate cold starts in Node.js functions with Provisioned Concurrency and SnapStart.",
    tags: ["AWS", "Serverless", "Performance"] as Tag[],
    gradient: ["#FF6B35", "#F7931E"] as [string, string],
    createdAt: "2026-07-01T10:00:00Z",
    content: `## The Cold Start Problem

When a Lambda function hasn't been invoked recently, AWS must initialise a new execution environment — downloading your code, starting the runtime and executing your init code. This is a cold start, and it adds anywhere from 200ms to 2s of extra latency.

\`\`\`typescript
const client = new DynamoDBClient({ region: 'sa-east-1' });

export const handler = async (event: APIGatewayProxyEvent) => {
  const result = await client.send(new GetCommand({ TableName: 'Feed', Key: { id: '1' } }));
  return result.Item;
};
\`\`\`

## Provisioned Concurrency

With Provisioned Concurrency, AWS keeps a pool of pre-warmed execution environments ready to handle requests. Latency drops to single-digit milliseconds.

\`\`\`yaml
functions:
  getFeed:
    handler: src/functions/getFeed.handler
    provisionedConcurrency: 3
\`\`\`

## Lambda SnapStart

SnapStart takes a snapshot of a fully initialised execution environment and restores it on subsequent cold starts. For Node.js 22 runtimes, it reduces cold start time by up to 90%.

\`\`\`yaml
provider:
  runtime: nodejs22.x
  snapStart: true
\`\`\`

## Measuring Cold Start Impact

\`\`\`
fields @timestamp, @duration, @initDuration
| filter @initDuration > 0
| stats avg(@initDuration) as avgColdStart by bin(1h)
\`\`\`
`,
  },
  {
    id: "post-002",
    userId: "user-mock-001",
    title: "SQS Dead Letter Queues in Practice",
    summary:
      "Design resilient Lambda consumers with DLQs, visibility timeouts and ReportBatchItemFailures.",
    tags: ["AWS", "Serverless", "Architecture"] as Tag[],
    gradient: ["#F7931E", "#FFCD3C"] as [string, string],
    createdAt: "2026-07-01T11:00:00Z",
    content: `## Why Messages End Up in the DLQ

A message moves to the Dead Letter Queue after maxReceiveCount failed delivery attempts.

\`\`\`typescript
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: SQSBatchItemFailure[] = [];
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch {
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
};
\`\`\`

## Visibility Timeout

The visibility timeout must always be greater than your Lambda function timeout.

\`\`\`yaml
GenerationQueue:
  Type: AWS::SQS::Queue
  Properties:
    VisibilityTimeout: 120
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt GenerationDLQ.Arn
      maxReceiveCount: 3
\`\`\`

## Alarm on First DLQ Message

\`\`\`yaml
DLQMessageAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    MetricName: ApproximateNumberOfMessagesVisible
    Namespace: AWS/SQS
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold
\`\`\`
`,
  },
  {
    id: "post-003",
    userId: "user-mock-001",
    title: "DynamoDB Single-Table Design Deep Dive",
    summary:
      "Model complex relationships in a single DynamoDB table using composite keys and GSIs.",
    tags: ["AWS", "DynamoDB", "Architecture"] as Tag[],
    gradient: ["#FF6B35", "#C0392B"] as [string, string],
    createdAt: "2026-07-01T12:00:00Z",
    content: `## The Mindset Shift

In DynamoDB you design tables around access patterns, not entities.

\`\`\`typescript
const result = await db.send(new QueryCommand({
  TableName: TABLE_NAME,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
  ExpressionAttributeValues: {
    ':pk': \`USER#\${userId}\`,
    ':prefix': 'POST#',
  },
  ScanIndexForward: false,
}));
\`\`\`

## GSI Overloading

A Global Secondary Index can serve multiple access patterns using generic attribute names.

| Entity | GSI1PK | GSI1SK |
|---|---|---|
| Post by status | STATUS#READY | createdAt |
| User by email | EMAIL#user@example.com | USER#id |

## PAY_PER_REQUEST

For variable workloads, PAY_PER_REQUEST is almost always cheaper than provisioned capacity.
`,
  },
  {
    id: "post-004",
    userId: "user-mock-001",
    title: "TypeScript Discriminated Unions in APIs",
    summary:
      "Use discriminated unions to model API responses with exhaustive type safety at compile time.",
    tags: ["TypeScript", "Architecture"] as Tag[],
    gradient: ["#3178C6", "#235A97"] as [string, string],
    createdAt: "2026-07-01T13:00:00Z",
    content: `## Discriminated Unions

Add a discriminant — a literal type field that uniquely identifies each variant:

\`\`\`typescript
type ApiResult<T> =
  | { readonly status: 'ok'; readonly data: T }
  | { readonly status: 'error'; readonly code: number; readonly message: string }
  | { readonly status: 'loading' };

function handleResult<T>(result: ApiResult<T>): string {
  switch (result.status) {
    case 'ok': return JSON.stringify(result.data);
    case 'error': return result.message;
    case 'loading': return 'Loading...';
  }
}
\`\`\`

## Real-World: Feed State

\`\`\`typescript
type FeedState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly posts: Post[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly message: string };
\`\`\`

The exhaustiveness check — combined with switch-exhaustiveness-check ESLint rule — means the compiler will error if you add a new variant and forget to handle it.
`,
  },
  {
    id: "post-005",
    userId: "user-mock-001",
    title: "Template Literal Types for Type-Safe Routes",
    summary:
      "Encode route patterns as TypeScript types to get compile-time validation of navigation.",
    tags: ["TypeScript", "React"] as Tag[],
    gradient: ["#235A97", "#0F3460"] as [string, string],
    createdAt: "2026-07-01T14:00:00Z",
    content: `## Routes as Types

\`\`\`typescript
type RouteParams = {
  '/feed': Record<string, never>;
  '/profile': Record<string, never>;
  '/post/:id': { readonly id: string };
};

type Route = keyof RouteParams;

function navigate<R extends Route>(
  route: R,
  ...args: RouteParams[R] extends Record<string, never> ? [] : [params: RouteParams[R]]
): string {
  if (args.length === 0) return route;
  const [params] = args;
  return Object.entries(params as Record<string, string>).reduce(
    (acc, [key, value]) => acc.replace(\`:\${key}\`, value),
    route as string,
  );
}

navigate('/feed');
navigate('/post/:id', { id: 'post-123' });
\`\`\`
`,
  },
  {
    id: "post-006",
    userId: "user-mock-001",
    title: "Branded Types: Preventing ID Mixups",
    summary:
      "Use branded (nominal) types to make TypeScript treat structurally identical strings as distinct.",
    tags: ["TypeScript", "Security"] as Tag[],
    gradient: ["#3178C6", "#1a5490"] as [string, string],
    createdAt: "2026-07-01T15:00:00Z",
    content: `## Branded Types

A brand is a phantom property that exists only at the type level — zero runtime cost:

\`\`\`typescript
type Brand<T, B> = T & { readonly __brand: B };

type UserId = Brand<string, 'UserId'>;
type PostId = Brand<string, 'PostId'>;

const UserId  = (id: string): UserId  => id as UserId;
const PostId  = (id: string): PostId  => id as PostId;

function getPost(id: PostId): Post { return fetchPost(id); }

getPost(PostId('post-123'));
\`\`\`

Branded types are especially valuable when multiple IDs flow through the same functions.
`,
  },
  {
    id: "post-007",
    userId: "user-mock-001",
    title: "Multi-Stage Docker Builds for Node.js",
    summary:
      "Reduce production image size by 80% using multi-stage builds and layer caching strategies.",
    tags: ["Docker", "Node.js", "Performance"] as Tag[],
    gradient: ["#0DB7ED", "#384D54"] as [string, string],
    createdAt: "2026-07-01T16:00:00Z",
    content: `## Multi-Stage Build

\`\`\`dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:22-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 3000
CMD ["node", "dist/index.js"]
\`\`\`

Result: ~85MB vs ~950MB for the naive single-stage approach.

## Layer Caching

Always copy files that change least frequently first — package manifests before source code.
`,
  },
  {
    id: "post-008",
    userId: "user-mock-001",
    title: "Kubernetes Liveness vs Readiness Probes",
    summary:
      "Understand the critical difference between liveness and readiness to prevent cascading failures.",
    tags: ["Kubernetes", "Architecture"] as Tag[],
    gradient: ["#326CE5", "#1A3A8F"] as [string, string],
    createdAt: "2026-07-01T17:00:00Z",
    content: `## Liveness Probe

Failure causes the container to be killed and restarted. Use only for deadlock detection.

\`\`\`yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
\`\`\`

## Readiness Probe

Failure removes the pod from the Service's endpoint list but does NOT restart it.

\`\`\`yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
\`\`\`

## Implementation

\`\`\`typescript
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await db.ping();
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});
\`\`\`

Never check external dependencies in the liveness probe.
`,
  },
  {
    id: "post-009",
    userId: "user-mock-001",
    title: "Kubernetes Resource Requests and Limits",
    summary:
      "Set CPU and memory requests/limits correctly to avoid OOMKilled pods and noisy-neighbour issues.",
    tags: ["Kubernetes", "Performance"] as Tag[],
    gradient: ["#1A3A8F", "#0D1F4E"] as [string, string],
    createdAt: "2026-07-01T18:00:00Z",
    content: `## Requests vs Limits

\`\`\`yaml
resources:
  requests:
    cpu: "250m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
\`\`\`

Requests: what the scheduler uses to place pods.
Limits: the hard cap — exceeding CPU causes throttling, exceeding memory causes OOMKill.

## Guaranteed QoS

Set requests equal to limits for production latency-sensitive workloads.

## Vertical Pod Autoscaler

\`\`\`yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: syntonia-api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: syntonia-api
  updatePolicy:
    updateMode: "Off"
\`\`\`
`,
  },
  {
    id: "post-010",
    userId: "user-mock-001",
    title: "GitHub Actions: Optimising Pipeline Speed",
    summary:
      "Cut CI runtime by 60% using job matrices, dependency caching and conditional step execution.",
    tags: ["CI/CD", "Performance"] as Tag[],
    gradient: ["#24292F", "#57606A"] as [string, string],
    createdAt: "2026-07-01T19:00:00Z",
    content: `## Cache Node Modules

\`\`\`yaml
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'yarn'
    cache-dependency-path: frontend/yarn.lock
\`\`\`

## Parallel Jobs

\`\`\`yaml
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - run: yarn typecheck

  lint:
    runs-on: ubuntu-latest
    steps:
      - run: yarn lint

  deploy:
    needs: [typecheck, lint]
    if: github.ref == 'refs/heads/main'
    steps:
      - run: npx serverless deploy --stage prod
\`\`\`

## Path Filters

\`\`\`yaml
on:
  push:
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'
\`\`\`
`,
  },
  {
    id: "post-011",
    userId: "user-mock-001",
    title: "Redis Caching Patterns for APIs",
    summary:
      "Implement cache-aside, write-through and cache invalidation strategies in Node.js APIs.",
    tags: ["Redis", "Performance", "Node.js"] as Tag[],
    gradient: ["#D82C20", "#8B1A10"] as [string, string],
    createdAt: "2026-07-01T20:00:00Z",
    content: `## Cache-Aside

\`\`\`typescript
async function getUserProfile(userId: string): Promise<UserProfile> {
  const cacheKey = \`user:profile:\${userId}\`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) return JSON.parse(cached) as UserProfile;

  const profile = await db.getUser(userId);
  await redis.setex(cacheKey, 3600, JSON.stringify(profile));
  return profile;
}
\`\`\`

## Write-Through

\`\`\`typescript
async function updateActiveTags(userId: string, tags: string[]): Promise<void> {
  await Promise.all([
    db.updateUserTags(userId, tags),
    redis.setex(\`user:profile:\${userId}\`, 3600, JSON.stringify({ activeTags: tags })),
  ]);
}
\`\`\`

## Avoiding Cache Stampede

Use a distributed lock pattern with Redis SET NX EX to prevent multiple processes from rebuilding the cache simultaneously.
`,
  },
  {
    id: "post-012",
    userId: "user-mock-001",
    title: "PostgreSQL Query Optimisation: Index Deep Dive",
    summary:
      "Understand partial indexes, composite indexes and EXPLAIN ANALYZE to eliminate slow queries.",
    tags: ["PostgreSQL", "Performance"] as Tag[],
    gradient: ["#336791", "#1A3A5C"] as [string, string],
    createdAt: "2026-07-01T21:00:00Z",
    content: `## Reading EXPLAIN ANALYZE

\`\`\`sql
EXPLAIN ANALYZE
SELECT * FROM posts
WHERE user_id = 'user-123' AND status = 'READY'
ORDER BY created_at DESC
LIMIT 10;
\`\`\`

## Composite Index

\`\`\`sql
CREATE INDEX idx_posts_user_status_date
ON posts (user_id, status, created_at DESC);
\`\`\`

## Partial Index

\`\`\`sql
CREATE INDEX idx_posts_ready
ON posts (user_id, created_at DESC)
WHERE status = 'READY';
\`\`\`

A partial index is smaller and faster because it excludes rows that are never queried.
`,
  },
  {
    id: "post-013",
    userId: "user-mock-001",
    title: "JWT Security: What Most Tutorials Get Wrong",
    summary:
      "Understand algorithm confusion attacks, key ID spoofing and proper JWT validation in Node.js.",
    tags: ["Security", "Node.js"] as Tag[],
    gradient: ["#E74C3C", "#922B21"] as [string, string],
    createdAt: "2026-07-02T09:00:00Z",
    content: `## Algorithm Confusion Attack

Many JWT libraries accept the algorithm from the token header. An attacker can change RS256 to HS256 and sign with the public key.

\`\`\`typescript
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, JWKS, {
    algorithms: ['RS256'],
    issuer: \`https://cognito-idp.sa-east-1.amazonaws.com/\${USER_POOL_ID}\`,
    audience: CLIENT_ID,
  });
  return payload;
}
\`\`\`

## Token Lifetimes

Access tokens: 1 hour. Refresh tokens: 30 days. Never use refresh tokens to call your API.
`,
  },
  {
    id: "post-014",
    userId: "user-mock-001",
    title: "Terraform State Management at Scale",
    summary:
      "Remote state, state locking, workspace strategies and secrets management with Terraform.",
    tags: ["Terraform", "Architecture", "Security"] as Tag[],
    gradient: ["#7B42BC", "#4A1A8C"] as [string, string],
    createdAt: "2026-07-02T10:00:00Z",
    content: `## Remote State

\`\`\`hcl
terraform {
  backend "s3" {
    bucket         = "syntonia-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "sa-east-1"
    encrypt        = true
    dynamodb_table = "syntonia-terraform-locks"
  }
}
\`\`\`

## Workspaces

\`\`\`bash
terraform workspace new staging
terraform workspace select production
terraform apply -var="stage=prod"
\`\`\`

## Secrets via SSM

\`\`\`hcl
data "aws_ssm_parameter" "gemini_api_key" {
  name            = "/syntonia/prod/gemini-api-key"
  with_decryption = true
}
\`\`\`
`,
  },
  {
    id: "post-015",
    userId: "user-mock-001",
    title: "Event-Driven Architecture: Patterns and Pitfalls",
    summary:
      "Saga, outbox pattern, and idempotency strategies for reliable event-driven microservices.",
    tags: ["Architecture", "AWS", "Serverless"] as Tag[],
    gradient: ["#2ECC71", "#1A7A44"] as [string, string],
    createdAt: "2026-07-02T11:00:00Z",
    content: `## The Outbox Pattern

Write the event to the database in the same transaction as the business data:

\`\`\`typescript
await db.send(new TransactWriteCommand({
  TransactItems: [
    { Put: { TableName: 'SintoniaFeed', Item: post } },
    { Put: { TableName: 'SintoniaOutbox', Item: {
      id: uuidv4(),
      eventType: 'POST_CREATED',
      payload: JSON.stringify(post),
    }}},
  ],
}));
\`\`\`

## Idempotency

\`\`\`typescript
export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const { requestId } = JSON.parse(record.body) as GenerationRequest;
    const existing = await db.getRequest(requestId);
    if (existing?.status === 'COMPLETED') continue;
    await processRequest(requestId);
  }
};
\`\`\`
`,
  },
];
