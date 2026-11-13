# Doctor Tracker API

A modular REST API built with Express 5, TypeScript, Zod, and MongoDB/Mongoose.

## Requirements

- Node.js 22+
- pnpm 12+
- MongoDB 7+ configured as a replica set (required for appointment transactions)
- Redis 7+

## Getting started

```bash
pnpm install
cp .env.example .env
# Set strong local secrets in .env
docker compose up -d
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

For browser requests, configure `FRONTEND_ORIGIN` to the exact frontend origin. Credentialed CORS is restricted to this origin, and state-changing requests carrying a different Origin are rejected. Deploy frontend and API over HTTPS in production. For server-side session verification when frontend and API use sibling subdomains (for example, `app.example.com` and `api.example.com`), set `COOKIE_DOMAIN=.example.com` so the browser sends the HttpOnly cookie to both hosts. Leave it unset for local development.

## Doctor management API

All doctor endpoints require an authenticated administrator:

- `GET /api/v1/doctors` — paginated directory; supports `page`, `limit` (maximum 100), `search`, `specialty`, `status`, `dateFrom`, `dateTo`, `sortBy`, and `sortOrder`.
- `GET /api/v1/doctors/:id` — retrieve one doctor.
- `POST /api/v1/doctors` — create a doctor.
- `PATCH /api/v1/doctors/:id` — update supplied fields.
- `GET /api/v1/doctors/:id/patients` — list the patients assigned to a doctor.
- `DELETE /api/v1/doctors/:id/patients/:patientId` — unassign a patient without deleting their record.
- `DELETE /api/v1/doctors/:id` — permanently delete a doctor.

Doctor records include hospital affiliation and an explicit weekly working-hours schedule (weekday plus start/end time in Asia/Dhaka); an empty schedule means availability is not configured, not that the doctor is available all day. Doctor email and medical-license number are unique. The API validates and normalizes email/license values, bounds numeric inputs, allow-lists sorting, escapes search terms, and translates duplicate-key races into HTTP 409 responses. Doctor documents use timestamps and indexes for unique identifiers and common directory queries. A doctor with assigned patients or linked appointments cannot be deleted until those references are resolved, preserving referential integrity.

**Production index rollout:** create the Doctor model indexes before enabling doctor writes in production. Mongoose automatic index creation is disabled in production by design; run an explicit index migration/deployment step rather than relying on application startup to create indexes.

## Appointment management API

All appointment endpoints require an authenticated administrator:

- `GET /api/v1/appointments` — bounded pagination with status, doctor, patient, date-range and text filters.
- `GET /api/v1/appointments/:id` — retrieve one appointment with patient and doctor summaries.
- `POST /api/v1/appointments` — schedule an appointment.
- `PATCH /api/v1/appointments/:id` — reschedule, reassign, edit notes/reason, duration or lifecycle status.
- `DELETE /api/v1/appointments/:id` — permanently delete an appointment.

Appointments store a UTC instant and a duration in minutes. The API requires active patient and doctor records, rejects past scheduling, requires an administrator-recorded override reason outside configured working hours or when hours are not configured, and checks overlapping intervals for the same doctor (adjacent appointments are allowed). Cancelled and no-show appointments do not block a slot. Supported statuses are `scheduled`, `confirmed`, `completed`, `cancelled`, and `no_show`.

**Concurrency and conflict management:** scheduling writes acquire a Redis per-doctor lease (`SET NX PX`) with unique ownership tokens, periodic lease renewal, and Lua compare-and-delete release. Multi-doctor updates acquire locks in sorted order to avoid lock-order deadlocks. Redis is a coordination layer, not the source of truth: each create/update/delete also runs in a MongoDB transaction and increments a hidden `scheduleVersion` on every affected doctor document. That shared write serializes competing transactions for a doctor's schedule; after a transaction retry, the overlap query sees the winning committed appointment. Transactions use snapshot reads and majority write concern. If Redis is unavailable or a lease is lost, scheduling fails closed. MongoDB must be a replica set; the local Compose stack configures a single-node `rs0` replica set, which supports transactions for development but is not a high-availability topology. The production deployment should use a properly managed replica set and highly available Redis.

## Dashboard API

- `GET /api/v1/dashboard/overview` — administrator-only live summary with doctor/patient totals, active counts, average active patients per active doctor, current-vs-previous-month registrations, seven months of patient registrations, the five busiest doctor assignments, and the five most recently created patient records.

The overview is computed from MongoDB on request; it contains no seeded/sample metrics. The dashboard response intentionally excludes patient contact details and other unnecessary sensitive fields. The frontend caches the response briefly and invalidates it after doctor or patient mutations.

## Patient management API

All patient endpoints require an authenticated administrator:

- `GET /api/v1/patients` — paginated directory with search, status, assigned-doctor, condition/diagnosis, registration date-range and sorting filters.
- `GET /api/v1/patients/:id` — retrieve one patient, including the assigned doctor summary.
- `POST /api/v1/patients` — create a patient and generate an immutable `PT-` patient number.
- `PATCH /api/v1/patients/:id` — update supplied fields.
- `DELETE /api/v1/patients/:id` — permanently delete a patient; linked appointments must be deleted first.

Patient records validate birth dates and contact details, normalize email, and verify doctor assignments before writes. Patient search and pagination are performed by MongoDB. Patient data is sensitive: use HTTPS, restrict database access, enable encrypted storage/backups, define retention and deletion policies, and avoid logging patient payloads before production use. This milestone does not implement field-level encryption, audit history, or consent management.

## Scripts

- `pnpm dev` — development server with reload
- `pnpm typecheck` — TypeScript validation
- `pnpm lint` — ESLint
- `pnpm test` — run isolated unit and HTTP-boundary tests (no database required)
- `pnpm test:integration` — run MongoDB/Redis-backed API integration tests (requires the configured replica set and Redis instance)
- `pnpm build` — production build
- `pnpm start` — run production build
- `pnpm seed:admin` — one-time administrator bootstrap

## Architecture

Feature modules own routes, schemas, services, repositories, and models. Routes handle HTTP concerns; services contain business rules; persistence models are isolated by feature. Shared concerns live under `common/`. Redis connection lifecycle is managed under `database/redis.ts`; the API is versioned under `/api/v1`.

## Security

- No public administrator registration.
- Password hashes only (bcryptjs, 12 rounds).
- Short-lived JWT access tokens in signed HttpOnly cookies.
- Authentication checks the administrator's active status against MongoDB on each protected request.
- Login-specific rate limiting and global rate limiting.
- CORS restricted to the configured frontend origin; origin validation for state-changing browser requests.
- Helmet security headers.
- Environment variables hold secrets; never commit `.env`.
