# Technical Decisions

This document records the reasoning behind the system's initial architecture. Update it when a decision changes.

## 1. Separate frontend and backend repositories

**Decision:** Keep the Next.js frontend and Fastify API in independent Git repositories.

**Context:** The assignment requests separate frontend and backend repository links and a separately deployed API URL.

**Rationale:** Independent deployment and release lifecycles, explicit API contracts, and a clear separation between presentation and business logic. The frontend cannot bypass backend authorization or persistence rules.

**Trade-off:** Cross-repository changes require coordinated API contract updates. We mitigate this with versioned endpoints, OpenAPI documentation, and shared response conventions.

## 2. Fastify instead of Express

**Decision:** Use Fastify 5 with TypeScript.

**Rationale:** Fastify provides encapsulated plugins, structured logging, lifecycle hooks, schema-oriented request handling, and a lightweight core. It lets us demonstrate a modular backend without adopting a heavier application framework.

**Trade-off:** The plugin model and ecosystem conventions differ from Express, so contributors need to understand Fastify encapsulation and registration order.

## 3. Modular monolith instead of microservices

**Decision:** Keep auth, doctors, patients, and dashboard analytics as modules in one deployable API.

**Rationale:** The application has one bounded domain and a small team. A modular monolith keeps transactions and local development straightforward while preserving module boundaries.

**Trade-off:** Modules share a deployment and runtime. If independent scaling or ownership becomes necessary, module boundaries provide a starting point for extraction.

## 4. Reference patients from doctors

**Decision:** Store patients in their own collection with a `doctorId` reference.

**Rationale:** Patients need independent search, filtering, pagination, editing, and deletion. Referencing avoids unbounded growth of doctor documents and supports patient-centric queries.

**Trade-off:** Reading a patient's doctor requires a second query or a deliberate aggregation/population operation. We choose query patterns based on the screen's needs.

## 5. Zod at runtime boundaries

**Decision:** Use Zod for environment variables and API request/response schemas.

**Rationale:** TypeScript types disappear at runtime. Zod validates untrusted input and provides inferred types from the same schema.

**Trade-off:** Schemas need to be maintained as API contracts evolve. We expose OpenAPI documentation from these schemas to reduce drift.

## 6. TanStack Query for server state

**Decision:** Use TanStack Query for remote data; keep transient UI state local and filters in URL search parameters.

**Rationale:** Server cache lifecycle, request deduplication, invalidation, retries, and loading/error states should not be reimplemented with component state.

**Trade-off:** Cache keys and invalidation rules require discipline. We centralize query-key conventions as feature modules are implemented.

## 7. MongoDB indexes follow measured query patterns

**Decision:** Add indexes for unique identifiers and common list/filter/sort combinations, then verify with execution statistics.

**Rationale:** Indexes improve selected reads but add storage and write overhead. Indexes should reflect actual access patterns rather than every schema field.

**Trade-off:** Query plans must be rechecked as data volume and filters evolve. We use explain execution statistics to validate important queries.

## 8. Page-based pagination for this scope

**Decision:** Use bounded page/limit pagination for doctor and patient administration tables.

**Rationale:** The interface needs page numbers and total-page counts, and the expected assessment dataset is moderate. A maximum page size prevents unbounded responses.

**Trade-off:** Large offsets become more expensive at very high page numbers. Cursor pagination is a future option if dataset size and access patterns justify it.

## 9. Security boundaries live on the backend

**Decision:** The API owns authentication and authorization. The frontend only improves navigation and user experience.

**Rationale:** Client-side route guards are not a security control. Every protected API operation must verify the authenticated administrator.

**Trade-off:** Secure cookie-based authentication requires deliberate CORS, cookie, and deployment-domain configuration.

## 10. Liveness and readiness are separate

**Decision:** Provide a liveness endpoint independent of MongoDB and a readiness endpoint that checks database connectivity.

**Rationale:** A process can be alive while unable to serve useful requests. Separating these probes helps deployment platforms distinguish restart-worthy process failure from dependency unavailability.

## 11. Short-lived cookie-based administrator sessions

**Decision:** Use a 15-minute JWT access token in a signed, HttpOnly, SameSite=Lax cookie; require HTTPS and Secure cookies in production.

**Rationale:** JavaScript cannot read the access token, reducing exposure to token theft through common XSS paths. Short expiration limits the useful lifetime of a stolen token. The cookie plugin signs the cookie value, and JWT verification validates the token itself.

**Trade-off:** Cookie authentication requires explicit CORS and CSRF considerations. We restrict credentialed CORS to one configured origin and reject state-changing requests with a mismatched Origin. SameSite=Lax is an additional browser-level defense. There is no refresh-token flow in this assessment milestone, so users sign in again after expiration.

## 12. Check administrator status on every protected request

**Decision:** Verify the JWT and then load the administrator record, requiring the account to remain active.

**Rationale:** Disabling an administrator takes effect on the next request instead of waiting for the JWT to expire.

**Trade-off:** Protected requests incur one indexed database lookup. For this small administration system, immediate revocation is worth the extra query.

## 13. Bootstrap administrators out of band

**Decision:** Create the first administrator using a CLI script; do not expose public signup.

**Rationale:** An open registration endpoint would allow arbitrary users to create privileged accounts. A trusted shell/deployment operation is a smaller and auditable trust boundary.

**Trade-off:** Initial setup requires database access and secret handling outside the web UI. The bootstrap command explicitly creates the administrator indexes because automatic index creation is disabled in production.

## 14. Layered request throttling

**Decision:** Apply a global per-IP limit and a stricter 5-attempt-per-minute limit to administrator login.

**Rationale:** Authentication endpoints are high-value brute-force targets. A tighter route-specific limit protects credentials while the global limit provides a basic abuse ceiling.

**Trade-off:** The default in-memory store is process-local and resets on restart. Before horizontally scaling the API, move rate-limit state to a shared Redis store so clients cannot multiply their quota across replicas.

## 15. Verify sessions in a Next.js server layout

**Decision:** Put authenticated pages in a route group whose server layout reads the HttpOnly cookie and asks the API to validate it before rendering protected content.

**Rationale:** A client-only route guard can hide UI but still send server-rendered protected markup to an unauthenticated browser. The server layout prevents protected page content from rendering until the backend confirms the session. The API remains the actual authorization boundary and must protect every data endpoint independently.

**Trade-off:** The frontend and API need a cookie-sharing deployment topology. For sibling subdomains, configure a parent cookie domain; for local development, localhost ports share the host cookie jar. This introduces a request to the auth endpoint during protected page rendering.

## 16. Doctor records are independently addressable resources

**Decision:** Store each doctor in a dedicated MongoDB collection with unique email and medical-license indexes.

**Rationale:** Doctors are independently searchable, editable and removable resources. Dedicated documents avoid embedding a growing directory in another record and allow uniqueness to be enforced atomically by MongoDB.

**Trade-off:** Unique indexes must be created before production traffic. Duplicate-key errors are translated into a stable 409 conflict response rather than relying on a preflight existence check, which would be vulnerable to concurrent writes.

## 18. Model appointments as first-class time intervals

**Decision:** Store appointments in their own collection with patient/doctor references, a UTC start instant, duration, status, and timestamps. Index doctor/start, patient/start, and status/start access patterns.

**Rationale:** Scheduling is an independent lifecycle, and an appointment occupies a half-open interval from start to start + duration. Checking interval overlap (rather than only matching start times) correctly rejects partial overlaps while allowing adjacent visits. Cancelled and no-show records do not reserve capacity.

**Trade-off:** The current conflict check is a read-before-write application check. It is correct for sequential requests but is not serializable under simultaneous booking attempts on different API instances. Production scheduling with concurrent writers needs a transactional slot-lock or discrete slot-allocation design. Date filters are converted by the browser from the selected local calendar days into ISO instants (inclusive start, exclusive next-day end), so clinics see their own local day boundaries without relying on the API server timezone.

## 17. Validate and bound list queries at the API boundary

**Decision:** Use Zod query schemas with a default page size of 10, a hard maximum of 100, allow-listed sort fields, explicit status/specialty filters, and escaped literal search terms.

**Rationale:** The API owns pagination and filtering so clients cannot fetch unbounded collections or inject arbitrary MongoDB query operators. Escaping regex metacharacters ensures search is literal text rather than user-controlled regex syntax.

**Trade-off:** Page/offset pagination is easy to navigate and supports total counts, but very deep offsets can become slower as the collection grows. Cursor pagination can be introduced if observed access patterns warrant it.
