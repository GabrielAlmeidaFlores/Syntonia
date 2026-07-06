# Syntonia — Personal Learning Engine

AI-powered personal feed that generates in-depth, long-form articles tailored to each user's interests. Users describe their background, the AI extracts relevant tags, and a just-in-time pipeline generates fresh content on demand via a TikTok-style vertical snap-scroll feed.

## Repository structure

```
syntonia-app/
├── backend/          Node.js Lambda API  — see backend/README.md
├── frontend/         React SPA           — see frontend/README.md
└── ARCHITECTURE.md   Full technical reference (data models, API contracts, IaC)
```

## Stack overview

| Layer | Technology |
|---|---|
| Backend | Node.js 20 · TypeScript · Serverless Framework v3 · AWS Lambda / API Gateway / DynamoDB / SQS / Cognito |
| AI | Google Gemini 2.5 Flash (primary) · Gemini 2.5 Pro (fallback) |
| Frontend | React 18 · Vite 6 · TypeScript · Tailwind CSS · Zustand · AWS Amplify |
| Region | `sa-east-1` (São Paulo) |

## Quick start

**Prerequisites:** Node.js 22, npm, Yarn 1.22, AWS CLI configured with a named profile

```bash
git clone <repo>

# Backend
cd backend && npm install

# Frontend
cd ../frontend && yarn install
```

See [backend/README.md](./backend/README.md) and [frontend/README.md](./frontend/README.md) for full setup instructions.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — complete technical reference: data models, all 17 API endpoints, DynamoDB schemas, IaC, security checklist
