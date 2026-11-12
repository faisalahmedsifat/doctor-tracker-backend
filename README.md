# Doctor Tracker API

A modular REST API built with Fastify 5, TypeScript, Zod, and MongoDB/Mongoose.

## Requirements
- Node.js 22+
- pnpm 12+
- MongoDB 7+ or MongoDB Atlas

## Getting started
```bash
pnpm install
cp .env.example .env
# Set strong local secrets and your MongoDB connection string in .env
pnpm dev
```

API: http://localhost:4000  
OpenAPI UI: http://localhost:4000/documentation  
Liveness: http://localhost:4000/api/v1/health/live  
Readiness: http://localhost:4000/api/v1/health/ready

## Scripts
- `pnpm dev` — development server with reload
- `pnpm typecheck` — TypeScript validation
- `pnpm build` — production build
- `pnpm start` — run production build
- `pnpm test` — run tests

## Architecture
Feature modules own routes, schemas, services, repositories, and models. Routes handle HTTP concerns; services contain business rules; repositories isolate persistence. Shared concerns live under `common/`. The API is versioned under `/api/v1`.

## Security
No public admin registration. Password hashes only (bcryptjs); short-lived JWT access tokens are delivered through HttpOnly cookies. CORS is restricted to the configured frontend origin. All secrets are environment variables and must never be committed.
