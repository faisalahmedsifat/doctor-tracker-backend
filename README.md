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

## Bootstrap the first administrator

There is intentionally no public registration endpoint. Create the first administrator from a trusted shell after MongoDB is available:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='use-a-unique-password-of-12+-characters' pnpm seed:admin
```

The command normalizes the email, hashes the password with bcrypt (12 rounds), and refuses to create a duplicate account. Do not put production credentials in shell history or commit them to the repository; use your deployment secret manager for production bootstrap.

## Authentication API

- `POST /api/v1/auth/login` — validates credentials and sets a signed, HttpOnly access cookie.
- `POST /api/v1/auth/logout` — clears the access cookie.
- `GET /api/v1/auth/me` — returns the current active administrator; requires authentication.

Access tokens expire after 15 minutes. Cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Login is limited to 5 attempts per minute per client IP. The built-in rate-limit store is per process; use a shared Redis-backed store before running multiple API replicas. There is no refresh token or public signup flow in this milestone; an expired session requires signing in again.

For browser requests, configure `FRONTEND_ORIGIN` to the exact frontend origin. Credentialed CORS is restricted to this origin, and state-changing requests carrying a different Origin are rejected. Deploy frontend and API over HTTPS in production.

## Scripts
- `pnpm dev` — development server with reload
- `pnpm typecheck` — TypeScript validation
- `pnpm lint` — ESLint
- `pnpm test` — run tests
- `pnpm build` — production build
- `pnpm start` — run production build
- `pnpm seed:admin` — one-time administrator bootstrap

## Architecture
Feature modules own routes, schemas, services, repositories, and models. Routes handle HTTP concerns; services contain business rules; persistence models are isolated by feature. Shared concerns live under `common/`. The API is versioned under `/api/v1`.

## Security
- No public administrator registration.
- Password hashes only (bcryptjs, 12 rounds).
- Short-lived JWT access tokens in signed HttpOnly cookies.
- Authentication checks the administrator's active status against MongoDB on each protected request.
- Login-specific rate limiting and global rate limiting.
- CORS restricted to the configured frontend origin; origin validation for state-changing browser requests.
- Helmet security headers.
- Environment variables hold secrets; never commit `.env`.
