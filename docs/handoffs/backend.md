# Specialist Handoff: Backend & API Contracts (Workstream B)

**Owner:** Senior Backend Engineer & API Contract Owner  
**Date:** 2026-10-23  
**Status:** Completed & Verified  
**Branch:** `main`

---

## 1. Scope & Deliverables

This workstream delivered hardened backend API endpoints, domain contracts, idempotency handling, SSRF protections, access control guards, and predictable error contracts for the Humaniti AI assessment platform.

### Owned Files Modified & Reviewed:
- `app/api/assessments/route.ts` (POST intake with idempotency, GET list with pagination)
- `app/api/assessments/[id]/route.ts` (GET status, PATCH cancel, DELETE purge)
- `app/api/assessments/[id]/report/route.ts` (GET report with auth guard)
- `app/api/health/route.ts` (Health probe with no-store cache control)
- `lib/services/assessment.ts` (Core assessment service, authorization, idempotency, upload streaming)
- `lib/contracts/assessment.ts` (Zod schemas: SSRF protection, idempotency key, error response contract)
- `lib/contracts/report.ts` (Coaching report contract and evidence validator)
- `docs/audit/backend-review.md` (Comprehensive API architecture & contract audit)
- `docs/handoffs/backend.md` (Specialist handoff & verification proofs)

---

## 2. Key Architectural Improvements

### 2.1 Duplicate Submission Idempotency (P1)
- **Header & Payload Support:** Clients provide `Idempotency-Key` or `X-Idempotency-Key` (or payload `idempotencyKey` in JSON).
- **Pre-Disk Short-Circuit:** The service queries PostgreSQL `assessmentJob` for existing jobs *before* spooling bytes or creating file descriptors.
- **Predictable Status Codes:**
  - `202 Accepted`: Newly created assessment job.
  - `200 OK`: Existing job reused (`queued`, `processing`, or `completed`), returning `{ id, status, reused: true }`.
  - `409 Conflict`: Existing job has previously `failed`, returning `{ id, status: "failed", reused: true }`.
- **Race Condition Safety:** Concurrent requests racing to insert the same key are caught via Prisma unique constraint `P2002`; the loser cleans up the staged file and gracefully returns the winning job with `reused: true`.

### 2.2 Access Control & Authorization (P0)
- **Bearer Token Enforcement:** Standardized on `authorize(request, mutation?: boolean)` across all API routes (`POST`, `GET`, `PATCH`, `DELETE`).
- **Timing-Safe Constant Time:** SHA-256 digests evaluated with `crypto.timingSafeEqual` prevent token length and character leakage via side-channel timing analysis.
- **Mutation Guard:** Origin validation prevents cross-site form/CSRF attacks on mutation operations.

### 2.3 SSRF & URL Validation Defenses (P1)
- Enhanced `isDisallowedHost` in `lib/contracts/assessment.ts`:
  - Blocks all IPv4 private ranges (RFC 1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Blocks loopback (`127.0.0.0/8`, `localhost`, `*.localhost`).
  - Blocks cloud metadata and link-local (`169.254.0.0/16`, `169.254.169.254`, `metadata.google.internal`, `instance-data`).
  - Blocks carrier-grade NAT (`100.64.0.0/10`), documentation subnets, multicast, and broadcast.
  - Blocks internal domain TLDs (`*.internal`, `*.local`, `*.lan`, `*.home.arpa`, `*.cluster.local`).
  - Blocks single-label hostnames without dot (`!host.includes(".")`).
  - Rejects all IPv6 literal source IPs (`isIP(host) === 6`).

### 2.4 Predictable Error Contracts
- Standardized error response envelope exported as `apiErrorSchema`:
  ```json
  {
    "error": "Error description message",
    "code": "machine_readable_code",
    "message": "Error description message"
  }
  ```
- All responses include `Cache-Control: no-store` and `Retry-After: 60` on `429 Too Many Requests`.

### 2.5 Complete Gateway Route Set
- Added `GET /api/assessments` for paginated history matching `historySchema`.
- Added `DELETE /api/assessments/:id` with terminal validation (active jobs return `409 invalid_state` with `"Active assessments cannot be deleted."`).

---

## 3. Verification & Test Evidence

All checks executed on Darwin arm64 environment:

### 3.1 Targeted API Integration Tests
```sh
$ npm test tests/integration/api.test.ts

 ✓ tests/integration/api.test.ts (11 tests) 101ms
   ✓ private assessment API (11)
     ✓ streams an authenticated upload into private storage and queues its durable reference 77ms
     ✓ rejects unsafe intake {"authorization":""} before creating jobs 2ms
     ✓ rejects unsafe intake {"x-recording-consent":"false"} before creating jobs 2ms
     ✓ rejects unsafe intake {"origin":"https://example.com"} before creating jobs 1ms
     ✓ rejects unsafe intake {"content-type":"image/png"} before creating jobs 2ms
     ✓ rejects unsafe intake {"content-length":"1001"} before creating jobs 1ms
     ✓ rejects unsafe intake {"content-type":"application/json"} before creating jobs 2ms
     ✓ cleans malformed/oversize files and failed database writes 6ms
     ✓ refuses a media root inside public or tracked application files 2ms
     ✓ protects status/report reads and never exposes a source reference 5ms
     ✓ bounds action bodies and rejects malformed or unknown actions 2ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```

### 3.2 Contract Validation Tests
```sh
$ npm test lib/contracts/assessment.test.ts

 ✓ lib/contracts/assessment.test.ts (14 tests) 7ms
   ✓ assessment source validation (14)
     ✓ accepts a public HTTPS source URL 3ms
     ✓ rejects unsafe source URL http://example.com/recording.mp4 1ms
     ✓ rejects unsafe source URL https://localhost/recording.mp4 0ms
     ✓ rejects unsafe source URL https://127.0.0.1/recording.mp4 0ms
     ✓ rejects unsafe source URL https://10.0.0.2/recording.mp4 0ms
     ✓ rejects unsafe source URL https://[::1]/recording.mp4 0ms
     ✓ rejects unsafe source URL https://[::ffff:127.0.0.1]/recording.mp4 0ms
     ✓ rejects unsafe source URL https://[fe80::1]/recording.mp4 0ms
     ✓ rejects unsafe source URL https://100.64.0.1/recording.mp4 0ms
     ✓ rejects unsafe source URL https://user:password@example.com/recording.mp4 0ms
     ✓ rejects unsafe source URL https://example.com/recording.mp4#private-fragment 0ms
     ✓ rejects extra request fields 0ms
     ✓ accepts a private upload reference and rejects path traversal 0ms
     ✓ rejects dimensions that reference missing evidence 1ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

### 3.3 Full Test Suite Execution
```sh
$ npm test

 Test Files  13 passed (13)
      Tests  161 passed (161)
   Duration  512ms
```

### 3.4 Typecheck & Linting
```sh
$ npm run typecheck
> tsc --noEmit
# Exit 0 - clean

$ npm run lint
> eslint .
# Exit 0 - clean
```

---

## 4. Handoff Notes for Integration & Downstream

1. **Downstream Clients (Frontend Workstream C):**
   - The UI can now safely transmit `Idempotency-Key: <unique-session-or-file-uuid>` on uploads to avoid duplicate assessments on network hiccups.
   - `GET /api/assessments` is available for fetching history with cursor pagination.
   - `DELETE /api/assessments/:id` is active for cleaning up terminal records.
2. **Database & Migrations (Storage Workstream D):**
   - The unique constraint `@unique` on `AssessmentJob.idempotencyKey` is fully operational in the schema and database migrations.
3. **Security (Workstream F):**
   - SSRF filtering protects against cloud metadata exfiltration (`169.254.169.254`, `metadata.google.internal`).
   - Constant-time token comparisons eliminate timing or side-channel vulnerabilities.
